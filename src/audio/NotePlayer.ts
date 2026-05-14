import type { Music, Note } from '../music';
import { type Decoration, expandRepeats } from '../music';
import { MusicTimeline } from './MusicTimeline';
import {
  buildHarmonicSpectrum,
  getSynthProfileForGmInstrument,
  type SynthProfile,
} from './synthProfiles';

const METRONOME_LENGTH = 0.03;

// Map dynamics decorations to volume levels (0-1 scale)
const DYNAMICS_TO_VOLUME: Record<string, number> = {
  pppp: 0.1,
  ppp: 0.2,
  pp: 0.3,
  p: 0.4,
  mp: 0.5,
  mf: 0.6,
  f: 0.7,
  ff: 0.8,
  fff: 0.9,
  ffff: 1.0,
};

export class NotePlayer {
  active: boolean = false;
  audioCtx?: AudioContext;
  masterGain?: GainNode;
  masterGainValue: number;
  lastNoteTime: number;
  lastNoteIx: number;
  startTime: number = 0;
  tone: number = 164.8138;
  lookForward: number = 1.0;
  // Repeat-expanded note/curve sequence built once per playback from music.bars.
  expandedNotes: Note[] = [];
  expandedCurves: number[][] = [];
  private timeline: MusicTimeline | null = null;
  private profile: SynthProfile = getSynthProfileForGmInstrument(undefined);
  // Per-player profile graph: built once in start() and reused for every note,
  // so we don't allocate a BiquadFilterNode + vibrato LFO/Gain per note (which
  // saturates the audio thread and causes dropouts on fast passages).
  private vibratoLfo?: OscillatorNode;
  private vibratoGain?: GainNode;
  // Where each note's gain chain terminates — either the filter (if the
  // profile has one) or the master gain directly.
  private noteSink?: AudioNode;
  // If the profile's partials all have integer ratios and no detune, they
  // collapse into a single PeriodicWave — one OscillatorNode per pitch
  // instead of one per partial. Built once in start().
  private periodicWave?: PeriodicWave;

  constructor() {
    this.lastNoteTime = 0;
    this.lastNoteIx = -1;
    this.masterGainValue = 0.5; // Default volume at 50%
  }

  /** Set the synth profile used for subsequent note scheduling. */
  setProfile(profile: SynthProfile) {
    this.profile = profile;
  }

  /**
   * Set the master volume level
   * @param volume - Volume level between 0 (silent) and 1 (maximum)
   */
  setVolume(volume: number) {
    // Clamp volume between 0 and 1
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.masterGainValue = clampedVolume;
    if (this.masterGain) this.masterGain.gain.value = clampedVolume;
  }

  /**
   * Get volume level from dynamics decorations
   * @param decorations - Array of decorations on the note
   * @returns Volume level (0-1), or null if no dynamics found
   */
  private getVolumeFromDecorations(decorations: Decoration[]): number | null {
    for (const decoration of decorations) {
      if (decoration in DYNAMICS_TO_VOLUME) {
        return DYNAMICS_TO_VOLUME[decoration];
      }
    }
    return null;
  }

  enqueueTock(tempo: number) {
    if (!this.audioCtx || !this.masterGain) return;
    const osc = this.audioCtx.createOscillator();
    const envelope = this.audioCtx.createGain();

    osc.connect(envelope);
    envelope.connect(this.masterGain);
    osc.type = 'sine';

    this.lastNoteTime += 60 / tempo;
    osc.frequency.value = 400;
    envelope.gain.setValueAtTime(1, this.lastNoteTime);
    envelope.gain.exponentialRampToValueAtTime(
      0.001,
      this.lastNoteTime + METRONOME_LENGTH
    );
    osc.start(this.lastNoteTime);
    osc.stop(this.lastNoteTime + METRONOME_LENGTH);
  }

  /**
   * Returns true if the curve [s, e] is a tie: adjacent notes with identical pitches.
   * Ties are always between two consecutive notes; slurs can span any range.
   */
  private isTieCurve(s: number, e: number): boolean {
    if (e !== s + 1) return false;
    const a = this.expandedNotes[s];
    const b = this.expandedNotes[e];
    if (!a || !b || a.pitches.length === 0) return false;
    return (
      a.pitches.length === b.pitches.length &&
      a.pitches.every((p, i) => p === b.pitches[i])
    );
  }

