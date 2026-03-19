import { describe, it, expect } from 'vitest';
import { Hole, lookupFingerings } from './FingeringDiagram';

describe('lookupFingerings', () => {
  // Soprano base pitch is 71, so pitch 72 = offset 1 (lowest note: C5)
  it('returns fingerings for a valid soprano pitch', () => {
    const result = lookupFingerings(72, 'SOPRANO', false);
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
    expect(result![0]).toHaveLength(8);
    // Offset 1: all closed
    expect(result![0]).toEqual([
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
    ]);
  });

  it('returns undefined for a pitch outside the fingering table', () => {
    expect(lookupFingerings(71, 'SOPRANO', false)).toBeUndefined(); // offset 0
    expect(lookupFingerings(200, 'SOPRANO', false)).toBeUndefined();
  });

  it('returns multiple alternatives for notes with alternate fingerings', () => {
    // Offset 11 has two fingering alternatives (soprano pitch 71 + 11 = 82)
    const result = lookupFingerings(82, 'SOPRANO', false);
    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
  });

  it('uses German fingerings when enabled and available', () => {
    // Offset 6 differs between baroque and German (soprano pitch 71 + 6 = 77)
    const baroque = lookupFingerings(77, 'SOPRANO', false)!;
    const german = lookupFingerings(77, 'SOPRANO', true)!;
    expect(baroque).not.toEqual(german);
    // German offset 6: holes 5,6,7 open
    expect(german[0]).toEqual([
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ]);
  });

  it('falls back to baroque fingerings when German has no override', () => {
    // Offset 5 has no German override (soprano pitch 71 + 5 = 76)
    const baroque = lookupFingerings(76, 'SOPRANO', false)!;
    const german = lookupFingerings(76, 'SOPRANO', true)!;
    expect(german).toEqual(baroque);
  });

  it('uses correct base pitch for alto', () => {
    // Alto base pitch is 64, so pitch 65 = offset 1
    const result = lookupFingerings(65, 'ALTO', false);
    expect(result).toBeDefined();
    expect(result![0]).toEqual([
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
    ]);
  });

  it('uses correct base pitch for tenor', () => {
    // Tenor base pitch is 59, so pitch 60 = offset 1 (lowest note: C4)
    const result = lookupFingerings(60, 'TENOR', false);
    expect(result).toBeDefined();
    // Offset 1: all closed
    expect(result![0]).toEqual([
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
    ]);
  });
});
