import { type Music, expandRepeats } from '../music';

/**
 * Pure-arithmetic music position tracker. Builds the full note timing table
 * at construction time (no AudioContext required) and tracks elapsed time via
 * performance.now(). Use this instead of a silent NotePlayer when you only
 * need cursor position — no audio synthesis.
 */
export class MusicTimeline {
  private readonly noteTimings: Array<{
    noteIdx: number;
    time: number;
    endTime: number;
  }>;
  private readonly totalDuration: number;
  private startedAt: number | null = null;

  constructor(music: Music, tempo: number) {
    const beatValue = music.beatValue ?? 4;
    const { notes, originalIndices } = expandRepeats(music);
    const lengthToTime = (ticks: number) =>
      (60 / tempo) * (ticks / 1024) * (4 / beatValue);

    const timings: Array<{ noteIdx: number; time: number; endTime: number }> =
      [];
    let currentTime = 0;

    for (let idx = 0; idx < notes.length; idx++) {
      const note = notes[idx];
      const ticks = note.ticks();
      if (ticks === 0) continue; // grace notes have no duration
      const endTime = currentTime + lengthToTime(ticks);
      timings.push({
        noteIdx: originalIndices[idx] ?? idx,
        time: currentTime,
        endTime,
      });
      currentTime = endTime;
    }

    this.noteTimings = timings;
    this.totalDuration = currentTime;
  }

  /** Record the wall-clock start time. Call this when music begins. */
  start(): void {
    this.startedAt = performance.now() / 1000;
  }

  /** Seconds elapsed since start(). Returns 0 if not yet started. */
  getCurrentTime(): number {
    if (this.startedAt === null) return 0;
    return performance.now() / 1000 - this.startedAt;
  }

  /** Returns a fractional note index for the given time offset (same logic as NotePlayer). */
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

  /** True when elapsed time has passed all note timings. */
  isFinished(): boolean {
    if (this.startedAt === null) return false;
    return this.getCurrentTime() >= this.totalDuration;
  }
}