  /** Returns true if note at idx is the second (or later) note of a tie — no new attack needed. */
  private isNoteTieContinuation(idx: number): boolean {
    return this.expandedCurves.some(
      ([s, e]) => e === idx && this.isTieCurve(s, e)
    );
  }

  /** Sums ticks across a full tie chain starting at startIdx. */
  private getTieChainTicks(startIdx: number): number {
    let totalTicks = this.expandedNotes[startIdx].ticks();
    let currentIdx = startIdx;
    while (true) {
      const next =
        this.expandedCurves.find(
          ([s, e]) => s === currentIdx && this.isTieCurve(s, e)
        )?.[1] ?? null;
      if (next === null) break;
      totalTicks += this.expandedNotes[next].ticks();
      currentIdx = next;
    }
    return totalTicks;
  }

  /**
   * Returns slur context for a note:
   *   noAttack  — note is a continuation within a slur (not the first note)
   *   noRelease — note continues into the next note within a slur (not the last note)
   */
  private getSlurContext(idx: number): {
    noAttack: boolean;
    noRelease: boolean;
  } {
    let noAttack = false;
    let noRelease = false;
    for (const [s, e] of this.expandedCurves) {
      if (this.isTieCurve(s, e)) continue; // ties handled separately
      if (s <= idx && idx <= e) {
        if (idx > s) noAttack = true;
        if (idx < e) noRelease = true;
      }
    }
    return { noAttack, noRelease };
  }

