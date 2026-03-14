import { describe, it, expect } from 'vitest';
import { transformFragment } from './transformations';

const FULL_ABC_C = 'T:Test\nM:4/4\nL:1/4\nK:C\nCDEF GABc |]';
const FULL_ABC_G = 'T:Test\nM:4/4\nL:1/4\nK:G\nGABc defg |]';

describe('transformFragment - octave-up', () => {
  it('shifts uppercase notes to lowercase', () => {
    const result = transformFragment('CDEF', FULL_ABC_C, 'octave-up');
    expect(result).toBe('c d e f');
  });

  it('shifts lowercase notes up one octave (adds apostrophe)', () => {
    const result = transformFragment('cdef', FULL_ABC_C, 'octave-up');
    expect(result).toBe("c' d' e' f'");
  });

  it('shifts notes with commas (removes one comma)', () => {
    // C, is octave 2; shifting up gives C (octave 3 = uppercase)
    const result = transformFragment('C,', FULL_ABC_C, 'octave-up');
    expect(result).toBe('C');
  });

  it('shifts notes with apostrophes (adds another apostrophe)', () => {
    const result = transformFragment("c'", FULL_ABC_C, 'octave-up');
    expect(result).toBe("c''");
  });

  it('preserves rests', () => {
    const result = transformFragment('z2', FULL_ABC_C, 'octave-up');
    expect(result).toBe('z2');
  });

  it('preserves bar lines', () => {
    const result = transformFragment('C D | E F', FULL_ABC_C, 'octave-up');
    expect(result).toContain('|');
    expect(result).toContain('c');
    expect(result).toContain('e');
  });

  it('handles accidentals', () => {
    const result = transformFragment('^C', FULL_ABC_C, 'octave-up');
    expect(result).toBe('^c');
  });

  it('preserves note durations', () => {
    const result = transformFragment('C2 D4 E/2', FULL_ABC_C, 'octave-up');
    expect(result).toContain('c2');
    expect(result).toContain('d4');
    expect(result).toContain('e/2');
  });

  it('preserves dotted note durations', () => {
    const result = transformFragment('C3/2', FULL_ABC_C, 'octave-up');
    expect(result).toContain('c3/2');
  });

  it('handles in-key notes (key of G)', () => {
    // 'g' in key of G is a plain G; shifted up should be 'g'' (G5)
    const result = transformFragment('g', FULL_ABC_G, 'octave-up');
    expect(result).toBe("g'");
  });
});

describe('transformFragment - octave-down', () => {
  it('shifts lowercase notes to uppercase', () => {
    const result = transformFragment('cdef', FULL_ABC_C, 'octave-down');
    expect(result).toBe('C D E F');
  });

  it('shifts uppercase notes (adds comma)', () => {
    const result = transformFragment('CDEF', FULL_ABC_C, 'octave-down');
    expect(result).toBe('C, D, E, F,');
  });

  it('shifts notes with apostrophes (removes one)', () => {
    const result = transformFragment("c'", FULL_ABC_C, 'octave-down');
    expect(result).toBe('c');
  });

  it('shifts notes with commas (adds another comma)', () => {
    const result = transformFragment('C,', FULL_ABC_C, 'octave-down');
    expect(result).toBe('C,,');
  });

  it('preserves rests', () => {
    const result = transformFragment('z', FULL_ABC_C, 'octave-down');
    expect(result).toBe('z');
  });
});

describe('transformFragment - semitone-up', () => {
  it('shifts C up a semitone to C#', () => {
    const result = transformFragment('C', FULL_ABC_C, 'semitone-up');
    expect(result).toBe('^C');
  });

  it('shifts E up a semitone to F', () => {
    const result = transformFragment('E', FULL_ABC_C, 'semitone-up');
    expect(result).toBe('F');
  });

  it('shifts B up a semitone to C', () => {
    const result = transformFragment('B', FULL_ABC_C, 'semitone-up');
    expect(result).toBe('c');
  });
});

