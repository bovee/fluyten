import { describe, it, expect } from 'vitest';
import { generateScaleAbc } from './scaleGenerator';
import { generateChordAbc, buildChord } from './chordGenerator';
import { RECORDER_TYPES } from '../instrument';

describe('generateScaleAbc', () => {
  it('C major ascending for SOPRANO: 8 notes', () => {
    const notes = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const tokens = notes.split(/\s+/).filter(Boolean);
    expect(tokens).toHaveLength(8);
    expect(notes.match(/\|/g)).toBeNull();
  });

  it('F major ascending for ALTO: starts on F', () => {
    const notes = generateScaleAbc({
      key: 'F',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'ALTO',
    });
    const firstNote = notes.trim().split(/\s/)[0];
    expect(firstNote).toBe('F');
  });

  it('descending direction: notes are reversed vs ascending', () => {
    const asc = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const desc = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'descending',
      instrumentType: 'SOPRANO',
    });
    const ascNotes = asc.split(/[| ]+/).filter(Boolean);
    const descNotes = desc.split(/[| ]+/).filter(Boolean);
    expect(descNotes).toEqual([...ascNotes].reverse());
  });

  it('random direction: same 8 notes as ascending but shuffled', () => {
    const asc = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const rand = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'random',
      instrumentType: 'SOPRANO',
    });
    const ascNotes = asc.split(/[| ]+/).filter(Boolean);
    const randNotes = rand.split(/[| ]+/).filter(Boolean);
    expect(randNotes).toHaveLength(8);
    expect([...randNotes].sort()).toEqual([...ascNotes].sort());
  });

  it('range "all": 16 notes', () => {
    const notes = generateScaleAbc({
      key: 'C',
      range: 'all',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const tokens = notes.split(/[| ]+/).filter(Boolean);
    expect(tokens).toHaveLength(16);
  });

  it('BASS instrument: first note is C,, (C at octave 2)', () => {
    const notes = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'BASS',
    });
    const firstNote = notes.trim().split(/\s/)[0];
    expect(firstNote).toBe('C,,');
  });

  it('TENOR instrument: first note is C (octave 4)', () => {
    const notes = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'TENOR',
    });
    const firstNote = notes.trim().split(/\s/)[0];
    expect(firstNote).toBe('C');
  });

  it('minor key Am: starts on A', () => {
    const notes = generateScaleAbc({
      key: 'Am',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const firstNote = notes.trim().split(/\s/)[0];
    expect(firstNote).toBe('A');
  });

  it('G major: F is sharpened (^f at octave 5)', () => {
    const notes = generateScaleAbc({
      key: 'G',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(notes).toContain('^f');
  });

  it('Bb major: B is flattened to _B', () => {
    const notes = generateScaleAbc({
      key: 'Bb',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(notes).toContain('_B');
  });

  it('songKey: emits explicit natural when song key has a sharp the scale does not', () => {
    // C major scale inserted into G major song: F should get =F to cancel the F#
    const notes = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
      songKey: 'G',
    });
    expect(notes).toContain('=F');
  });

  it('no bar lines in generated output', () => {
    const notes = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(notes.match(/\|/g)).toBeNull();
  });

  it('ALTO instrument: traditional range starts on the key root', () => {
    const notes = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'ALTO',
    });
    const firstNote = notes.trim().split(/\s/)[0];
    expect(firstNote).toBe('C');
  });
});

function hzToMidi(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

function noteToMidi(abcNote: string): number {
  // Strip accidental prefixes (^, _, =) and parse letter + octave marks
  const stripped = abcNote.replace(/^[^a-zA-Z]+/, '');
  const isLower = stripped[0] === stripped[0].toLowerCase();
  const letter = stripped[0].toUpperCase();
  const primes = (stripped.match(/'/g) ?? []).length;
  const commas = (stripped.match(/,/g) ?? []).length;
  const semitones: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const acc = abcNote.startsWith('^') ? 1 : abcNote.startsWith('_') ? -1 : 0;
  const octave = (isLower ? 5 : 4) + primes - commas;
  return (octave + 1) * 12 + (semitones[letter] ?? 0) + acc;
}

describe('generateChordAbc', () => {
  it('no bar lines in generated output', () => {
    const chord = { name: 'C', notes: buildChord('C', [0, 4, 7]) };
    const notes = generateChordAbc({
      chord,
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(notes.match(/\|/g)).toBeNull();
  });

  it('traditional range: all notes within instrument range', () => {
    const recorderTypes = ['SOPRANO', 'ALTO', 'TENOR', 'BASS'] as const;
    // Test a high chord (B major) which would exceed range without inversion
    const chord = { name: 'B', notes: buildChord('B', [0, 4, 7]) };
    for (const instrumentType of recorderTypes) {
      const notes = generateChordAbc({
        chord,
        range: 'traditional',
        direction: 'ascending',
        instrumentType,
      });
      const { highNote } = RECORDER_TYPES[instrumentType];
      const highMidi = hzToMidi(highNote);
      const tokens = notes.trim().split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        expect(noteToMidi(token)).toBeLessThanOrEqual(highMidi);
      }
    }
  });
});