  enqueueNote(tempo: number, beatValue: number) {
    if (!this.audioCtx || !this.masterGain) return;
    const lengthToTime = (length: number) =>
      (60 / tempo) * (length / 1024) * (4 / beatValue);

    if (this.lastNoteIx > -1) {
      // Add the previous note's duration to figure out when the current note starts
      const pastTicks = this.expandedNotes[this.lastNoteIx]?.ticks() ?? 0;
      this.lastNoteTime += lengthToTime(pastTicks);
    }

    this.lastNoteIx++;
    const note = this.expandedNotes[this.lastNoteIx];
    const idx = this.lastNoteIx;

    // Undefined (past end of array), grace notes (0 ticks), or rests — handle
    // before touching note properties without optional chaining.
    if (!note || note.ticks() === 0) return;
    if (!note.pitches.length) return;

    // Tie continuation: this note's sound was already scheduled as part of the
    // preceding tie-start note's extended duration — produce no additional sound.
    if (this.isNoteTieContinuation(idx)) return;

    // For ties, play a single note for the total chained duration.
    const effectiveTicks = this.getTieChainTicks(idx);
    const duration = lengthToTime(effectiveTicks);

    const { noAttack, noRelease } = this.getSlurContext(idx);

    // Per-note dynamics gain — routes into the shared profile filter (if any)
    // or directly into the master gain.
    const noteGain = this.audioCtx.createGain();
    const dynamicVolume = this.getVolumeFromDecorations(note.decorations);
    noteGain.gain.value = dynamicVolume ?? 0.7;
    noteGain.connect(this.noteSink ?? this.masterGain);

    // Envelope (ADSR) shared across all pitches in this note/chord
    const envelope = this.audioCtx.createGain();
    const noteStart = this.lastNoteTime;
    const noteEnd = noteStart + duration;

    const profile = this.profile;
    const { attack, decay, sustain, release } = profile.envelope;
    // Cap attack+decay+release so they fit within the note duration.
    const headroom = Math.max(duration - 0.005, 0.005);
    const effAttack = Math.min(attack, headroom * 0.5);
    const effDecay = Math.min(decay, Math.max(headroom - effAttack, 0));
    const effRelease = Math.min(release, headroom);

    // Slur continuation skips only the attack transient — each note still
    // runs its own decay curve so loudness shape is consistent across the
    // slur. Otherwise low-sustain profiles (e.g. piano) would make every
    // note after the first sound much quieter than it.
    if (noAttack) {
      envelope.gain.setValueAtTime(1, noteStart);
      if (effDecay > 0 && sustain < 1) {
        envelope.gain.linearRampToValueAtTime(
          Math.max(sustain, 0.001),
          noteStart + effDecay
        );
      }
    } else {
      envelope.gain.setValueAtTime(0.001, noteStart);
      envelope.gain.linearRampToValueAtTime(1, noteStart + effAttack);
      if (effDecay > 0 && sustain < 1) {
        envelope.gain.linearRampToValueAtTime(
          Math.max(sustain, 0.001),
          noteStart + effAttack + effDecay
        );
      }
    }

    if (noRelease) {
      // Slur into next note: hold, then a tiny 5 ms fade to prevent a click.
      envelope.gain.setValueAtTime(Math.max(sustain, 0.001), noteEnd - 0.005);
      envelope.gain.exponentialRampToValueAtTime(0.001, noteEnd);
    } else {
      const releaseStart = Math.max(
        noteEnd - effRelease,
        noteStart + (noAttack ? 0 : effAttack) + effDecay
      );
      envelope.gain.setValueAtTime(Math.max(sustain, 0.001), releaseStart);
      envelope.gain.exponentialRampToValueAtTime(
        0.001,
        releaseStart + effRelease
      );
    }

    envelope.connect(noteGain);

    const sharedVibrato = this.vibratoGain;
    const wave = this.periodicWave;
    const bassBoost = profile.bassBoost;
    for (const pitch of note.pitches) {
      const freq = 440 * 2 ** ((pitch - 69) / 12);
      const pitchGain =
        bassBoost && freq < bassBoost.refFreq
          ? (bassBoost.refFreq / freq) ** bassBoost.exponent
          : 1;
      if (wave) {
        // Fast path: one oscillator per pitch carrying the full harmonic mix.
        const osc = this.audioCtx.createOscillator();
        osc.setPeriodicWave(wave);
        osc.frequency.value = freq;
        if (pitchGain !== 1) {
          const g = this.audioCtx.createGain();
          g.gain.value = pitchGain;
          osc.connect(g);
          g.connect(envelope);
        } else {
          osc.connect(envelope);
        }
        if (sharedVibrato) sharedVibrato.connect(osc.detune);
        osc.start(noteStart);
        osc.stop(noteEnd);
      } else {
        // Fallback: per-partial oscillators (used for profiles with detune
        // or non-integer ratios that can't fold into a PeriodicWave).
        for (const spec of profile.oscillators) {
          const osc = this.audioCtx.createOscillator();
          const oscGain = this.audioCtx.createGain();
          osc.type = spec.type;
          osc.frequency.value = freq * spec.ratio;
          if (spec.detune !== undefined) osc.detune.value = spec.detune;
          oscGain.gain.value = spec.gain * pitchGain;
          osc.connect(oscGain);
          oscGain.connect(envelope);
          if (sharedVibrato) sharedVibrato.connect(osc.detune);
          osc.start(noteStart);
          osc.stop(noteEnd);
        }
      }
    }
  }

