import { describe, it, expect } from 'vitest';
import { fromAbc } from '../../io/abcImport';
import { computeLayout } from './layoutEngine';
import { pitchToStaffPosition } from './pitchLayout';

function tuplets(abc: string, width = 800) {
  const music = fromAbc(abc);
  const layout = computeLayout(music, width);
  return layout.lines.flatMap((ln) => ln.tuplets);
}

describe('computeLayout tuplets', () => {
  it('emits one bracket per triplet group', () => {
    const abc = `X:1\nT:t\nM:4/4\nL:1/4\nK:C\n(3 BAB G4 (3 CCC | F4 c4 | (3 BAG F4 c2 | (3 BAG f4 | (3 BAB G4 CC |`;
    const result = tuplets(abc);
    expect(result).toHaveLength(5);
    result.forEach((t) => expect(t.num).toBe(3));
  });

  it('does not emit spurious cross-line brackets at line breaks', () => {
    const abc = `X:1\nT:t\nM:4/4\nL:1/4\nK:C\n(3 BAB G4 (3 CCC | F4 c4 | (3 BAG F4 c2 | (3 BAG f4 | (3 BAB G4 CC |`;
    const result = tuplets(abc);
    for (const t of result) {
      expect(t.endX - t.startX).toBeLessThan(200);
    }
  });

  it('places bracket above for stems-up notes', () => {
    const abc = `X:1\nT:t\nM:4/4\nL:1/4\nK:C\n(3 CCC C |`;
    const result = tuplets(abc);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('above');
  });

  it('places bracket below for stems-down notes', () => {
    const abc = `X:1\nT:t\nM:4/4\nL:1/4\nK:C\n(3 ccc c |`;
    const result = tuplets(abc);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('below');
  });

  it('bracket below has larger y than bracket above', () => {
    const abc = `X:1\nT:t\nM:4/4\nL:1/4\nK:C\n(3 CCC (3 ccc |`;
    const result = tuplets(abc);
    expect(result).toHaveLength(2);
    const [above, below] = result;
    expect(above.direction).toBe('above');
    expect(below.direction).toBe('below');
    expect(below.y).toBeGreaterThan(above.y);
  });
});

describe('pitchToStaffPosition microtonal', () => {
  // C4 = MIDI 60, staff position for treble clef: stepsFromC4=0, clefOffset=-6 → -6 (ledger below)
  // D4 = MIDI 62, stepsFromC4=1 → -5
  const clef = 'treble';

  it('half-sharp (d#) places on same staff line as base note', () => {
    const natural = pitchToStaffPosition(60, undefined, clef); // C natural
    const halfSharp = pitchToStaffPosition(60.5, 'd#', clef); // C half-sharp
    expect(halfSharp).toBe(natural);
  });

  it('half-flat (db) places on same staff line as base note', () => {
    const natural = pitchToStaffPosition(60, undefined, clef); // C natural
    const halfFlat = pitchToStaffPosition(59.5, 'db', clef); // C half-flat
    expect(halfFlat).toBe(natural);
  });

  it('three-quarter-tone sharp (3d#) places on same staff line as base note', () => {
    const natural = pitchToStaffPosition(60, undefined, clef); // C natural
    const threeQ = pitchToStaffPosition(61.5, '3d#', clef); // C three-quarter-sharp
    expect(threeQ).toBe(natural);
  });

  it('three-quarter-tone flat (3db) places on same staff line as base note', () => {
    const natural = pitchToStaffPosition(60, undefined, clef); // C natural
    const threeQ = pitchToStaffPosition(58.5, '3db', clef); // C three-quarter-flat
    expect(threeQ).toBe(natural);
  });

  it('microtonal on D places on D staff line', () => {
    const dNatural = pitchToStaffPosition(62, undefined, clef);
    const dHalfSharp = pitchToStaffPosition(62.5, 'd#', clef);
    expect(dHalfSharp).toBe(dNatural);
  });
});
