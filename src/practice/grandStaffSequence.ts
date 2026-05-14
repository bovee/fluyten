import { expandRepeats, type Music } from '../music';

export interface PracticeEvent {
  /** Absolute tick from the start of the piece. */
  tick: number;
  /**
   * Per-voice expected pitches. Outer index = voice (matches the order of
   * the `voices` argument). Inner is the pitch list (usually 1, longer for
   * chords). An empty inner array means the voice has no fresh onset at
   * this tick — typically because the voice still has an earlier note
   * sounding, or has a rest here.
   */
  expectedPitches: number[][];
  /**
   * Per-voice index back into that voice's original `music.notes` for the
   * note starting at this tick, or null if no onset for that voice here.
   * Used to color the right note green/red in the UI.
   */
  originalIndices: (number | null)[];
}

/**
 * Merge N voices into a single time-keyed practice sequence. At every unique
 * note onset across any voice, emit one event listing what each voice expects
 * at that moment.
 *
 * Tie continuations are collapsed per voice (the user only needs to press the
 * tied note once), matching the existing single-voice practice behavior.
 * Rests still produce onsets; their inner pitch list will be empty.
 */
export function buildGrandStaffPracticeSequence(
  voices: Music[]
): PracticeEvent[] {
  // Per-voice timed entry list, then a tick→entry map for O(1) lookup.
  const perVoiceByTick = voices.map((music) => {
    const { entries, curves } = expandRepeats(music);
    const isTieContinuation = (i: number): boolean => {
      if (i === 0) return false;
      const prev = entries[i - 1].note;
      const curr = entries[i].note;
      if (
        prev.pitches.length === 0 ||
        prev.pitches.length !== curr.pitches.length ||
        !prev.pitches.every((p, j) => p === curr.pitches[j])
      )
        return false;
      return curves.some(([s, e]) => s === i - 1 && e === i);
    };
    const m = new Map<number, { pitches: number[]; originalIndex: number }>();
    let tick = 0;
    for (let i = 0; i < entries.length; i++) {
      const { note, originalIndex } = entries[i];
      if (!isTieContinuation(i)) {
        m.set(tick, { pitches: note.pitches.slice(), originalIndex });
      }
      tick += note.ticks();
    }
    return m;
  });

  // Union of all onset ticks across voices.
  const allTicks = new Set<number>();
  for (const m of perVoiceByTick)
    for (const tick of m.keys()) allTicks.add(tick);
  const sortedTicks = Array.from(allTicks).sort((a, b) => a - b);

  return sortedTicks.map((tick) => {
    const expectedPitches: number[][] = [];
    const originalIndices: (number | null)[] = [];
    for (let v = 0; v < voices.length; v++) {
      const e = perVoiceByTick[v].get(tick);
      expectedPitches.push(e ? e.pitches : []);
      originalIndices.push(e ? e.originalIndex : null);
    }
    return { tick, expectedPitches, originalIndices };
  });
}