describe('transformFragment - semitone-down', () => {
  it('shifts D down a semitone to C#', () => {
    const result = transformFragment('D', FULL_ABC_C, 'semitone-down');
    expect(result).toBe('^C');
  });

  it('shifts F down a semitone to E', () => {
    const result = transformFragment('F', FULL_ABC_C, 'semitone-down');
    expect(result).toBe('E');
  });

  it('shifts C down a semitone to B,', () => {
    const result = transformFragment('C', FULL_ABC_C, 'semitone-down');
    expect(result).toBe('B,');
  });
});

describe('transformFragment - fifth-up', () => {
  it('shifts C up a fifth to G', () => {
    const result = transformFragment('C', FULL_ABC_C, 'fifth-up');
    expect(result).toBe('G');
  });

  it('shifts G up a fifth to D', () => {
    const result = transformFragment('G', FULL_ABC_C, 'fifth-up');
    expect(result).toBe('d');
  });

  it('shifts B up a fifth to F#', () => {
    const result = transformFragment('B', FULL_ABC_C, 'fifth-up');
    expect(result).toBe('^f');
  });

  it('shifts B2 A2 | G4 up a fifth', () => {
    const result = transformFragment('B2 A2 | G4', FULL_ABC_C, 'fifth-up');
    expect(result).toContain('^f2');
    expect(result).toContain('e2');
    expect(result).toContain('d4');
  });
});

describe('transformFragment - fifth-down', () => {
  it('shifts G down a fifth to C', () => {
    const result = transformFragment('G', FULL_ABC_C, 'fifth-down');
    expect(result).toBe('C');
  });

  it('shifts D down a fifth to G,', () => {
    const result = transformFragment('D', FULL_ABC_C, 'fifth-down');
    expect(result).toBe('G,');
  });

  it('shifts F down a fifth to Bb', () => {
    const result = transformFragment('F', FULL_ABC_C, 'fifth-down');
    expect(result).toBe('^A,');
  });
});

describe('transformFragment - double-duration', () => {
  it('doubles a quarter note to a half note', () => {
    const result = transformFragment('C', FULL_ABC_C, 'double-duration');
    expect(result).toBe('C2');
  });

  it('doubles an eighth note to a quarter note', () => {
    const result = transformFragment('c', FULL_ABC_G, 'double-duration');
    expect(result).toBe('c2');
  });

  it('doubles a half note to a whole note', () => {
    const result = transformFragment('C2', FULL_ABC_C, 'double-duration');
    expect(result).toBe('C4');
  });

  it('doubles a whole note and leaves it unchanged (already maximum)', () => {
    const result = transformFragment('C4', FULL_ABC_C, 'double-duration');
    expect(result).toBe('C4');
  });

  it('doubles a dotted quarter to a dotted half', () => {
    const result = transformFragment('C3/2', FULL_ABC_C, 'double-duration');
    expect(result).toBe('C3');
  });

  it('preserves rests', () => {
    const result = transformFragment('z2', FULL_ABC_C, 'double-duration');
    expect(result).toBe('z4');
  });
});

describe('transformFragment - halve-duration', () => {
  it('halves a quarter note to an eighth note', () => {
    const result = transformFragment('C', FULL_ABC_C, 'halve-duration');
    expect(result).toBe('C/2');
  });

  it('halves a half note to a quarter note', () => {
    const result = transformFragment('C2', FULL_ABC_C, 'halve-duration');
    expect(result).toBe('C');
  });

  it('halves a whole note to a half note', () => {
    const result = transformFragment('C4', FULL_ABC_C, 'halve-duration');
    expect(result).toBe('C2');
  });

  it('halves a sixteenth note and leaves it unchanged (already minimum)', () => {
    // C/4 = sixteenth note with L:1/4; halving produces no representable duration
    const result = transformFragment('C/4', FULL_ABC_C, 'halve-duration');
    expect(result).toBe('C/4');
  });

  it('halves a dotted half to a dotted quarter', () => {
    const result = transformFragment('C3', FULL_ABC_C, 'halve-duration');
    expect(result).toBe('C3/2');
  });

  it('preserves rests', () => {
    const result = transformFragment('z', FULL_ABC_C, 'halve-duration');
    expect(result).toBe('z/2');
  });
});

describe('transformFragment - errors', () => {
  it('throws for unknown transform id', () => {
    expect(() => transformFragment('c', FULL_ABC_C, 'invalid')).toThrow(
      'Unknown transformation: invalid'
    );
  });
});
