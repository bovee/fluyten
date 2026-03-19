import { describe, it, expect } from 'vitest';
import { toAbc } from './abcExport';
import { fromAbc } from './abcImport';
import { Music, Note, Duration, DurationModifier } from '../music';

describe('toAbc', () => {
  describe('headers', () => {
    it('should emit title', () => {
      const music = new Music();
      music.title = 'Hot Cross Buns';
      music.keySignature = 'C';
      expect(toAbc(music)).toContain('T:Hot Cross Buns');
    });

    it('should emit composer', () => {
      const music = new Music();
      music.composer = 'Bach';
      music.keySignature = 'C';
      expect(toAbc(music)).toContain('C:Bach');
    });

    it('should omit composer line when absent', () => {
      const music = new Music();
      music.keySignature = 'C';
      expect(toAbc(music)).not.toContain('C:');
    });

    it('should emit time signature', () => {
      const music = new Music();
      music.beatsPerBar = 3;
      music.beatValue = 4;
      music.keySignature = 'C';
      expect(toAbc(music)).toContain('M:3/4');
    });

    it('should always emit L:1/8', () => {
      const music = new Music();
      music.keySignature = 'C';
      expect(toAbc(music)).toContain('L:1/8');
    });

    it('should emit key signature', () => {
      const music = new Music();
      music.keySignature = 'G';
      expect(toAbc(music)).toContain('K:G');
    });
  });

  describe('note durations', () => {
    function singleNoteAbc(
      duration: Duration,
      modifier: DurationModifier = DurationModifier.NONE
    ): string {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(60, duration, [], undefined, modifier)];
      return toAbc(music);
    }

    it('whole note → 8', () => {
      expect(singleNoteAbc(Duration.WHOLE)).toContain('C8');
    });

    it('half note → 4', () => {
      expect(singleNoteAbc(Duration.HALF)).toContain('C4');
    });

    it('quarter note → 2', () => {
      expect(singleNoteAbc(Duration.QUARTER)).toContain('C2');
    });

    it('eighth note → (no suffix)', () => {
      const abc = singleNoteAbc(Duration.EIGHTH);
      // Should contain 'C' without a numeric suffix (just 'C' or 'C ')
      expect(abc).toMatch(/C[^0-9]/);
    });

    it('sixteenth note → /2', () => {
      expect(singleNoteAbc(Duration.SIXTEENTH)).toContain('C/2');
    });

    it('dotted half → 6', () => {
      expect(singleNoteAbc(Duration.HALF, DurationModifier.DOTTED)).toContain(
        'C6'
      );
    });

    it('dotted quarter → 3', () => {
      expect(
        singleNoteAbc(Duration.QUARTER, DurationModifier.DOTTED)
      ).toContain('C3');
    });

    it('dotted eighth → 3/2', () => {
      expect(singleNoteAbc(Duration.EIGHTH, DurationModifier.DOTTED)).toContain(
        'C3/2'
      );
    });

    it('dotted sixteenth → 3/4', () => {
      expect(
        singleNoteAbc(Duration.SIXTEENTH, DurationModifier.DOTTED)
      ).toContain('C3/4');
    });
  });

  describe('pitch encoding', () => {
    it('encodes C4 (octave 3) as uppercase C', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(60, Duration.EIGHTH)]; // C4
      expect(toAbc(music)).toContain('C');
    });

    it('encodes C5 (octave 4) as lowercase c', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(72, Duration.EIGHTH)]; // C5
      expect(toAbc(music)).toContain('c');
    });

    it('encodes C3 (octave 2) as C with comma', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(48, Duration.EIGHTH)]; // C3
      expect(toAbc(music)).toContain('C,');
    });

    it('encodes C6 (octave 5) as c with apostrophe', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(84, Duration.EIGHTH)]; // C6
      expect(toAbc(music)).toContain("c'");
    });

    it('encodes sharp with ^ prefix', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(61, Duration.EIGHTH, [], '#')]; // C#4 = app octave 3 = uppercase
      expect(toAbc(music)).toContain('^C');
    });

    it('encodes flat with _ prefix', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(70, Duration.EIGHTH, [], 'b')]; // Bb4 = app octave 3 = uppercase
      expect(toAbc(music)).toContain('_B');
    });

    it('encodes rest as z', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(undefined, Duration.QUARTER)];
      expect(toAbc(music)).toContain('z');
    });
  });

  describe('bar lines', () => {
    it('emits standard bar lines', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
      ];
      music.bars = [{ afterNoteNum: 0, type: 'standard' }];
      expect(toAbc(music)).toContain('|');
    });

    it('emits end bar line', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(60, Duration.QUARTER)];
      music.bars = [{ afterNoteNum: 0, type: 'end' }];
      expect(toAbc(music)).toContain('|]');
    });

    it('emits repeat begin', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(60, Duration.QUARTER)];
      music.bars = [{ afterNoteNum: 0, type: 'begin_repeat' }];
      expect(toAbc(music)).toContain('|:');
    });

    it('emits repeat end', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(60, Duration.QUARTER)];
      music.bars = [{ afterNoteNum: 0, type: 'end_repeat' }];
      expect(toAbc(music)).toContain(':|');
    });

    it('emits begin_end_repeat as ::', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
      ];
      music.bars = [{ afterNoteNum: 0, type: 'begin_end_repeat' }];
      expect(toAbc(music)).toContain('::');
    });
  });

  describe('decorations', () => {
    it('emits staccato', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(60, Duration.QUARTER, ['staccato'])];
      expect(toAbc(music)).toContain('.');
    });

    it('emits fermata', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(60, Duration.QUARTER, ['fermata'])];
      expect(toAbc(music)).toContain('!fermata!');
    });

    it('emits trill', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(60, Duration.QUARTER, ['trill'])];
      expect(toAbc(music)).toContain('!trill!');
    });

    it('emits dynamic markings', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note(60, Duration.QUARTER, ['pp'])];
      expect(toAbc(music)).toContain('!pp!');
    });
  });

  describe('beams', () => {
    it('groups beamed notes without spaces', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [
        new Note(60, Duration.EIGHTH),
        new Note(62, Duration.EIGHTH),
        new Note(64, Duration.EIGHTH),
      ];
      music.beams = [[0, 2]];
      const abc = toAbc(music);
      // No space between beamed notes in the score line
      const scoreLine = abc.split('\n').at(-1)!;
      expect(scoreLine).toMatch(/[CDEFGABcdefgab][CDEFGABcdefgab]/);
    });

    it('separates non-beamed notes with spaces', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
      ];
      const abc = toAbc(music);
      const scoreLine = abc.split('\n').at(-1)!;
      expect(scoreLine).toContain(' ');
    });
  });

  describe('slurs', () => {
    it('wraps slurred notes in parentheses', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [
        new Note(60, Duration.EIGHTH),
        new Note(62, Duration.EIGHTH),
      ];
      music.curves = [[0, 1]];
      const abc = toAbc(music);
      expect(abc).toContain('(');
      expect(abc).toContain(')');
    });
  });

  describe('ties', () => {
    it('exports same-pitch curve as `-` not `(...)`', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [
        new Note(64, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
      ];
      music.curves = [[0, 1]];
      const abc = toAbc(music);
      expect(abc).toContain('-');
      expect(abc).not.toContain('(');
      expect(abc).not.toContain(')');
    });

    it('exports different-pitch curve as `(...)` not `-`', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [
        new Note(64, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
      ];
      music.curves = [[0, 1]];
      const abc = toAbc(music);
      expect(abc).toContain('(');
      expect(abc).toContain(')');
      expect(abc).not.toContain('-');
    });

    it('exports chain tie [0,2] as n-n-n', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [
        new Note(64, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
      ];
      music.curves = [[0, 2]];
      const abc = toAbc(music);
      const scoreLine = abc.split('\n').at(-1)!;
      // Both notes at index 0 and 1 should have `-` after them
      expect(scoreLine).toMatch(/E2-.*E2-.*E2/);
    });

    it('exports slur ending on tied note as `...)-` not `...-)`', () => {
      // (c b a)-a : slur [0,2] over different pitches, tie [2,3] same pitch
      const music = new Music();
      music.keySignature = 'C';
      // pitches: c5=72, b4=71, a4=69
      music.notes = [
        new Note(72, Duration.QUARTER),
        new Note(71, Duration.QUARTER),
        new Note(69, Duration.QUARTER),
        new Note(69, Duration.QUARTER),
      ];
      music.curves = [
        [0, 2], // slur c→a (different pitches)
        [2, 3], // tie a→a (same pitch)
      ];
      const abc = toAbc(music);
      const scoreLine = abc.split('\n').at(-1)!;
      // slur close `)` must appear before tie `-` on the same note
      expect(scoreLine).toContain(')-');
      expect(scoreLine).not.toContain('-(');
    });

    it('exports tie into slur as `D-(D...)`', () => {
      // D-(D E F) : tie [0,1] same pitch, slur [1,3] different pitches
      const music = new Music();
      music.keySignature = 'C';
      // pitches: D4=62, E4=64, F4=65
      music.notes = [
        new Note(62, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
        new Note(65, Duration.QUARTER),
      ];
      music.curves = [
        [0, 1], // tie D→D (same pitch)
        [1, 3], // slur D→F (different pitches)
      ];
      const abc = toAbc(music);
      const scoreLine = abc.split('\n').at(-1)!;
      // tie `-` after first D, then `(` opens the slur before second D
      // (there may be a space between them since the notes aren't beamed)
      expect(scoreLine).toMatch(/-[^)]*\(/);
      expect(scoreLine).not.toContain(')-');
    });

    it('round-trips ties: export then re-import preserves tie arcs', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [
        new Note(64, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
      ];
      music.curves = [[0, 1]];
      const abc = toAbc(music);
      const music2 = fromAbc(abc);
      expect(music2.curves.length).toBe(1);
      expect(music2.curves[0][0]).toBe(0);
      expect(music2.curves[0][1]).toBe(1);
    });
  });

  describe('chords', () => {
    it('exports chord with [ and ] brackets', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.notes = [new Note([60, 64, 67], Duration.QUARTER)];
      const abc = toAbc(music);
      expect(abc).toContain('[');
      expect(abc).toContain(']');
    });
  });

  describe('bass clef', () => {
    it('exports clef=bass in K: line', () => {
      const music = new Music();
      music.keySignature = 'C';
      music.clef = 'bass';
      const abc = toAbc(music);
      expect(abc).toContain('K:C clef=bass');
    });
  });

  describe('round-trip', () => {
    it('round-trips a simple melody', () => {
      const original = `T:Hot Cross Buns
C:Traditional
M:4/4
L:1/8
K:C
E2 D2 C4 |E2 D2 C4 |]`;
      const music1 = fromAbc(original);
      const exported = toAbc(music1);
      const music2 = fromAbc(exported);
      expect(music2.title).toBe(music1.title);
      expect(music2.keySignature).toBe(music1.keySignature);
      expect(music2.beatsPerBar).toBe(music1.beatsPerBar);
      expect(music2.notes.length).toBe(music1.notes.length);
      for (let i = 0; i < music1.notes.length; i++) {
        expect(music2.notes[i].pitches).toEqual(music1.notes[i].pitches);
        expect(music2.notes[i].duration).toBe(music1.notes[i].duration);
        expect(music2.notes[i].durationModifier).toBe(
          music1.notes[i].durationModifier
        );
      }
    });

    it('round-trips a melody with dotted notes', () => {
      const original = `T:Test
M:4/4
L:1/8
K:C
C3 D |]`;
      const music1 = fromAbc(original);
      const exported = toAbc(music1);
      const music2 = fromAbc(exported);
      expect(music2.notes.length).toBe(music1.notes.length);
      for (let i = 0; i < music1.notes.length; i++) {
        expect(music2.notes[i].pitches).toEqual(music1.notes[i].pitches);
        expect(music2.notes[i].duration).toBe(music1.notes[i].duration);
        expect(music2.notes[i].durationModifier).toBe(
          music1.notes[i].durationModifier
        );
      }
    });
  });
});
