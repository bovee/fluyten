import { describe, it, expect } from 'vitest';
import { generateScaleAbc } from './scaleGenerator';

describe('generateScaleAbc', () => {
  it('C major ascending for SOPRANO: 8 notes in two bar groups', () => {
    const notes = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const tokens = notes.split(/[| ]+/).filter(Boolean);
    expect(tokens).toHaveLength(8);
    expect(notes.match(/\|/g)).toHaveLength(2);
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

  it('bar grouping: 8 notes produce exactly 2 pipe characters', () => {
    const notes = generateScaleAbc({
      key: 'C',
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(notes.match(/\|/g)).toHaveLength(2);
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
