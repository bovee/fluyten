import { KEYS, FIFTHS_TO_ACCIDENTALS } from '../music';

/** Convert a letter + octave number to an ABC note string.
 *  C4 = 'C', C5 = 'c', C6 = "c'", C3 = 'C,', etc. */
export function abcNote(letter: string, octave: number): string {
  if (octave >= 5) {
    return letter.toLowerCase() + "'".repeat(octave - 5);
  } else if (octave === 4) {
    return letter.toUpperCase();
  } else {
    return letter.toUpperCase() + ','.repeat(4 - octave);
  }
}

/** Build a letter→accidental map for a given key string (e.g. "G" → {F: 1}). */
export function keyAccidentalMap(key: string): Record<string, number> {
  const fifths = KEYS[key] ?? 0;
  const accidentals = FIFTHS_TO_ACCIDENTALS[fifths] ?? [];
  const map: Record<string, number> = {};
  for (const acc of accidentals) {
    map[acc[0]] = acc[1] === '#' ? 1 : -1;
  }
  return map;
}

/** Return the ABC accidental prefix needed for a note letter given two
 *  letter→accidental maps (e.g. a scale's key vs. the song's key). */
export function explicitAccidental(
  letter: string,
  scaleMap: Record<string, number>,
  songMap: Record<string, number>
): string {
  const scaleAcc = scaleMap[letter] ?? 0;
  const songAcc = songMap[letter] ?? 0;
  if (scaleAcc === songAcc) return '';
  if (scaleAcc === 1) return '^';
  if (scaleAcc === -1) return '_';
  return '='; // natural — cancels a key-signature accidental
}
