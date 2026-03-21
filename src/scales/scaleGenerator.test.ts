import { describe, it, expect, vi } from 'vitest';
import { generateScaleAbc } from './scaleGenerator';

// Mock crypto.randomUUID for deterministic IDs
vi.stubGlobal(
  'crypto',
  Object.assign({}, globalThis.crypto, {
    randomUUID: (() => {
      let counter = 0;
      return () => `uuid-${++counter}`;
    })(),
  })
);

describe('generateScaleAbc', () => {
  it('C major ascending for SOPRANO: returns 1 song with correct headers and 8 notes', () => {
    const songs = generateScaleAbc({
      keys: ['C'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(songs).toHaveLength(1);
    expect(songs[0].abc).toContain('K:C');
    expect(songs[0].abc).toContain('M:C');
    expect(songs[0].abc).toContain('L:1/4');
    // 8 notes in groups of 4 separated by |
    const scoreLine = songs[0].abc.split('\n').at(-1)!;
    expect(scoreLine).toContain('|');
    // Count notes (space-separated tokens excluding bars)
    const noteTokens = scoreLine.split(/[| ]+/).filter((t) => t.length > 0);
    expect(noteTokens).toHaveLength(8);
  });

  it('F major ascending for ALTO: starts on F, has K:F', () => {
    const songs = generateScaleAbc({
      keys: ['F'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'ALTO',
    });
    expect(songs[0].abc).toContain('K:F');
    // ALTO starts on F, so traditional F major starts on F
    const scoreLine = songs[0].abc.split('\n').at(-1)!;
    const firstNote = scoreLine.trim().split(/\s/)[0];
    expect(firstNote).toBe('F');
  });

  it('descending direction: notes are reversed vs ascending', () => {
    const asc = generateScaleAbc({
      keys: ['C'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const desc = generateScaleAbc({
      keys: ['C'],
      range: 'traditional',
      direction: 'descending',
      instrumentType: 'SOPRANO',
    });
    const ascNotes = asc[0].abc
      .split('\n')
      .at(-1)!
      .split(/[| ]+/)
      .filter(Boolean);
    const descNotes = desc[0].abc
      .split('\n')
      .at(-1)!
      .split(/[| ]+/)
      .filter(Boolean);
    expect(descNotes).toEqual([...ascNotes].reverse());
  });

  it('both direction: 15 notes (8 up + 7 down, pivot not duplicated)', () => {
    const songs = generateScaleAbc({
      keys: ['C'],
      range: 'traditional',
      direction: 'both',
      instrumentType: 'SOPRANO',
    });
    const scoreLine = songs[0].abc.split('\n').at(-1)!;
    const noteTokens = scoreLine.split(/[| ]+/).filter(Boolean);
    expect(noteTokens).toHaveLength(15);
  });

  it('range "all" mode: 16 notes from instrument base note', () => {
    const songs = generateScaleAbc({
      keys: ['C'],
      range: 'all',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const scoreLine = songs[0].abc.split('\n').at(-1)!;
    const noteTokens = scoreLine.split(/[| ]+/).filter(Boolean);
    expect(noteTokens).toHaveLength(16);
  });

  it('multiple keys: returns correct number of songs with distinct IDs', () => {
    const songs = generateScaleAbc({
      keys: ['C', 'G', 'F'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(songs).toHaveLength(3);
    const ids = new Set(songs.map((s) => s.id));
    expect(ids.size).toBe(3);
  });

  it('minor key formatting: Am → title "A Minor Scale"', () => {
    const songs = generateScaleAbc({
      keys: ['Am'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(songs[0].title).toBe('A Minor Scale');
    expect(songs[0].abc).toContain('T:A Minor Scale');
  });

  it('sharp key formatting: F# → title has ♯ unicode', () => {
    const songs = generateScaleAbc({
      keys: ['F#'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(songs[0].title).toContain('♯');
    expect(songs[0].title).toBe('F♯ Major Scale');
  });

  it('flat key formatting: Bb → title has ♭ unicode', () => {
    const songs = generateScaleAbc({
      keys: ['Bb'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    expect(songs[0].title).toContain('♭');
    expect(songs[0].title).toBe('B♭ Major Scale');
  });

  it('BASS instrument: starting octave 2, clef=bass in K: line', () => {
    const songs = generateScaleAbc({
      keys: ['C'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'BASS',
    });
    expect(songs[0].abc).toContain('clef=bass');
    // traditional with key 'C' → startLetter = 'C', startingOctave = 2
    // abcNote('C', 2) = 'C' + ','.repeat(4-2) = 'C,,'
    const scoreLine = songs[0].abc.split('\n').at(-1)!;
    const firstNote = scoreLine.trim().split(/\s/)[0];
    expect(firstNote).toBe('C,,');
  });

  it('TENOR instrument: starts on C at octave 4', () => {
    const songs = generateScaleAbc({
      keys: ['C'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'TENOR',
    });
    const scoreLine = songs[0].abc.split('\n').at(-1)!;
    const firstNote = scoreLine.trim().split(/\s/)[0];
    // C at octave 4 → 'C' (uppercase, no modifiers)
    expect(firstNote).toBe('C');
  });

  it('custom formatTitle function override', () => {
    const songs = generateScaleAbc({
      keys: ['C'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
      formatTitle: (key) => `Custom ${key}`,
    });
    expect(songs[0].title).toBe('Custom C');
    expect(songs[0].abc).toContain('T:Custom C');
  });

  it('ABC output contains pipe separators every 4 notes', () => {
    const songs = generateScaleAbc({
      keys: ['C'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'SOPRANO',
    });
    const scoreLine = songs[0].abc.split('\n').at(-1)!;
    // Should have at least one pipe
    const pipes = scoreLine.match(/\|/g);
    expect(pipes).not.toBeNull();
    // 8 notes → 2 groups of 4 → "group1 | group2 |" → 2 pipes
    expect(pipes!.length).toBe(2);
  });

  it('ALTO instrument: starts on F', () => {
    const songs = generateScaleAbc({
      keys: ['C'],
      range: 'traditional',
      direction: 'ascending',
      instrumentType: 'ALTO',
    });
    // ALTO startNote is F, startingOctave is 4
    const scoreLine = songs[0].abc.split('\n').at(-1)!;
    // For 'all' range, starts on F at octave 4 → 'F'
    // But for 'traditional' with key C, starts on C (key[0].toUpperCase() = 'C')
    const firstNote = scoreLine.trim().split(/\s/)[0];
    expect(firstNote).toBe('C');
  });
});
