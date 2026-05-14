import { describe, it, expect } from 'vitest';
import { Hole, lookupFingerings } from './fingering/recorder';

describe('lookupFingerings', () => {
  it('returns fingerings for offset 1 (lowest note, all closed)', () => {
    const result = lookupFingerings(1, 'baroque');
    expect(result).toBeDefined();
    expect(result!.length).toBeGreaterThan(0);
    expect(result![0]).toHaveLength(8);
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

  it('returns undefined for an offset outside the fingering table', () => {
    expect(lookupFingerings(-1, 'baroque')).toBeUndefined();
    expect(lookupFingerings(100, 'baroque')).toBeUndefined();
  });

  it('returns multiple alternatives for offset 11', () => {
    const result = lookupFingerings(11, 'baroque');
    expect(result).toBeDefined();
    expect(result!.length).toBe(2);
  });

  it('uses German fingerings when enabled and available', () => {
    const baroque = lookupFingerings(6, 'baroque')!;
    const german = lookupFingerings(6, 'german')!;
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
    const baroque = lookupFingerings(5, 'baroque')!;
    const german = lookupFingerings(5, 'german')!;
    expect(german).toEqual(baroque);
  });
});
