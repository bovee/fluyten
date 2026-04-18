import { describe, it, expect } from 'vitest';
import { toAbc, reflowAbc } from './abcExport';
import { fromAbc } from './abcImport';
import { Music, Note, Duration } from '../music';

describe('toAbc', () => {
  describe('headers', () => {
    it('should emit title', () => {
      const music = new Music();
      music.title = 'Hot Cross Buns';
      music.signatures[0].keySignature = 'C';
      expect(toAbc(music)).toContain('T:Hot Cross Buns');
    });

    it('should emit composer', () => {
      const music = new Music();
      music.composer = 'Bach';
      music.signatures[0].keySignature = 'C';
      expect(toAbc(music)).toContain('C:Bach');
    });

    it('should omit composer line when absent', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      expect(toAbc(music)).not.toContain('C:');
    });

    it('should emit time signature', () => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 3;
      music.signatures[0].beatValue = 4;
      music.signatures[0].keySignature = 'C';
      expect(toAbc(music)).toContain('M:3/4');
    });

    it('should always emit L:1/8', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      expect(toAbc(music)).toContain('L:1/8');
    });

    it('should emit key signature', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'G';
      expect(toAbc(music)).toContain('K:G');
    });
  });

  describe('note durations', () => {
    function singleNoteAbc(duration: Duration, dots = 0): string {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(60, duration, [], undefined, dots)];
      return toAbc(music);
    }

    it.each<[Duration, number, string | RegExp]>([
      [Duration.WHOLE, 0, 'C8'],
      [Duration.HALF, 0, 'C4'],
      [Duration.QUARTER, 0, 'C2'],
      [Duration.EIGHTH, 0, /C[^0-9]/],
      [Duration.SIXTEENTH, 0, 'C/2'],
      [Duration.HALF, 1, 'C6'],
      [Duration.QUARTER, 1, 'C3'],
      [Duration.EIGHTH, 1, 'C3/2'],
      [Duration.SIXTEENTH, 1, 'C3/4'],
      [Duration.THIRTY_SECOND, 0, 'C/4'],
    ])('encodes %s with %i dot(s)', (duration, dots, expected) => {
      const abc = singleNoteAbc(duration, dots);
      if (typeof expected === 'string') expect(abc).toContain(expected);
      else expect(abc).toMatch(expected);
    });
  });

  describe('pitch encoding', () => {
    it.each<[number, string, string]>([
      [48, 'C3', 'C,'],
      [60, 'C4', 'C'],
      [72, 'C5', 'c'],
      [84, 'C6', "c'"],
    ])('encodes MIDI %i (%s)', (pitch, _label, expected) => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(pitch, Duration.EIGHTH)];
      expect(toAbc(music)).toContain(expected);
    });

    it('encodes sharp with ^ prefix', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(61, Duration.EIGHTH, [], '#')]; // C#4 = app octave 3 = uppercase
      expect(toAbc(music)).toContain('^C');
    });

    it('encodes flat with _ prefix', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(70, Duration.EIGHTH, [], 'b')]; // Bb4 = app octave 3 = uppercase
      expect(toAbc(music)).toContain('_B');
    });

    it('encodes half-sharp with ^/ prefix', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(60.5, Duration.EIGHTH, [], 'd#')]; // C half-sharp
      expect(toAbc(music)).toContain('^/C');
    });

    it('encodes half-flat with _/ prefix', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(59.5, Duration.EIGHTH, [], 'db')]; // C half-flat
      expect(toAbc(music)).toContain('_/C');
    });

    it('encodes three-quarter-tone sharp with ^3/ prefix', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(61.5, Duration.EIGHTH, [], '3d#')]; // C three-quarter-sharp
      expect(toAbc(music)).toContain('^3/C');
    });

    it('encodes three-quarter-tone flat with _3/ prefix', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(58.5, Duration.EIGHTH, [], '3db')]; // C three-quarter-flat
      expect(toAbc(music)).toContain('_3/C');
    });

    it('encodes rest as z', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(undefined, Duration.QUARTER)];
      expect(toAbc(music)).toContain('z');
    });
  });

  describe('bar lines', () => {
    it.each([
      ['standard', '|'],
      ['end', '|]'],
      ['begin_repeat', '|:'],
      ['end_repeat', ':|'],
      ['begin_end_repeat', '::'],
    ] as const)('emits %s bar line', (type, expected) => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
      ];
      music.bars = [{ afterNoteNum: 0, type }];
      expect(toAbc(music)).toContain(expected);
    });
  });

  describe('decorations', () => {
    it.each([
      [['staccato'], '.'],
      [['fermata'], '!fermata!'],
      [['trill'], '!trill!'],
      [['pp'], '!pp!'],
    ] as const)('emits %s', (decorations, expected) => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(60, Duration.QUARTER, [...decorations])];
      expect(toAbc(music)).toContain(expected);
    });
  });

  describe('beams', () => {
    it('groups beamed notes without spaces', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
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
      music.signatures[0].keySignature = 'C';
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
      music.signatures[0].keySignature = 'C';
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
      music.signatures[0].keySignature = 'C';
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
      music.signatures[0].keySignature = 'C';
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
      music.signatures[0].keySignature = 'C';
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
      music.signatures[0].keySignature = 'C';
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
      music.signatures[0].keySignature = 'C';
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
      music.signatures[0].keySignature = 'C';
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
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note([60, 64, 67], Duration.QUARTER)];
      const abc = toAbc(music);
      expect(abc).toContain('[');
      expect(abc).toContain(']');
    });
  });

  describe('bass clef', () => {
    it('exports clef=bass in K: line', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.clef = 'bass';
      const abc = toAbc(music);
      expect(abc).toContain('K:C clef=bass');
    });

    it('exports treble8va clef as clef=treble+8', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.clef = 'treble8va';
      const abc = toAbc(music);
      expect(abc).toContain('clef=treble+8');
    });

    it('exports bass8va clef as clef=bass+8', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.clef = 'bass8va';
      const abc = toAbc(music);
      expect(abc).toContain('clef=bass+8');
    });
  });

  describe('time signature variants', () => {
    it('exports common time (C) when commonTime flag is set', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.signatures[0].commonTime = true;
      const abc = toAbc(music);
      expect(abc).toContain('M:C');
      expect(abc).not.toContain('M:4/4');
    });

    it('exports cut time (C|) when commonTime + beatValue=2', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.signatures[0].beatsPerBar = 2;
      music.signatures[0].beatValue = 2;
      music.signatures[0].commonTime = true;
      const abc = toAbc(music);
      expect(abc).toContain('M:C|');
    });
  });

  describe('tempo', () => {
    it('exports Q: line when tempo is set', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.signatures[0].tempo = 120;
      const abc = toAbc(music);
      expect(abc).toContain('Q:1/4=120');
    });

    it('exports Q: line with tempo text label', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.signatures[0].tempo = 96;
      music.signatures[0].tempoText = 'Andante';
      const abc = toAbc(music);
      expect(abc).toContain('Q:"Andante" 1/4=96');
    });

    it('omits Q: line when tempo is undefined', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      const abc = toAbc(music);
      expect(abc).not.toContain('Q:');
    });
  });

  describe('lyrics', () => {
    it('exports W: lines for endLyrics', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [new Note(60, Duration.QUARTER)];
      music.endLyrics = 'verse one\nverse two';
      const abc = toAbc(music);
      expect(abc).toContain('W:verse one');
      expect(abc).toContain('W:verse two');
    });

    it('exports w: lines with hyphenated syllables without spaces between them', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
      ];
      music.lyrics = [['hel-', 'lo', 'world']];
      const abc = toAbc(music);
      // "hel-" followed immediately by "lo" (no space), then " world"
      expect(abc).toContain('w:hel-lo world');
    });
  });

  describe('tuplets', () => {
    it('exports a triplet group with (3 prefix', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      const tuplet = { actual: 3, written: 2, groupSize: 3 };
      music.notes = [
        Object.assign(new Note(60, Duration.EIGHTH), { tuplet }),
        Object.assign(new Note(62, Duration.EIGHTH), { tuplet }),
        Object.assign(new Note(64, Duration.EIGHTH), { tuplet }),
      ];
      const abc = toAbc(music);
      expect(abc).toContain('(3');
    });

    it('exports a duplet with (2 prefix', () => {
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      const tuplet = { actual: 2, written: 3, groupSize: 2 };
      music.notes = [
        Object.assign(new Note(60, Duration.QUARTER), { tuplet }),
        Object.assign(new Note(62, Duration.QUARTER), { tuplet }),
      ];
      const abc = toAbc(music);
      expect(abc).toContain('(2');
    });

    it('round-trips a simple triplet', () => {
      const original = `T:Test\nM:4/4\nL:1/8\nK:C\n(3abc |]`;
      const music1 = fromAbc(original);
      const exported = toAbc(music1);
      const music2 = fromAbc(exported);
      expect(music2.notes).toHaveLength(3);
      for (const note of music2.notes) {
        expect(note.tuplet).toBeDefined();
        expect(note.tuplet?.actual).toBe(3);
        expect(note.tuplet?.written).toBe(2);
        expect(note.tuplet?.groupSize).toBe(3);
      }
    });

    it('round-trips a (p:q:r) tuplet', () => {
      const original = `T:Test\nM:4/4\nL:1/8\nK:C\n(3:2:4 G2A2Bc |]`;
      const music1 = fromAbc(original);
      const exported = toAbc(music1);
      const music2 = fromAbc(exported);
      expect(music2.notes).toHaveLength(4);
      for (const note of music2.notes) {
        expect(note.tuplet?.actual).toBe(3);
        expect(note.tuplet?.written).toBe(2);
        expect(note.tuplet?.groupSize).toBe(4);
      }
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
      expect(music2.signatures[0].keySignature).toBe(
        music1.signatures[0].keySignature
      );
      expect(music2.signatures[0].beatsPerBar).toBe(
        music1.signatures[0].beatsPerBar
      );
      expect(music2.notes.length).toBe(music1.notes.length);
      for (let i = 0; i < music1.notes.length; i++) {
        expect(music2.notes[i].pitches).toEqual(music1.notes[i].pitches);
        expect(music2.notes[i].duration).toBe(music1.notes[i].duration);
        expect(music2.notes[i].dots).toBe(music1.notes[i].dots);
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
        expect(music2.notes[i].dots).toBe(music1.notes[i].dots);
      }
    });
  });
});

