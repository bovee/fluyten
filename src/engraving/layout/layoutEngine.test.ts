import { describe, it, expect } from 'vitest';
import { fromAbc } from '../../io/abcImport';
import { computeLayout } from './layoutEngine';

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
