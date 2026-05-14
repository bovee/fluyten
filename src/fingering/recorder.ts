import { type FingeringSystem } from '../store';

export const Hole = {
  Open: 0,
  Half: 1,
  Closed: 2,
  // Trill holes animate between two states
  TrilledClosedOpen: 3, // alternates: Closed ↔ Open
  TrilledHalfOpen: 4, // alternates: Half ↔ Open
  TrilledOpenClosed: 5, // alternates: Open ↔ Closed
  TrilledClosedHalf: 6, // alternates: Closed ↔ Half
} as const;

export type Hole = (typeof Hole)[keyof typeof Hole];

// Fingering strings: each character is one hole (thumb first).
export function parseFingerings(raw: { [offset: number]: string[] }): {
  [offset: number]: Hole[][];
} {
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [
      k,
      v.map((s) =>
        s.split('').map((c) => {
          switch (c) {
            case 'O':
              return Hole.Open;
            case 'H':
              return Hole.Half;
            case 'C':
              return Hole.Closed;
            case 'T':
              return Hole.TrilledClosedOpen;
            case 'U':
              return Hole.TrilledOpenClosed;
            case 'V':
              return Hole.TrilledClosedHalf;
            case 'W':
              return Hole.TrilledHalfOpen;
            default:
              throw new Error(`Unknown hole character: ${c}`);
          }
        })
      ),
    ])
  );
}

export const FINGERINGS: { [offset: number]: Hole[][] } = parseFingerings({
  0: ['CCCCCCCCH'], // B
  1: ['CCCCCCCC'], // C
  2: ['CCCCCCCH'],
  3: ['CCCCCCCO'], // D
  4: ['CCCCCCHO'],
  5: ['CCCCCCOO'], // E
  6: ['CCCCCOCC'], // F
  7: ['CCCCOCCO'],
  8: ['CCCCOOOO'], // G
  9: ['CCCOCCHO'],
  10: ['CCCOOOOO'], // A
  11: ['CCOCCOOO', 'COCCCOOO'],
  12: ['CCOOOOOO', 'COCCOOOO'], // B
  13: ['COCOOOOO'],
  14: ['OCCOOOOO', 'COOOOOOO'], // C
  15: ['OOCOOOOO'], // D
  16: ['OOCCCCCO'],
  17: ['HCCCCCOO'], // E
  18: ['HCCCCOCO'], // F
  19: ['HCCCOCOO'],
  20: ['HCCCOOOO'], // G
  21: ['HCCOCOOO'],
  22: ['HCCOOOOO'], // A
  23: ['HCCOCCCO'],
  24: ['HCCOCCOO'], // B
  25: ['HCOOCCOO'], // C
  26: ['HCOCCOCCC', 'HCHCCOCC'],
  27: ['HCOCCOCH'], // D
  28: ['HOCCOOOO'],
  29: ['HOCCOCCOC'], // E
  30: ['HCCOCCOOC'], // F
  31: ['HCCOCCOO'],
  32: ['HCOOCOOO'], // G
});

export const GERMAN_FINGERINGS: { [offset: number]: Hole[][] } =
  parseFingerings({
    6: ['CCCCCOOO'],
    7: ['CCCCOCCC'],
    18: ['HCCCCOOO'],
    19: ['HCCCOCOC', 'HCCCOCHO'],
    21: ['HCCCOCCC'],
  });

// Fingerings for trilled notes. Use T/U/V/W characters to mark holes that
// animate during the trill. Keys are pitch offsets identical to FINGERINGS.
export const TRILLED_FINGERINGS: { [offset: number]: Hole[][] } =
  parseFingerings({
    5: ['CCCCCVOO'], // E
    8: ['CCCTOOOO'], // G
    10: ['CCTOOOOO'], // A
    11: ['CTOCCOOO'],
    12: ['COCTOOOO', 'CTOOOOOO'], // B
    15: ['OCCCCTCC'], // D
    17: ['HCCCCVOO'],
  });

export function lookupFingerings(
  offset: number,
  system: FingeringSystem,
  trill = false
): Hole[][] | undefined {
  if (trill) return TRILLED_FINGERINGS[offset] || FINGERINGS[offset];
  if (system === 'german' && offset in GERMAN_FINGERINGS) {
    return GERMAN_FINGERINGS[offset];
  }
  return FINGERINGS[offset];
}