describe('reflowAbc', () => {
  it('round-trips a single-voice tune', () => {
    const original = `T:Test
M:4/4
L:1/8
K:C
E2 D2 C4 |]`;
    const result = reflowAbc(original);
    const music = fromAbc(result);
    expect(music.title).toBe('Test');
    expect(music.notes).toHaveLength(3);
  });

  it('handles a multi-voice tune by reflowing each voice', () => {
    const original = `T:Two Voices
M:4/4
L:1/4
K:C
V:1
C D E F |]
V:2
G A B c |]`;
    const result = reflowAbc(original);
    // Both voices should be present in the output
    expect(result).toContain('V:1');
    expect(result).toContain('V:2');
    // Global headers should be preserved
    expect(result).toContain('T:Two Voices');
    // Re-parsing each voice should give correct notes
    const music1 = fromAbc(
      result.split('V:2')[0] +
        'K:C\n' +
        result.split('V:1\n')[1].split('V:2')[0]
    );
    expect(music1.notes.length).toBeGreaterThan(0);
  });

  it('preserves notes when bar lines are already correct', () => {
    const original = `T:Test
M:4/4
L:1/4
K:G
G A B c |]`;
    const result = reflowAbc(original);
    const music = fromAbc(result);
    expect(music.signatures[0].keySignature).toBe('G');
    expect(music.notes).toHaveLength(4);
    expect(music.notes[0].pitches).toEqual([67]); // G
  });
});
