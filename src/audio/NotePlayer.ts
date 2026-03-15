import { Music, Note, type Decoration, expandRepeats } from '../music';

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
  // Records { noteIdx, time } for every non-grace note as it is scheduled,
  // so the cursor can ask "which note is playing right now?" without needing
  // to replicate the tempo arithmetic independently.
  noteTimings: Array<{ noteIdx: number; time: number; endTime: number }> = [];
  // Repeat-expanded note/curve sequence built once per playback from music.bars.
  expandedNotes: Note[] = [];
  expandedCurves: number[][] = [];
  expandedOriginalIndices: number[] = [];

  constructor() {
    this.lastNoteTime = 0;
    this.lastNoteIx = -1;
    this.masterGainValue = 0.5; // Default volume at 50%
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
    return this.expandedCurves.some(([s, e]) => e === idx && this.isTieCurve(s, e));
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
  private getSlurContext(idx: number): { noAttack: boolean; noRelease: boolean } {
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

    // Record timing for all non-grace notes (including rests) so the cursor
    // can determine the current note purely from audioCtx.currentTime.
    // Use the original (pre-expansion) index so the cursor maps correctly
    // back to music.notes on repeated passes.
    this.noteTimings.push({
      noteIdx: this.expandedOriginalIndices[idx] ?? idx,
      time: this.lastNoteTime,
      endTime: this.lastNoteTime + lengthToTime(note.ticks()),
    });

    if (!note.pitches.length) return;

    // Tie continuation: this note's sound was already scheduled as part of the
    // preceding tie-start note's extended duration — produce no additional sound.
    if (this.isNoteTieContinuation(idx)) return;

    // For ties, play a single note for the total chained duration.
    const effectiveTicks = this.getTieChainTicks(idx);
    const duration = lengthToTime(effectiveTicks);

    const attack = 0.04;
    const release = 0.03;

    const { noAttack, noRelease } = this.getSlurContext(idx);

    // Per-note dynamics gain
    const noteGain = this.audioCtx.createGain();
    const dynamicVolume = this.getVolumeFromDecorations(note.decorations);
    noteGain.gain.value = dynamicVolume ?? 0.7;
    noteGain.connect(this.masterGain);

    // Envelope shared across all pitches in this note/chord
    const envelope = this.audioCtx.createGain();
    const noteStart = this.lastNoteTime;
    const noteEnd = noteStart + duration;

    if (noAttack) {
      // Slur continuation: begin at full gain immediately (no re-attack)
      envelope.gain.setValueAtTime(1, noteStart);
    } else {
      envelope.gain.setValueAtTime(0.001, noteStart);
      envelope.gain.linearRampToValueAtTime(1, noteStart + attack);
    }

    if (noRelease) {
      // Slur into next note: hold at full gain, then a tiny 5 ms fade to
      // prevent an audible click when the oscillator cuts off.
      envelope.gain.setValueAtTime(1, noteEnd - 0.005);
      envelope.gain.exponentialRampToValueAtTime(0.001, noteEnd);
    } else {
      const releaseStart =
        noteStart + Math.max(duration - release, noAttack ? 0 : attack);
      envelope.gain.setValueAtTime(1, releaseStart);
      envelope.gain.exponentialRampToValueAtTime(0.001, releaseStart + release);
    }
    envelope.connect(noteGain);

    // Additive synthesis: harmonics at 1x, 2x, 3x with decreasing amplitude
    const gains = [1, 0.3, 0.1];
    for (const pitch of note.pitches) {
      const freq = 440 * 2 ** ((pitch - 69) / 12);
      for (let harmonic = 1; harmonic <= 3; harmonic++) {
        const osc = this.audioCtx.createOscillator();
        const harmGain = this.audioCtx.createGain();
        harmGain.gain.value = gains[harmonic - 1];
        osc.type = 'sine';
        osc.frequency.value = harmonic * freq;
        osc.connect(harmGain);
        harmGain.connect(envelope);
        osc.start(noteStart);
        osc.stop(noteEnd);
      }
    }
  }

  scheduleNotes(tempo: number = 120, music: Music | null = null) {
    if (!this.active || !this.audioCtx) return;

    const endTime = this.audioCtx.currentTime + this.lookForward;

    if (music) {
      // Expand repeats once at the start of playback.
      if (this.lastNoteIx === -1) {
        const expanded = expandRepeats(music);
        this.expandedNotes = expanded.notes;
        this.expandedCurves = expanded.curves;
        this.expandedOriginalIndices = expanded.originalIndices;
      }
      if (this.lastNoteIx >= this.expandedNotes.length) {
        this.active = false;
        return;
      }
      while (this.lastNoteTime < endTime) {
        this.enqueueNote(tempo, music.beatValue ?? 4);
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
    const timings = this.noteTimings;
    for (let i = 0; i < timings.length; i++) {
      if (timings[i].time > t) break;
      const next = timings[i + 1];
      if (!next || next.time > t) {
        const { noteIdx, time, endTime } = timings[i];
        const end = next ? next.time : endTime;
        const progress = end > time ? (t - time) / (end - time) : 0;
        return noteIdx + Math.min(progress, 1);
      }
    }
    return 0;
  }

  start() {
    this.audioCtx = new AudioContext();

    // Create master gain node for volume control
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.connect(this.audioCtx.destination);
    this.masterGain.gain.value = this.masterGainValue;

    this.startTime = this.audioCtx.currentTime;
    this.lastNoteTime = this.audioCtx.currentTime;
    this.lastNoteIx = -1;
    this.noteTimings = [];
    this.expandedNotes = [];
    this.expandedCurves = [];
    this.expandedOriginalIndices = [];
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
    this.masterGain = undefined;
    this.audioCtx?.close();
    this.audioCtx = undefined;
  }
}
