import { describe, it, expect } from 'vitest';
import { buildChord, generateChordAbc } from './chordGenerator';
import { RECORDER_TYPES } from '../instrument';

const SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

function noteToMidi(abcNote: string): number {
  const acc = abcNote.startsWith('^^')
    ? 2
    : abcNote.startsWith('__')
      ? -2
      : abcNote.startsWith('^')
        ? 1
        : abcNote.startsWith('_')
          ? -1
          : 0;
  const stripped = abcNote.replace(/^[^a-zA-Z]+/, '');
  const isLower = stripped[0] === stripped[0].toLowerCase();
  const letter = stripped[0].toUpperCase();
  const primes = (stripped.match(/'/g) ?? []).length;
  const commas = (stripped.match(/,/g) ?? []).length;
  const octave = (isLower ? 5 : 4) + primes - commas;
  return (octave + 1) * 12 + (SEMITONES[letter] ?? 0) + acc;
}

describe('buildChord', () => {
  it('C major triad', () => {
    expect(buildChord('C', [0, 4, 7])).toEqual(['C', 'E', 'G']);
  });

  it('G major triad', () => {
    expect(buildChord('G', [0, 4, 7])).toEqual(['G', 'B', 'D']);
  });

  it('Bb major triad', () => {
    expect(buildChord('Bb', [0, 4, 7])).toEqual(['_B', 'D', 'F']);
  });

  it('F# major triad', () => {
    expect(buildChord('F#', [0, 4, 7])).toEqual(['^F', '^A', '^C']);
  });

  it('C dominant 7th', () => {
    expect(buildChord('C', [0, 4, 7, 10])).toEqual(['C', 'E', 'G', '_B']);
  });
});

describe('generateChordAbc — traditional range', () => {
  it('C major triad on SOPRANO: first note is C (uppercase, octave 4)', () => {
    const chord = { name: 'C', notes: buildChord('C', [0, 4, 7]) };
    const result = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(result.trim().split(/\s+/)[0]).toBe('C');
  });

  it('C major triad: SOPRANO and TENOR produce identical notation', () => {
    const chord = { name: 'C', notes: buildChord('C', [0, 4, 7]) };
    const soprano = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const tenor = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'TENOR',
    });
    expect(soprano).toBe(tenor);
  });

  it('C major triad on BASS: first note is C,, (octave 2)', () => {
    const chord = { name: 'C', notes: buildChord('C', [0, 4, 7]) };
    const result = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'BASS',
    });
    expect(result.trim().split(/\s+/)[0]).toBe('C,,');
  });

  it('major triad gives exactly 3 notes', () => {
    const chord = { name: 'C', notes: buildChord('C', [0, 4, 7]) };
    const result = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(result.trim().split(/\s+/).filter(Boolean)).toHaveLength(3);
  });

  it('dominant 7th gives exactly 4 notes', () => {
    const chord = { name: 'C7', notes: buildChord('C', [0, 4, 7, 10]) };
    const result = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(result.trim().split(/\s+/).filter(Boolean)).toHaveLength(4);
  });

  it('descending: notes are reverse of ascending', () => {
    const chord = { name: 'C', notes: buildChord('C', [0, 4, 7]) };
    const asc = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const desc = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'descending',
      instrumentType: 'SOPRANO',
    });
    const ascNotes = asc.trim().split(/\s+/).filter(Boolean);
    const descNotes = desc.trim().split(/\s+/).filter(Boolean);
    expect(descNotes).toEqual([...ascNotes].reverse());
  });

  it('random: same notes as ascending, shuffled', () => {
    const chord = { name: 'C', notes: buildChord('C', [0, 4, 7]) };
    const asc = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const rand = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'random',
      instrumentType: 'SOPRANO',
    });
    const ascNotes = asc.trim().split(/\s+/).filter(Boolean);
    const randNotes = rand.trim().split(/\s+/).filter(Boolean);
    expect([...randNotes].sort()).toEqual([...ascNotes].sort());
  });
});

describe('generateChordAbc — all range', () => {
  it('G major: SOPRANO and TENOR produce identical notation', () => {
    const chord = { name: 'G', notes: buildChord('G', [0, 4, 7]) };
    const soprano = generateChordAbc({
      chord,
      range: 'all',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const tenor = generateChordAbc({
      chord,
      range: 'all',
      direction: 'ascending',
      instrumentType: 'TENOR',
    });
    expect(soprano).toBe(tenor);
  });

  it('G major: SOPRANINO and ALTO produce identical notation', () => {
    const chord = { name: 'G', notes: buildChord('G', [0, 4, 7]) };
    const sopranino = generateChordAbc({
      chord,
      range: 'all',
      direction: 'ascending',
      instrumentType: 'SOPRANINO',
    });
    const alto = generateChordAbc({
      chord,
      range: 'all',
      direction: 'ascending',
      instrumentType: 'ALTO',
    });
    expect(sopranino).toBe(alto);
  });

  it(`G major on TENOR: all notes within written range (MIDI 60–86)`, () => {
    const chord = { name: 'G', notes: buildChord('G', [0, 4, 7]) };
    const result = generateChordAbc({
      chord,
      range: 'all',
      direction: 'ascending',
      instrumentType: 'TENOR',
    });
    const tokens = result.trim().split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const midi = noteToMidi(token);
      expect(midi).toBeGreaterThanOrEqual(RECORDER_TYPES.TENOR.basePitch);
      expect(midi).toBeLessThanOrEqual(
        RECORDER_TYPES.TENOR.basePitch + RECORDER_TYPES.TENOR.pitchRange
      );
    }
  });

  it('G major on TENOR: ascending order', () => {
    const chord = { name: 'G', notes: buildChord('G', [0, 4, 7]) };
    const result = generateChordAbc({
      chord,
      range: 'all',
      direction: 'ascending',
      instrumentType: 'TENOR',
    });
    const tokens = result.trim().split(/\s+/).filter(Boolean);
    const midis = tokens.map(noteToMidi);
    for (let i = 1; i < midis.length; i++) {
      expect(midis[i]).toBeGreaterThan(midis[i - 1]);
    }
  });
});
