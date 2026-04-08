const NOTE_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Parses a note name like "C4", "E#5", "Ab6", "Bb3" into a MIDI number.
 * Returns null if the string is not a valid note name.
 */
export function noteNameToMidi(name: string): number | null {
  const m = name.trim().match(/^([A-Ga-g])([#b]{0,2})(-?\d+)$/);
  if (!m) return null;
  const semitone = NOTE_SEMITONE[m[1].toUpperCase()];
  const acc = m[2].split('').reduce((a, c) => a + (c === '#' ? 1 : -1), 0);
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + semitone + acc;
  return midi >= 0 && midi <= 127 ? midi : null;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function hzToMidi(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

/** C2 (subgreat bass recorder) to C7 (garklein) detection range in Hz. */
export const DETECTION_LOW_HZ = midiToHz(36);
export const DETECTION_HIGH_HZ = midiToHz(96);
