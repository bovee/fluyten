import { describe, it, expect } from 'vitest';
import { abcNote, keyAccidentalMap, explicitAccidental } from './abcUtils';

describe('abcNote', () => {
  it('octave 4 → uppercase letter', () => {
    expect(abcNote('C', 4)).toBe('C');
    expect(abcNote('F', 4)).toBe('F');
  });

  it('octave 5 → lowercase letter', () => {
    expect(abcNote('C', 5)).toBe('c');
    expect(abcNote('G', 5)).toBe('g');
  });

  it('octave 6 → lowercase + one prime', () => {
    expect(abcNote('C', 6)).toBe("c'");
  });

  it('octave 7 → lowercase + two primes', () => {
    expect(abcNote('D', 7)).toBe("d''");
  });

  it('octave 3 → uppercase + one comma', () => {
    expect(abcNote('C', 3)).toBe('C,');
  });

  it('octave 2 → uppercase + two commas', () => {
    expect(abcNote('C', 2)).toBe('C,,');
  });
});

describe('keyAccidentalMap', () => {
  it('C major → empty map', () => {
    expect(keyAccidentalMap('C')).toEqual({});
  });

  it('G major → F sharpened', () => {
    expect(keyAccidentalMap('G')).toEqual({ F: 1 });
  });

  it('D major → F and C sharpened', () => {
    const map = keyAccidentalMap('D');
    expect(map['F']).toBe(1);
    expect(map['C']).toBe(1);
  });

  it('F major → B flattened', () => {
    expect(keyAccidentalMap('F')).toEqual({ B: -1 });
  });

  it('Bb major → B and E flattened', () => {
    const map = keyAccidentalMap('Bb');
    expect(map['B']).toBe(-1);
    expect(map['E']).toBe(-1);
  });

  it('Am (relative minor of C) → empty map', () => {
    expect(keyAccidentalMap('Am')).toEqual({});
  });
});

describe('explicitAccidental', () => {
  it('same accidental in both maps → empty string', () => {
    expect(explicitAccidental('F', { F: 1 }, { F: 1 })).toBe('');
  });

  it('scale has sharp, song has none → ^', () => {
    expect(explicitAccidental('F', { F: 1 }, {})).toBe('^');
  });

  it('scale has flat, song has none → _', () => {
    expect(explicitAccidental('B', { B: -1 }, {})).toBe('_');
  });

  it('scale has no accidental, song has sharp → = (natural to cancel)', () => {
    expect(explicitAccidental('F', {}, { F: 1 })).toBe('=');
  });

  it('note not in either map → empty string', () => {
    expect(explicitAccidental('C', {}, {})).toBe('');
  });
});
