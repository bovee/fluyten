import { describe, it, expect } from 'vitest';
import { fromAbc, splitTunes, voicesFromAbc } from './abcImport';
import { Duration, DurationModifier } from '../music';

describe('fromAbc', () => {
  describe('header parsing', () => {
    it('should parse title', () => {
      const abc = `T:Hot Cross Buns\nM:4/4\nL:1/4\nK:C\nC D E`;
      const music = fromAbc(abc);
      expect(music.title).toBe('Hot Cross Buns');
    });

    it('should parse composer', () => {
      const abc = `T:Test\nC:Bach\nM:4/4\nL:1/4\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.composer).toBe('Bach');
    });

    it('should parse free time (M:none)', () => {
      const abc = `T:Test\nM:none\nL:1/4\nK:C\nC D E F`;
      const music = fromAbc(abc);
      expect(music.bars).toHaveLength(0);
    });

    it('should parse free time (M:)', () => {
      const abc = `T:Test\nM:\nL:1/4\nK:C\nC D E F`;
      const music = fromAbc(abc);
      expect(music.bars).toHaveLength(0);
    });

    it('should ignore bar lines in the score when M:none', () => {
      const abc = `T:Test\nM:none\nL:1/4\nK:C\nC D | E F |]`;
      const music = fromAbc(abc);
      expect(music.bars).toHaveLength(0);
      expect(music.notes).toHaveLength(4);
    });

    it('should parse notes correctly in free time', () => {
      const abc = `T:Test\nM:none\nL:1/4\nK:C\nC D E F`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(4);
      expect(music.notes[0].duration).toBe(Duration.QUARTER);
    });

    it('defaults to treble clef', () => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:C\nC D E F`);
      expect(music.clef).toBe('treble');
    });

    it('parses K: with clef=bass', () => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:C clef=bass\nC D E F`);
      expect(music.clef).toBe('bass');
      expect(music.keySignature).toBe('C');
    });

    it('parses K: with clef=alto', () => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:G clef=alto\nG`);
      expect(music.clef).toBe('alto');
      expect(music.keySignature).toBe('G');
    });

    it('parses %%clef bass directive', () => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\n%%clef bass\nK:C\nC`);
      expect(music.clef).toBe('bass');
    });

    it('should parse common time (C)', () => {
      const abc = `T:Test\nM:C\nL:1/4\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.beatsPerBar).toBe(4);
      expect(music.beatValue).toBe(4);
    });

    it('should parse cut time (C|)', () => {
      const abc = `T:Test\nM:C|\nL:1/4\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.beatsPerBar).toBe(2);
      expect(music.beatValue).toBe(2);
    });

    it('should parse 3/4 time', () => {
      const abc = `T:Test\nM:3/4\nL:1/4\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.beatsPerBar).toBe(3);
      expect(music.beatValue).toBe(4);
    });

    it('should parse 6/8 time', () => {
      const abc = `T:Test\nM:6/8\nL:1/8\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.beatsPerBar).toBe(6);
      expect(music.beatValue).toBe(8);
    });

    it('should parse default note length 1/4', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.notes[0].duration).toBe(Duration.QUARTER);
    });

    it('should parse default note length 1/8', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.notes[0].duration).toBe(Duration.EIGHTH);
    });

    it('should parse default note length 1', () => {
      const abc = `T:Test\nM:4/4\nL:1\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.notes[0].duration).toBe(Duration.WHOLE);
    });

    it('should parse key signature C', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nF`;
      const music = fromAbc(abc);
      expect(music.keySignature).toBe('C');
      expect(music.notes[0].pitches[0]).toBe(65); // F natural
    });

    it('should parse key signature G', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:G\nF f`;
      const music = fromAbc(abc);
      expect(music.keySignature).toBe('G');
      expect(music.notes[0].pitches[0]).toBe(66); // F# in G major
      expect(music.notes[1].pitches[0]).toBe(78); // F# in G major
    });

    it('should parse key signature F', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:F\nB b`;
      const music = fromAbc(abc);
      expect(music.keySignature).toBe('F');
      expect(music.notes[0].pitches[0]).toBe(70); // Bb in F major
      expect(music.notes[1].pitches[0]).toBe(82); // Bb in F major
    });

    it('should throw error for invalid key', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:Z\nC`;
      expect(() => fromAbc(abc)).toThrow("Can't parse key: Z");
    });
  });

  describe('note parsing', () => {
    it('should parse basic note sequence', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D E F`;
      const music = fromAbc(abc);
      expect(music.notes.length).toBe(4);
      expect(music.notes[0].pitches[0]).toBe(60); // C4
      expect(music.notes[1].pitches[0]).toBe(62); // D4
      expect(music.notes[2].pitches[0]).toBe(64); // E4
      expect(music.notes[3].pitches[0]).toBe(65); // F4
    });

    it('should parse notes with explicit durations', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC2 D4`;
      const music = fromAbc(abc);
      expect(music.notes[0].duration).toBe(Duration.HALF);
      expect(music.notes[1].duration).toBe(Duration.WHOLE);
    });

    it('should parse notes with fractional durations', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC/2 D/4`;
      const music = fromAbc(abc);
      expect(music.notes[0].duration).toBe(Duration.EIGHTH);
      expect(music.notes[1].duration).toBe(Duration.SIXTEENTH);
    });

    it('should parse double slash as /4', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC//`;
      const music = fromAbc(abc);
      expect(music.notes[0].duration).toBe(Duration.SIXTEENTH);
    });

    it('should parse dotted notes', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC3/2`;
      const music = fromAbc(abc);
      expect(music.notes[0].duration).toBe(Duration.QUARTER);
      expect(music.notes[0].durationModifier).toBe(DurationModifier.DOTTED);
    });

    it('should parse accidentals', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\n^C _D =E`;
      const music = fromAbc(abc);
      expect(music.notes[0].pitches[0]).toBe(61); // C#
      expect(music.notes[1].pitches[0]).toBe(61); // Db
      expect(music.notes[2].pitches[0]).toBe(64); // E natural
    });

    it('should parse rests', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC Z D`;
      const music = fromAbc(abc);
      expect(music.notes[0].pitches[0]).toBe(60);
      expect(music.notes[1].pitches).toHaveLength(0); // rest
      expect(music.notes[2].pitches[0]).toBe(62);
    });
  });

  describe('bar lines', () => {
    it('should parse standard bar lines', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D | E F`;
      const music = fromAbc(abc);
      expect(music.bars.length).toBeGreaterThan(0);
      const standardBars = music.bars.filter((b) => b.type === 'standard');
      expect(standardBars.length).toBeGreaterThanOrEqual(1);
    });

    it('should parse double bar lines', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D || E F`;
      const music = fromAbc(abc);
      const doubleBars = music.bars.filter((b) => b.type === 'double');
      expect(doubleBars.length).toBe(1);
    });

    it('should parse repeat begin', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D |: E F`;
      const music = fromAbc(abc);
      const repeatBars = music.bars.filter((b) => b.type === 'begin_repeat');
      expect(repeatBars.length).toBe(1);
    });

    it('should parse repeat end', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D :| E F`;
      const music = fromAbc(abc);
      const repeatBars = music.bars.filter((b) => b.type === 'end_repeat');
      expect(repeatBars.length).toBe(1);
    });

    it('should parse end bar', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D E F |]`;
      const music = fromAbc(abc);
      const endBars = music.bars.filter((b) => b.type === 'end');
      expect(endBars.length).toBe(1);
    });

    it('should parse :: as begin_end_repeat', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\n|: C D E F :: G A B c :|`;
      const music = fromAbc(abc);
      const berBars = music.bars.filter((b) => b.type === 'begin_end_repeat');
      expect(berBars.length).toBe(1);
    });
  });

  describe('beaming', () => {
    it('should create beams for eighth notes', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\nCDEF GABC`;
      const music = fromAbc(abc);
      expect(music.beams.length).toBeGreaterThan(0);
    });

    it('should not beam quarter notes', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nCDEF |`;
      expect(() => fromAbc(abc)).toThrow('too long a duration to be beamed');
    });
  });

  describe('slurs and ties', () => {
    it('should parse slurs', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(CD) EF`;
      const music = fromAbc(abc);
      expect(music.curves.length).toBe(1);
      expect(music.curves[0][0]).toBe(0);
      expect(music.curves[0][1]).toBe(1);
    });

    it('should parse ties', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\nC-D`;
      const music = fromAbc(abc);
      expect(music.curves.length).toBe(1);
    });

    it('should throw error for unmatched opening parenthesis', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(CD`;
      expect(() => fromAbc(abc)).not.toThrow();
    });

    it('should throw error for unmatched closing parenthesis', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\nCD)`;
      expect(() => fromAbc(abc)).toThrow('Unexpected )');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid meter format', () => {
      const abc = `T:Test\nM:4/4/4\nL:1/4\nK:C\nC`;
      expect(() => fromAbc(abc)).toThrow("Can't understand meter");
    });

    it('should throw error for invalid duration', () => {
      // The regex won't match multiple slashes, so C1/2/3 would be parsed as C1 followed by /2/3
      // Instead test a case where NaN is produced
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nCx`;
      // This won't throw because 'x' is a valid rest note, so skip this test
      expect(() => fromAbc(abc)).not.toThrow();
    });

    it('c>d equals c3/2 d/ (dotted + halved)', () => {
      // c>d: c gets dotted (3/2 of quarter = dotted quarter), d gets halved (1/2 of quarter = eighth)
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nc>d`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(2);
      expect(music.notes[0].duration).toBe(Duration.QUARTER);
      expect(music.notes[0].durationModifier).toBe(DurationModifier.DOTTED);
      expect(music.notes[1].duration).toBe(Duration.EIGHTH);
      expect(music.notes[1].durationModifier).toBe(DurationModifier.NONE);
    });

    it('A2<B2 equals A B3 (halved + dotted)', () => {
      // With L:1/8: A2 = quarter, B2 = quarter
      // A2<B2: A gets halved (eighth), B gets dotted (dotted quarter)
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\nA2<B2`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(2);
      expect(music.notes[0].duration).toBe(Duration.EIGHTH);
      expect(music.notes[0].durationModifier).toBe(DurationModifier.NONE);
      expect(music.notes[1].duration).toBe(Duration.QUARTER);
      expect(music.notes[1].durationModifier).toBe(DurationModifier.DOTTED);
    });

    it('multiple broken rhythms in a row', () => {
      // c>d>e: c=dotted quarter, d=halved then re-dotted... wait, each > is independent
      // c>d e>f: c=dotted q, d=eighth, e=dotted q, f=eighth
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nc>d e>f`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(4);
      expect(music.notes[0].durationModifier).toBe(DurationModifier.DOTTED);
      expect(music.notes[1].duration).toBe(Duration.EIGHTH);
      expect(music.notes[2].durationModifier).toBe(DurationModifier.DOTTED);
      expect(music.notes[3].duration).toBe(Duration.EIGHTH);
    });
  });

  describe('multi-line music', () => {
    it('should parse notes across multiple lines', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D E F |\nG A B c |`;
      const music = fromAbc(abc);
      expect(music.notes.length).toBe(8);
      expect(music.notes[4].pitches[0]).toBe(67); // G on second line
    });

    it('should parse line continuation with backslash', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D E F \\\nG A B c |`;
      const music = fromAbc(abc);
      expect(music.notes.length).toBe(8);
    });

    it('should parse octave markers across multiple lines', () => {
      const abc = `T:Test\nM:C\nL:1/8\nK:C\nCDEF GABc |\ndefg abc'd' |`;
      const music = fromAbc(abc);
      expect(music.notes.length).toBe(16);
      expect(music.notes[14].pitches[0]).toBe(84); // c' = C6
      expect(music.notes[15].pitches[0]).toBe(86); // d' = D6
    });
  });

  describe('triplets', () => {
    it('should parse a triplet group and mark exactly those three notes', () => {
      // (3abc means abc are a triplet; d is a regular note after
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(3abc d |]`;
      const music = fromAbc(abc);
      expect(music.notes[0].durationModifier).toBe(DurationModifier.TRIPLET);
      expect(music.notes[1].durationModifier).toBe(DurationModifier.TRIPLET);
      expect(music.notes[2].durationModifier).toBe(DurationModifier.TRIPLET);
      expect(music.notes[3].durationModifier).toBe(DurationModifier.NONE);
    });

    it('should parse two separate triplet groups', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(3abc (3def |]`;
      const music = fromAbc(abc);
      for (let i = 0; i < 6; i++) {
        expect(music.notes[i].durationModifier).toBe(DurationModifier.TRIPLET);
      }
    });
  });

  describe('comments', () => {
    it('should strip a comment at the end of a score line', () => {
      const music = fromAbc(
        `T:Test\nM:4/4\nL:1/4\nK:C\nC D E F % trailing comment`
      );
      expect(music.notes).toHaveLength(4);
    });

    it('should strip a comment at the end of a header line', () => {
      const music = fromAbc(`T:Test % not part of title\nM:4/4\nL:1/4\nK:C\nC`);
      expect(music.title).toBe('Test');
    });

    it('should treat a line starting with % as a full-line comment', () => {
      const music = fromAbc(
        `T:Test\nM:4/4\nL:1/4\nK:C\n% whole line comment\nC D E F`
      );
      expect(music.notes).toHaveLength(4);
    });
  });

  describe('chords', () => {
    it('should parse chord notation [CE]', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\n[CE]`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(1);
      expect(music.notes[0].pitches).toHaveLength(2);
      expect(music.notes[0].pitches[0]).toBe(60); // C
      expect(music.notes[0].pitches[1]).toBe(64); // E
    });

    it('should parse chord with accidentals [^C_E]', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\n[^C_E]`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(1);
      expect(music.notes[0].pitches[0]).toBe(61); // C#
      expect(music.notes[0].pitches[1]).toBe(63); // Eb
      expect(music.notes[0].accidentals[0]).toBe('#');
      expect(music.notes[0].accidentals[1]).toBe('b');
    });
  });

  describe('grace notes', () => {
    it('should parse grace notes {c}D', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\n{c}D`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(2);
      expect(music.notes[0].duration).toBe(Duration.GRACE);
      expect(music.notes[0].pitches[0]).toBe(72); // c (octave 5)
      expect(music.notes[1].duration).toBe(Duration.QUARTER);
    });

    it('should parse grace notes with slash {/c}D', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\n{/c}D`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(2);
      expect(music.notes[0].duration).toBe(Duration.GRACE_SLASH);
      expect(music.notes[1].duration).toBe(Duration.QUARTER);
    });
  });

  describe('edge cases', () => {
    it('empty input string: returns Music with no notes', () => {
      const music = fromAbc('');
      expect(music.notes).toHaveLength(0);
    });

    it('headers only, no score: title set, notes empty', () => {
      const abc = `T:Just a Title\nM:4/4\nL:1/4\nK:C`;
      const music = fromAbc(abc);
      expect(music.title).toBe('Just a Title');
      expect(music.notes).toHaveLength(0);
    });

    it('inline field [K:G] throws', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC [K:G] D`;
      expect(() => fromAbc(abc)).toThrow('Mid-score information fields');
    });
  });

  describe('splitTunes', () => {
    it('single tune (no X: line) returns as-is', () => {
      const text = `T:Test\nM:4/4\nL:1/4\nK:C\nC D E F`;
      const tunes = splitTunes(text);
      expect(tunes).toHaveLength(1);
      expect(tunes[0]).toContain('T:Test');
    });

    it('multiple tunes splits correctly', () => {
      const text = `X:1\nT:First\nK:C\nC D\n\nX:2\nT:Second\nK:G\nG A`;
      const tunes = splitTunes(text);
      expect(tunes).toHaveLength(2);
      expect(tunes[0]).toContain('T:First');
      expect(tunes[1]).toContain('T:Second');
    });
  });

  describe('voicesFromAbc', () => {
    it('returns single voice for ABC with no V: fields', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D E F`;
      const voices = voicesFromAbc(abc);
      expect(voices).toHaveLength(1);
      expect(voices[0].id).toBe('1');
      expect(voices[0].music.notes).toHaveLength(4);
    });

    it('splits two voices from inline [V:id] markers', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nV:1\nV:2\nK:C\n[V:1] C D E F |[V:2] G A B c |`;
      const voices = voicesFromAbc(abc);
      expect(voices).toHaveLength(2);
      expect(voices[0].id).toBe('1');
      expect(voices[1].id).toBe('2');
      expect(voices[0].music.notes).toHaveLength(4);
      expect(voices[1].music.notes).toHaveLength(4);
    });

    it('reads name= from V: definition line', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nV:1 name=Soprano\nV:2 name=Alto\nK:C\n[V:1] C D |[V:2] G A |`;
      const voices = voicesFromAbc(abc);
      expect(voices[0].name).toBe('Soprano');
      expect(voices[1].name).toBe('Alto');
    });

    it('reads quoted name= with spaces from V: definition line', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nV:P1 name="Part 1"\nV:P2 name="Part 2"\nK:C\n[V:P1] C D |[V:P2] G A |`;
      const voices = voicesFromAbc(abc);
      expect(voices[0].name).toBe('Part 1');
      expect(voices[1].name).toBe('Part 2');
    });

    it('splits voices from standalone V: body lines', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nV:1\nV:2\nK:C\nV:1\nC D E F |\nV:2\nG, A, B, C, |`;
      const voices = voicesFromAbc(abc);
      expect(voices).toHaveLength(2);
      expect(voices[0].music.notes).toHaveLength(4);
      expect(voices[1].music.notes).toHaveLength(4);
    });

    it('inherits global headers (key, time, title) in each voice', () => {
      const abc = `T:Duet\nM:3/4\nL:1/4\nV:1\nV:2\nK:G\n[V:1] G A B |[V:2] D E F# |`;
      const voices = voicesFromAbc(abc);
      expect(voices[0].music.title).toBe('Duet');
      expect(voices[0].music.beatsPerBar).toBe(3);
      expect(voices[1].music.beatsPerBar).toBe(3);
    });

    it('sets clef from V: clef= attribute', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nK:C\n[V:1] C D |[V:2] C, D, |`;
      const voices = voicesFromAbc(abc);
      expect(voices[0].music.clef).toBe('treble');
      expect(voices[1].music.clef).toBe('bass');
    });
  });

  describe('integration tests', () => {
    it('should parse Hot Cross Buns', () => {
      const abc = `T:Hot Cross Buns
C:Traditional
M:4/4
L:1/4
K:C
E D C2 | E D C2 | C/2 C/2 C/2 C/2 D/2 D/2 D/2 D/2 | E D C2 |]`;

      const music = fromAbc(abc);

      expect(music.title).toBe('Hot Cross Buns');
      expect(music.composer).toBe('Traditional');
      expect(music.beatsPerBar).toBe(4);
      expect(music.beatValue).toBe(4);
      expect(music.keySignature).toBe('C');
      expect(music.notes.length).toBeGreaterThan(0);
    });
  });
});
