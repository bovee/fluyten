import { describe, it, expect } from 'vitest';
import { Duration, Music, Note } from './music';
import { featuresFromMusic } from './method';

describe('Note.name microtonal', () => {
  it('names a quarter-sharp as base note + ¼♯', () => {
    expect(new Note(60.5, Duration.QUARTER, [], 'd#').name()).toBe('C¼♯');
  });

  it('names a quarter-flat as base note + ¼♭', () => {
    expect(new Note(59.5, Duration.QUARTER, [], 'db').name()).toBe('C¼♭');
  });

  it('names a three-quarter-sharp as base note + ¾♯', () => {
    expect(new Note(61.5, Duration.QUARTER, [], '3d#').name()).toBe('C¾♯');
  });

  it('names a three-quarter-flat as base note + ¾♭', () => {
    expect(new Note(58.5, Duration.QUARTER, [], '3db').name()).toBe('C¾♭');
  });

  it('names a microtonal note on a non-C base', () => {
    expect(new Note(62.5, Duration.QUARTER, [], 'd#').name()).toBe('D¼♯'); // D quarter-sharp
  });
});

describe('featuresFromMusic', () => {
  it('does not crash for notes in octave 4 (lowercase range)', () => {
    // Regression: midiToAbcName called toLowercase() instead of toLowerCase(),
    // crashing for any note with MIDI pitch >= 72 (octave 4 in internal terms).
    const music = new Music();
    music.notes = [new Note(72, Duration.QUARTER)]; // C5 = internal octave 4
    expect(() => featuresFromMusic(music)).not.toThrow();
  });

  it('does not crash for notes in octave 5+', () => {
    const music = new Music();
    music.notes = [new Note(84, Duration.QUARTER)]; // C6 = internal octave 5
    expect(() => featuresFromMusic(music)).not.toThrow();
  });

  it('does not crash for microtonal (fractional) pitches', () => {
    // Regression: fractional MIDI pitches (e.g. 60.5 for C quarter-sharp) gave
    // a fractional semitone index, making NOTE_NAMES[0.5] return undefined and
    // crashing downstream callers.
    const music = new Music();
    music.notes = [
      new Note(60.5, Duration.QUARTER, [], 'd#'), // C quarter-sharp
      new Note(59.5, Duration.QUARTER, [], 'db'), // C quarter-flat
      new Note(61.5, Duration.QUARTER, [], '3d#'), // C three-quarter-sharp
      new Note(58.5, Duration.QUARTER, [], '3db'), // C three-quarter-flat
    ];
    expect(() => featuresFromMusic(music)).not.toThrow();
  });

  it('does not crash for microtonal pitches in high octaves', () => {
    const music = new Music();
    music.notes = [new Note(72.5, Duration.QUARTER, [], 'd#')]; // C5 quarter-sharp
    expect(() => featuresFromMusic(music)).not.toThrow();
  });
});