  scheduleNotes(
    tempo: number = 120,
    music: Music | null = null,
    startTimeOffset: number = 0
  ) {
    if (!this.active || !this.audioCtx) return;

    const endTime = this.audioCtx.currentTime + this.lookForward;

    if (music) {
      // Expand repeats once at the start of playback.
      if (this.lastNoteIx === -1) {
        const expanded = expandRepeats(music);
        this.expandedNotes = expanded.entries.map((e) => e.note);
        this.expandedCurves = expanded.curves;
        this.timeline = new MusicTimeline(music, tempo, startTimeOffset);

        // Skip ahead if starting from a time offset.
        if (startTimeOffset > 0) {
          const beatValue = music.signatures[0].beatValue;
          const lengthToTime = (ticks: number) =>
            (60 / tempo) * (ticks / 1024) * (4 / beatValue);
          let accumulated = 0;
          for (let i = 0; i < this.expandedNotes.length; i++) {
            const dur = lengthToTime(this.expandedNotes[i].ticks());
            if (accumulated + dur > startTimeOffset) {
              this.lastNoteIx = i - 1;
              break;
            }
            accumulated += dur;
            if (i === this.expandedNotes.length - 1) {
              this.lastNoteIx = i;
            }
          }
          // Compensate so enqueueNote's duration-addition lands on audioCtx.currentTime
          if (this.lastNoteIx > -1) {
            const prevTicks = this.expandedNotes[this.lastNoteIx]?.ticks() ?? 0;
            this.lastNoteTime -= lengthToTime(prevTicks);
          }
        }
      }
      if (this.lastNoteIx >= this.expandedNotes.length) {
        this.active = false;
        return;
      }
      while (this.lastNoteTime < endTime) {
        this.enqueueNote(tempo, music.signatures[0].beatValue);
        if (this.lastNoteIx >= this.expandedNotes.length) {
          this.active = false;
          return;
        }
      }
    } else {
      while (this.lastNoteTime < endTime) {
        this.enqueueTock(tempo);
      }
    }
  }

  getNoteIdxAtTime(t: number): number {
    // t is audioCtx.currentTime; convert to elapsed seconds from startTime
    // so it matches the MusicTimeline's 0-based offsets.
    return this.timeline?.getNoteIdxAtTime(t - this.startTime) ?? 0;
  }

  start() {
    this.audioCtx = new AudioContext();

    // Create master gain node for volume control
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.connect(this.audioCtx.destination);
    this.masterGain.gain.value = this.masterGainValue;

    // Build the profile's shared filter once. All note envelopes route into
    // the filter; the filter routes into the master gain. If no filter, notes
    // flow directly into the master gain.
    const spectrum = buildHarmonicSpectrum(this.profile);
    if (spectrum) {
      this.periodicWave = this.audioCtx.createPeriodicWave(
        spectrum.real,
        spectrum.imag,
        { disableNormalization: true }
      );
    } else {
      this.periodicWave = undefined;
    }

    if (this.profile.filter) {
      const f = this.audioCtx.createBiquadFilter();
      f.type = this.profile.filter.type;
      f.frequency.value = this.profile.filter.frequency;
      f.Q.value = this.profile.filter.Q;
      f.connect(this.masterGain);
      this.noteSink = f;
    } else {
      this.noteSink = this.masterGain;
    }

    // Build a single continuously-running vibrato LFO; its gain output is
    // connected to each oscillator's detune in enqueueNote. osc.stop() will
    // sever its end of the connection automatically.
    if (this.profile.vibrato) {
      const lfo = this.audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = this.profile.vibrato.rate;
      const lfoGain = this.audioCtx.createGain();
      const delay = this.profile.vibrato.delay ?? 0;
      const t0 = this.audioCtx.currentTime;
      lfoGain.gain.setValueAtTime(0, t0);
      lfoGain.gain.linearRampToValueAtTime(
        this.profile.vibrato.depth,
        t0 + delay + 0.1
      );
      lfo.connect(lfoGain);
      lfo.start(t0);
      this.vibratoLfo = lfo;
      this.vibratoGain = lfoGain;
    } else {
      this.vibratoLfo = undefined;
      this.vibratoGain = undefined;
    }

    this.startTime = this.audioCtx.currentTime;
    this.lastNoteTime = this.audioCtx.currentTime;
    this.lastNoteIx = -1;
    this.timeline = null;
    this.expandedNotes = [];
    this.expandedCurves = [];
    this.active = true;
  }

  isPlaying(): boolean {
    return (
      this.active ||
      (!!this.audioCtx && this.audioCtx.currentTime < this.lastNoteTime)
    );
  }

  stop() {
    this.active = false;
    try {
      this.vibratoLfo?.stop();
    } catch {
      // already stopped or never started
    }
    this.vibratoLfo = undefined;
    this.vibratoGain = undefined;
    this.noteSink = undefined;
    this.periodicWave = undefined;
    this.masterGain = undefined;
    this.audioCtx?.close();
    this.audioCtx = undefined;
  }
}
