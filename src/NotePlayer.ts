import { Music, type Decoration } from './music';

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

  enqueueNote(tempo: number, music: Music) {
    if (!this.audioCtx || !this.masterGain) return;
    const lengthToTime = (length: number) =>
      (60 / tempo) * (length / 1024) * (4 / (music.beatValue ?? 4));

    if (this.lastNoteIx > -1) {
      // Add the previous note's duration to figure out when the current note starts
      const pastTicks = music.notes[this.lastNoteIx]?.ticks() ?? 0;
      this.lastNoteTime += lengthToTime(pastTicks);
    }

    this.lastNoteIx++;
    const note = music.notes[this.lastNoteIx];

    // Undefined (past end of array), grace notes (0 ticks), or rests — handle
    // before touching note properties without optional chaining.
    if (!note || note.ticks() === 0) return;

    // Record timing for all non-grace notes (including rests) so the cursor
    // can determine the current note purely from audioCtx.currentTime.
    this.noteTimings.push({
      noteIdx: this.lastNoteIx,
      time: this.lastNoteTime,
      endTime: this.lastNoteTime + lengthToTime(note.ticks()),
    });

    if (!note.pitches.length) return;

    const duration = lengthToTime(note.ticks());
    const attack = 0.04;
    const release = 0.03;

    // Per-note dynamics gain
    const noteGain = this.audioCtx.createGain();
    const dynamicVolume = this.getVolumeFromDecorations(note.decorations);
    noteGain.gain.value = dynamicVolume ?? 0.7;
    noteGain.connect(this.masterGain);

    // Envelope shared across all pitches in this note/chord
    const envelope = this.audioCtx.createGain();
    envelope.gain.setValueAtTime(0.001, this.lastNoteTime);
    envelope.gain.linearRampToValueAtTime(1, this.lastNoteTime + attack);
    const releaseStart =
      this.lastNoteTime + Math.max(duration - release, attack);
    envelope.gain.setValueAtTime(1, releaseStart);
    envelope.gain.exponentialRampToValueAtTime(0.001, releaseStart + release);
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
        osc.start(this.lastNoteTime);
        osc.stop(this.lastNoteTime + duration);
      }
    }
  }

  scheduleNotes(tempo: number = 120, music: Music | null = null) {
    if (!this.active || !this.audioCtx) return;

    const endTime = this.audioCtx.currentTime + this.lookForward;

    if (music) {
      if (this.lastNoteIx >= music.notes.length) {
        this.active = false;
        return;
      }
      while (this.lastNoteTime < endTime) {
        this.enqueueNote(tempo, music);
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
