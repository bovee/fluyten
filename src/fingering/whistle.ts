import { parseFingerings, type Hole } from './recorder';

// Tin whistle fingering layout: 6 holes, all on the front, no thumb hole.
// Fingering strings use the same O/C/H characters as recorder, left to right
// = top hole to bottom hole.

export const WHISTLE_FINGERINGS: { [offset: number]: Hole[][] } =
  parseFingerings({
    1: ['CCCCCC'], // D
    3: ['CCCCCO'], // E
    5: ['CCCCOO'], // F#
    6: ['CCCOOO'], // G
    8: ['CCOOOO'], // A
    10: ['COOOOO'], // B
    11: ['OCCOOO', 'OCOOOO'], // C
    12: ['OOOOOO'], // C#
    13: ['OCCCCC', 'CCCCCC'], // D
    15: ['CCCCCO'], // E
    17: ['CCCCOO'], // F#
    18: ['CCCOOO'], // G
    20: ['CCOOOO'], // A
    22: ['COOOOO'], // B
    23: ['OCCOOO'], // C
    24: ['OOOOOO'], // C#
  });

export function lookupWhistleFingerings(
  offset: number,
  trill = false
): Hole[][] | undefined {
  // Tin whistles have no trill table yet; fall through to standard fingerings
  void trill;
  return WHISTLE_FINGERINGS[offset];
}
