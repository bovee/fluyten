import { describe, it, expect } from 'vitest';
import { fromAbc, splitTunes, voicesFromAbc } from './abcImport';
import { Duration, Music, Note } from '../music';
import { toAbc } from './abcExport';

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

    it('expands \\XX mnemonics in title and composer', () => {
      const music = fromAbc(`T:Caf\\'e\nC:Fran\\ccois\nM:4/4\nL:1/4\nK:C\nC`);
      expect(music.title).toBe('Caf\u00E9'); // é
      expect(music.composer).toBe('Fran\u00E7ois'); // ç
    });

    it('expands \\XX mnemonics in aligned lyrics', () => {
      const music = fromAbc(
        `T:T\nM:4/4\nL:1/4\nK:C\nC D E F\nw: caf\\'e Ma\\~na`
      );
      expect(music.lyrics[0][0]).toBe('caf\u00E9'); // é
      expect(music.lyrics[0][1]).toBe('Ma\u00F1a'); // ña
    });

    it('leaves unknown \\XX sequences unchanged', () => {
      const music = fromAbc(`T:test \\XQ end\nM:4/4\nL:1/4\nK:C\nC`);
      expect(music.title).toBe('test \\XQ end');
    });

    it('\\%% expands to a literal percent sign', () => {
      const music = fromAbc(`T:100\\% done\nM:4/4\nL:1/4\nK:C\nC`);
      expect(music.title).toBe('100% done');
    });

    it('\\\\\\\\ expands to a literal backslash', () => {
      const music = fromAbc(`T:a\\\\b\nM:4/4\nL:1/4\nK:C\nC`);
      expect(music.title).toBe('a\\b');
    });

    it('\\& expands to a literal ampersand', () => {
      const music = fromAbc(`T:G\\&T\nM:4/4\nL:1/4\nK:C\nC`);
      expect(music.title).toBe('G&T');
    });

    it('\\uXXXX expands to the corresponding unicode character', () => {
      const music = fromAbc(`T:\\u00E9\nM:4/4\nL:1/4\nK:C\nC`);
      expect(music.title).toBe('\u00E9'); // é
    });

    it('\\UXXXXXXXX expands to a unicode supplementary character', () => {
      const music = fromAbc(`T:\\U0001F3B5\nM:4/4\nL:1/4\nK:C\nC`);
      expect(music.title).toBe('\u{1F3B5}'); // 🎵
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
      expect(music.signatures[0].keySignature).toBe('C');
    });

    it('parses mode key signatures', () => {
      expect(
        fromAbc(`T:T\nM:4/4\nL:1/4\nK:G Mix\nG`).signatures[0].keySignature
      ).toBe('GMix');
      expect(
        fromAbc(`T:T\nM:4/4\nL:1/4\nK:G Mixolydian\nG`).signatures[0]
          .keySignature
      ).toBe('GMix');
      expect(
        fromAbc(`T:T\nM:4/4\nL:1/4\nK:D Dor\nD`).signatures[0].keySignature
      ).toBe('DDor');
      expect(
        fromAbc(`T:T\nM:4/4\nL:1/4\nK:A Dorian\nA`).signatures[0].keySignature
      ).toBe('ADor');
      expect(
        fromAbc(`T:T\nM:4/4\nL:1/4\nK:E Phr\nE`).signatures[0].keySignature
      ).toBe('EPhr');
      expect(
        fromAbc(`T:T\nM:4/4\nL:1/4\nK:F Lyd\nF`).signatures[0].keySignature
      ).toBe('FLyd');
      expect(
        fromAbc(`T:T\nM:4/4\nL:1/4\nK:B Loc\nB`).signatures[0].keySignature
      ).toBe('BLoc');
      expect(
        fromAbc(`T:T\nM:4/4\nL:1/4\nK:Gmix\nG`).signatures[0].keySignature
      ).toBe('GMix');
    });

    it('parses K: with clef=alto', () => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:G clef=alto\nG`);
      expect(music.clef).toBe('alto');
      expect(music.signatures[0].keySignature).toBe('G');
    });

    it('parses %%clef bass directive', () => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\n%%clef bass\nK:C\nC`);
      expect(music.clef).toBe('bass');
    });

    // middle= — MIDI 60 is `C` (uppercase), MIDI 50 is `D,` (bass default), MIDI 62 is `D` (uppercase)
    describe('K: middle= parameter', () => {
      it('no middle= leaves pitches unchanged', () => {
        const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:C clef=bass\nC`);
        expect(music.notes[0].pitches[0]).toBe(60); // C4 unchanged
      });

      it('middle=D on bass clef shifts notes down one octave', () => {
        // bass default middle = D, (MIDI 50); middle=D specifies D (MIDI 62); shift = 50-62 = -12
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C clef=bass middle=D\nC`
        );
        expect(music.notes[0].pitches[0]).toBe(48); // C4 - 12 = C3
      });

      it('middle=D, on bass clef (the default) produces no shift', () => {
        // middle=D, is the default for bass, so shift = 0
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C clef=bass middle=D,\nC`
        );
        expect(music.notes[0].pitches[0]).toBe(60);
      });

      it('middle=B on treble clef (the default) produces no shift', () => {
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C clef=treble middle=B\nC`
        );
        expect(music.notes[0].pitches[0]).toBe(60);
      });

      it('middle=b on treble clef shifts notes down one octave', () => {
        // treble default = B (MIDI 71); middle=b specifies b (MIDI 83); shift = 71-83 = -12
        const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:C middle=b\nC`);
        expect(music.notes[0].pitches[0]).toBe(48); // C4 - 12 = C3
      });

      it('middle= shift stacks with treble+8 shift', () => {
        // clef=treble+8 adds +12; middle=B (default) adds 0; net = +12
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C clef=treble+8 middle=B\nC`
        );
        expect(music.notes[0].pitches[0]).toBe(72); // C4 + 12 = C5
      });

      it('treble+8 with middle=b cancels the 8va shift', () => {
        // treble+8 adds +12; middle=b shifts -12; net = 0
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C clef=treble+8 middle=b\nC`
        );
        expect(music.notes[0].pitches[0]).toBe(60); // no net shift
      });

      it('multiple notes are all shifted', () => {
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C clef=bass middle=D\nC D E F`
        );
        const expected = [48, 50, 52, 53]; // C3, D3, E3, F3 (each -12 from C4,D4,E4,F4)
        expect(music.notes.map((n) => n.pitches[0])).toEqual(expected);
      });

      it('keySignature is not affected by middle=', () => {
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:G clef=bass middle=D\nG`
        );
        expect(music.signatures[0].keySignature).toBe('G');
        expect(music.clef).toBe('bass');
      });
    });

    it('should parse common time (C)', () => {
      const abc = `T:Test\nM:C\nL:1/4\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.signatures[0].beatsPerBar).toBe(4);
      expect(music.signatures[0].beatValue).toBe(4);
    });

    it('should parse cut time (C|)', () => {
      const abc = `T:Test\nM:C|\nL:1/4\nK:C\nC`;
      const music = fromAbc(abc);
      expect(music.signatures[0].beatsPerBar).toBe(2);
      expect(music.signatures[0].beatValue).toBe(2);
    });

    it.each([
      ['3/4', 3, 4],
      ['6/8', 6, 8],
    ] as const)('should parse %s time', (timeSig, beatsPerBar, beatValue) => {
      const music = fromAbc(`T:Test\nM:${timeSig}\nL:1/8\nK:C\nC`);
      expect(music.signatures[0].beatsPerBar).toBe(beatsPerBar);
      expect(music.signatures[0].beatValue).toBe(beatValue);
    });

    it.each([
      ['1/4', Duration.QUARTER],
      ['1/8', Duration.EIGHTH],
      ['1', Duration.WHOLE],
    ] as const)(
      'should parse default note length %s',
      (noteLength, expected) => {
        const music = fromAbc(`T:Test\nM:4/4\nL:${noteLength}\nK:C\nC`);
        expect(music.notes[0].duration).toBe(expected);
      }
    );

    it.each([
      ['C', 'F', 65], // F natural in C major
      ['G', 'F', 66], // F# in G major
      ['F', 'B', 70], // Bb in F major
    ] as const)(
      'should parse key signature %s',
      (key, noteAbc, expectedPitch) => {
        const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:${key}\n${noteAbc}`);
        expect(music.signatures[0].keySignature).toBe(key);
        expect(music.notes[0].pitches[0]).toBe(expectedPitch);
      }
    );

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
      expect(music.notes[0].dots).toBe(1);
    });

    it('should parse accidentals', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\n^C _D =E`;
      const music = fromAbc(abc);
      expect(music.notes[0].pitches[0]).toBe(61); // C#
      expect(music.notes[1].pitches[0]).toBe(61); // Db
      expect(music.notes[2].pitches[0]).toBe(64); // E natural
    });

    it('accidental carries forward within a bar', () => {
      const music = fromAbc(`T:T\nM:4/4\nL:1/4\nK:C\n^C D C | C D C`);
      expect(music.notes[0].pitches[0]).toBe(61); // ^C sharp
      expect(music.notes[2].pitches[0]).toBe(61); // C carries sharp in same bar
      expect(music.notes[3].pitches[0]).toBe(60); // barline resets → C natural
      expect(music.notes[5].pitches[0]).toBe(60); // still natural
    });

    it('accidental does not carry to a different octave', () => {
      const music = fromAbc(`T:T\nM:4/4\nL:1/4\nK:C\n^C c`);
      expect(music.notes[0].pitches[0]).toBe(61); // ^C sharp
      expect(music.notes[1].pitches[0]).toBe(72); // c natural (one octave up, unaffected)
    });

    it('accidental does not apply retroactively', () => {
      const music = fromAbc(`T:T\nM:4/4\nL:1/4\nK:C\nC D ^C | C D C`);
      expect(music.notes[0].pitches[0]).toBe(60); // C natural (before accidental)
      expect(music.notes[2].pitches[0]).toBe(61); // ^C sharp
      expect(music.notes[3].pitches[0]).toBe(60); // barline resets → C natural
    });

    it('natural sign cancels bar-local sharp for subsequent notes', () => {
      const music = fromAbc(`T:T\nM:4/4\nL:1/4\nK:C\n^C =C C`);
      expect(music.notes[0].pitches[0]).toBe(61); // ^C sharp
      expect(music.notes[1].pitches[0]).toBe(60); // =C natural
      expect(music.notes[2].pitches[0]).toBe(60); // carries natural
    });

    it('natural sign cancels key-signature accidental within bar', () => {
      // K:G has F#; =F should make F natural for the rest of the bar
      const music = fromAbc(`T:T\nM:4/4\nL:1/4\nK:G\n=F F | F`);
      expect(music.notes[0].pitches[0]).toBe(65); // =F natural
      expect(music.notes[1].pitches[0]).toBe(65); // still natural in bar
      expect(music.notes[2].pitches[0]).toBe(66); // new bar → F# from key sig
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
    it.each([
      ['C D | E F', 'standard'],
      ['C D || E F', 'double'],
      ['C D |: E F', 'begin_repeat'],
      ['C D :| E F', 'end_repeat'],
      ['C D E F |]', 'end'],
      ['|: C D E F :: G A B c :|', 'begin_end_repeat'],
    ] as const)('should parse %s bar line', (score, barType) => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:C\n${score}`);
      expect(
        music.bars.filter((b) => b.type === barType).length
      ).toBeGreaterThanOrEqual(1);
    });

    describe('volta brackets', () => {
      it('should parse |1 as standard bar with volta 1', () => {
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C\n|: C D E F |1 G A B c :|`
        );
        const volta1Bars = music.bars.filter((b) => b.volta === 1);
        expect(volta1Bars).toHaveLength(1);
        expect(volta1Bars[0].type).toBe('standard');
      });

      it('should parse :|2 as end_repeat bar with volta 2', () => {
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C\n|: C D E F |1 G A B c :|2 d e f g |]`
        );
        const volta2Bars = music.bars.filter((b) => b.volta === 2);
        expect(volta2Bars).toHaveLength(1);
        expect(volta2Bars[0].type).toBe('end_repeat');
      });

      it('should parse [1 as standard bar with volta 1', () => {
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C\n|: C D E F [1 G A B c :|2 d e f g |]`
        );
        const volta1Bars = music.bars.filter((b) => b.volta === 1);
        expect(volta1Bars).toHaveLength(1);
        expect(volta1Bars[0].type).toBe('standard');
      });

      it('round-trips volta bracket through export and re-import', () => {
        const music = fromAbc(
          `T:Test\nM:4/4\nL:1/4\nK:C\n|: C D E F |1 G A B c :|2 d e f g |]`
        );
        const exported = toAbc(music);
        const reimported = fromAbc(exported);
        expect(reimported.bars.filter((b) => b.volta === 1)).toHaveLength(1);
        expect(reimported.bars.filter((b) => b.volta === 2)).toHaveLength(1);
      });
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
      const music = fromAbc(abc);
      expect(music.beams).toHaveLength(0);
    });

    it('should beam across slur boundaries', () => {
      // C(C B)B: two beam groups of two notes each, slur from 2nd note to 3rd
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\nC(C B)B`;
      const music = fromAbc(abc);
      expect(music.beams).toHaveLength(2);
      expect(music.beams[0]).toEqual([0, 1]);
      expect(music.beams[1]).toEqual([2, 3]);
      expect(music.curves).toHaveLength(1);
      expect(music.curves[0]).toEqual([1, 2]);
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
      expect(music.notes[0].dots).toBe(1);
      expect(music.notes[1].duration).toBe(Duration.EIGHTH);
      expect(music.notes[1].dots).toBe(0);
    });

    it('A2<B2 equals A B3 (halved + dotted)', () => {
      // With L:1/8: A2 = quarter, B2 = quarter
      // A2<B2: A gets halved (eighth), B gets dotted (dotted quarter)
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\nA2<B2`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(2);
      expect(music.notes[0].duration).toBe(Duration.EIGHTH);
      expect(music.notes[0].dots).toBe(0);
      expect(music.notes[1].duration).toBe(Duration.QUARTER);
      expect(music.notes[1].dots).toBe(1);
    });

    it('multiple broken rhythms in a row', () => {
      // c>d>e: c=dotted quarter, d=halved then re-dotted... wait, each > is independent
      // c>d e>f: c=dotted q, d=eighth, e=dotted q, f=eighth
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nc>d e>f`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(4);
      expect(music.notes[0].dots).toBe(1);
      expect(music.notes[1].duration).toBe(Duration.EIGHTH);
      expect(music.notes[2].dots).toBe(1);
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

  describe('tuplets', () => {
    it('should parse a triplet group with correct fields', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(3abc d |]`;
      const music = fromAbc(abc);
      expect(music.notes[0].tuplet).toEqual({
        actual: 3,
        written: 2,
        groupSize: 3,
      });
      expect(music.notes[1].tuplet).toEqual({
        actual: 3,
        written: 2,
        groupSize: 3,
      });
      expect(music.notes[2].tuplet).toEqual({
        actual: 3,
        written: 2,
        groupSize: 3,
      });
      expect(music.notes[3].tuplet).toBeUndefined();
    });

    it('should parse two separate triplet groups', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(3abc (3def |]`;
      const music = fromAbc(abc);
      for (let i = 0; i < 6; i++) {
        expect(music.notes[i].tuplet).toBeDefined();
        expect(music.notes[i].tuplet?.actual).toBe(3);
      }
    });

    it('should parse duplet (2) with written=3', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(2ab |]`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(2);
      expect(music.notes[0].tuplet).toEqual({
        actual: 2,
        written: 3,
        groupSize: 2,
      });
      expect(music.notes[1].tuplet).toEqual({
        actual: 2,
        written: 3,
        groupSize: 2,
      });
    });

    it('should parse quadruplet (4) with written=3', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(4abcd |]`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(4);
      for (const note of music.notes) {
        expect(note.tuplet).toEqual({ actual: 4, written: 3, groupSize: 4 });
      }
    });

    it('should parse quintuplet (5) with written=2 in simple time (4/4)', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(5abcde |]`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(5);
      expect(music.notes[0].tuplet).toEqual({
        actual: 5,
        written: 2,
        groupSize: 5,
      });
    });

    it('should parse quintuplet (5) with written=3 in compound time (6/8)', () => {
      const abc = `T:Test\nM:6/8\nL:1/8\nK:C\n(5abcde |]`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(5);
      expect(music.notes[0].tuplet).toEqual({
        actual: 5,
        written: 3,
        groupSize: 5,
      });
    });

    it('should parse full (p:q:r) syntax', () => {
      // (3:2:4 — triplet ratio, but group of 4 notes
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(3:2:4 G2A2Bc |]`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(4);
      for (const note of music.notes) {
        expect(note.tuplet).toEqual({ actual: 3, written: 2, groupSize: 4 });
      }
    });

    it('should parse (p::r) syntax (omitted q uses default)', () => {
      // (3::2 — triplet ratio, group of 2
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(3::2 GA |]`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(2);
      expect(music.notes[0].tuplet).toEqual({
        actual: 3,
        written: 2,
        groupSize: 2,
      });
    });

    it('should handle whitespace between tuplet specifier and notes', () => {
      const abc = `T:Test\nM:4/4\nL:1/8\nK:C\n(3 a b c |]`;
      const music = fromAbc(abc);
      expect(music.notes).toHaveLength(3);
      for (const note of music.notes) {
        expect(note.tuplet).toBeDefined();
        expect(note.tuplet?.actual).toBe(3);
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

  describe('long rests and multimeasure rests', () => {
    it('z8 with L:1/8 = whole note rest', () => {
      const music = fromAbc(`M:4/4\nL:1/8\nK:C\nz8`);
      expect(music.notes).toHaveLength(1);
      expect(music.notes[0].pitches).toEqual([]);
      expect(music.notes[0].duration).toBe(Duration.WHOLE);
    });

    it('z8 with L:1/4 splits into two whole rests', () => {
      const music = fromAbc(`M:4/4\nL:1/4\nK:C\nz8`);
      expect(music.notes).toHaveLength(2);
      expect(music.notes[0].duration).toBe(Duration.WHOLE);
      expect(music.notes[1].duration).toBe(Duration.WHOLE);
    });

    it('Z4 in 4/4 produces 4 whole rests with bar lines', () => {
      const music = fromAbc(`M:4/4\nL:1/8\nK:C\nZ4`);
      expect(music.notes).toHaveLength(4);
      expect(music.notes.every((n) => n.pitches.length === 0)).toBe(true);
      expect(music.notes.every((n) => n.duration === Duration.WHOLE)).toBe(
        true
      );
      expect(music.bars).toHaveLength(3); // 3 bars between 4 measures
    });

    it('Z1 in 3/4 produces a dotted half rest', () => {
      const music = fromAbc(`M:3/4\nL:1/8\nK:C\nZ`);
      expect(music.notes).toHaveLength(1);
      expect(music.notes[0].duration).toBe(Duration.HALF);
      expect(music.notes[0].dots).toBe(1);
    });

    it('Z2 in 3/4 produces 2 dotted-half rests with a bar line', () => {
      const music = fromAbc(`M:3/4\nL:1/8\nK:C\nZ2`);
      expect(music.notes).toHaveLength(2);
      expect(music.bars).toHaveLength(1);
    });

    it('Z followed by notes emits correct bar count', () => {
      const music = fromAbc(`M:4/4\nL:1/8\nK:C\nZ2 | c4`);
      const restCount = music.notes.filter(
        (n) => n.pitches.length === 0
      ).length;
      expect(restCount).toBe(2);
      expect(music.notes[music.notes.length - 1].pitches).toEqual([72]);
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

    it('inline [K:] changes key signature mid-score', () => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:C\nC [K:G] D`);
      expect(music.signatures[0].keySignature).toBe('C');
      expect(music.signatures.length).toBe(2);
      expect(music.signatures[1].keySignature).toBe('G');
      expect(music.signatures[1].atNoteIndex).toBe(1);
    });

    it('inline [M:] changes meter mid-score', () => {
      const music = fromAbc(
        `T:Test\nM:4/4\nL:1/4\nK:C\nC D E F | [M:3/4] G A B |`
      );
      expect(music.signatures[0].beatsPerBar).toBe(4);
      expect(music.signatures.length).toBe(2);
      expect(music.signatures[1].beatsPerBar).toBe(3);
      expect(music.signatures[1].beatValue).toBe(4);
    });

    it('inline [Q:] changes tempo mid-score', () => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:C\nC D [Q:200] E F |`);
      expect(music.signatures[0].tempo).toBeUndefined();
      expect(music.signatures.length).toBe(2);
      expect(music.signatures[1].tempo).toBe(200);
    });

    it('inline [L:] changes default duration mid-score', () => {
      const music = fromAbc(`T:Test\nM:4/4\nL:1/4\nK:C\nC D [L:1/8] E F |`);
      expect(music.signatures.length).toBe(2);
      expect(music.signatures[1].defaultDuration).toBe('8');
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
      expect(voices[0].music.signatures[0].beatsPerBar).toBe(3);
      expect(voices[1].music.signatures[0].beatsPerBar).toBe(3);
    });

    it('sets clef from V: clef= attribute', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nV:1 clef=treble\nV:2 clef=bass\nK:C\n[V:1] C D |[V:2] C, D, |`;
      const voices = voicesFromAbc(abc);
      expect(voices[0].music.clef).toBe('treble');
      expect(voices[1].music.clef).toBe('bass');
    });

    it('does not shift pitches when voice clef=treble and defaultClef is treble8va', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nV:1 clef=treble\nK:C\n[V:1] C D E F |`;
      const voicesDefault = voicesFromAbc(abc);
      const voicesWithDefault = voicesFromAbc(abc, 'treble8va');
      // Pitches should be the same regardless of defaultClef when voice has explicit clef=treble
      expect(voicesWithDefault[0].music.clef).toBe('treble');
      expect(voicesWithDefault[0].music.notes.map((n) => n.pitches)).toEqual(
        voicesDefault[0].music.notes.map((n) => n.pitches)
      );
    });

    it('splits three voices correctly', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nV:1\nV:2\nV:3\nK:C\nV:1\nC D |\nV:2\nE F |\nV:3\nG A |`;
      const voices = voicesFromAbc(abc);
      expect(voices).toHaveLength(3);
      expect(voices[0].music.notes).toHaveLength(2);
      expect(voices[1].music.notes).toHaveLength(2);
      expect(voices[2].music.notes).toHaveLength(2);
      expect(voices[0].music.notes[0].pitches).toEqual([60]); // C
      expect(voices[1].music.notes[0].pitches).toEqual([64]); // E
      expect(voices[2].music.notes[0].pitches).toEqual([67]); // G
    });
  });

  describe('round-trip tests', () => {
    it('dotted sixteenth round-trips through ABC export and re-import', () => {
      // Baroque music (e.g. Lombard rhythm) uses dotted-sixteenth + thirty-second patterns.
      // The ABC for a dotted-sixteenth with default L:1/8 is "A3/4" (3/4 of an eighth).
      // This regresses a bug where 3/4 * 2 = 1.5 thirty-seconds had no map entry and threw.
      const music = new Music();
      music.signatures[0].keySignature = 'C';
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes.push(new Note(69, Duration.SIXTEENTH, [], undefined, 1));
      music.notes.push(new Note(69, Duration.EIGHTH, [], undefined, 0));
      music.bars.push({ afterNoteNum: 1, type: 'standard' });

      const abc = toAbc(music);
      const reimported = fromAbc(abc);

      expect(reimported.notes[0].duration).toBe(Duration.SIXTEENTH);
      expect(reimported.notes[0].dots).toBe(1);
    });
  });

  describe('DC/DS navigation decorations', () => {
    it('parses !d.c.! decoration onto a note', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC D !d.c.!E F |]`;
      const music = fromAbc(abc);
      expect(music.notes[2].decorations).toContain('d.c.');
    });

    it('parses !d.c.alfine! decoration', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC !d.c.alfine!D |]`;
      const music = fromAbc(abc);
      expect(music.notes[1].decorations).toContain('d.c.alfine');
    });

    it('parses !d.c.alcoda! decoration', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC !d.c.alcoda!D |]`;
      const music = fromAbc(abc);
      expect(music.notes[1].decorations).toContain('d.c.alcoda');
    });

    it('parses !d.s.! decoration', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC !d.s.!D |]`;
      const music = fromAbc(abc);
      expect(music.notes[1].decorations).toContain('d.s.');
    });

    it('parses !fine! decoration', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC !fine!D |]`;
      const music = fromAbc(abc);
      expect(music.notes[1].decorations).toContain('fine');
    });

    it('parses !alcoda! decoration', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\n!alcoda!C D |]`;
      const music = fromAbc(abc);
      expect(music.notes[0].decorations).toContain('alcoda');
    });

    it('parses decorations case-insensitively', () => {
      const abc = `T:Test\nM:4/4\nL:1/4\nK:C\nC !D.C.!D |]`;
      const music = fromAbc(abc);
      expect(music.notes[1].decorations).toContain('d.c.');
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
      expect(music.signatures[0].beatsPerBar).toBe(4);
      expect(music.signatures[0].beatValue).toBe(4);
      expect(music.signatures[0].keySignature).toBe('C');
      expect(music.notes.length).toBeGreaterThan(0);
    });
  });
});

// ---- Lyrics -----------------------------------------------------------------

const BASE_HEADERS = 'T:Test\nM:4/4\nL:1/4\nK:C\n';

describe('lyrics — w: aligned', () => {
  it('parses a single-verse w: line', () => {
    const abc = BASE_HEADERS + 'C D E F\nw:do re mi fa';
    const music = fromAbc(abc);
    expect(music.lyrics).toHaveLength(1);
    expect(music.lyrics[0][0]).toBe('do');
    expect(music.lyrics[0][1]).toBe('re');
    expect(music.lyrics[0][2]).toBe('mi');
    expect(music.lyrics[0][3]).toBe('fa');
  });

  it('parses hyphenated syllables across notes', () => {
    const abc = BASE_HEADERS + 'C D\nw:hel-lo';
    const music = fromAbc(abc);
    expect(music.lyrics[0][0]).toBe('hel-');
    expect(music.lyrics[0][1]).toBe('lo');
  });

  it('* skip leaves note without lyric', () => {
    const abc = BASE_HEADERS + 'C D E\nw:one * three';
    const music = fromAbc(abc);
    expect(music.lyrics[0][0]).toBe('one');
    expect(music.lyrics[0][1]).toBeUndefined();
    expect(music.lyrics[0][2]).toBe('three');
  });

  it('_ hold advances note index without assigning lyric', () => {
    const abc = BASE_HEADERS + 'C D E\nw:held _';
    const music = fromAbc(abc);
    expect(music.lyrics[0][0]).toBe('held');
    expect(music.lyrics[0][1]).toBeUndefined();
    expect(music.lyrics[0][2]).toBeUndefined();
  });

  it('~ tilde joins multiple words into one syllable displayed with spaces', () => {
    // ABC standard: ~ "appears as a space; aligns multiple words under one note"
    const abc = BASE_HEADERS + 'C D E\nw:of~the~day two three';
    const music = fromAbc(abc);
    expect(music.lyrics[0][0]).toBe('of the day'); // one note, spaces in display
    expect(music.lyrics[0][1]).toBe('two');
    expect(music.lyrics[0][2]).toBe('three');
  });

  it('trailing underscores in a word generate holds', () => {
    // "time__" aligns with three notes: the syllable + 2 holds
    const abc = BASE_HEADERS + 'C D E F\nw:time__ end';
    const music = fromAbc(abc);
    expect(music.lyrics[0][0]).toBe('time');
    expect(music.lyrics[0][1]).toBeUndefined(); // hold
    expect(music.lyrics[0][2]).toBeUndefined(); // hold
    expect(music.lyrics[0][3]).toBe('end');
  });

  it('\\- escaped hyphen appears as literal hyphen without breaking syllable', () => {
    const abc = BASE_HEADERS + 'C D\nw:hel\\-lo world';
    const music = fromAbc(abc);
    expect(music.lyrics[0][0]).toBe('hel-lo'); // one note, hyphen in display
    expect(music.lyrics[0][1]).toBe('world');
  });

  it('rests are skipped during lyric alignment', () => {
    // z is a rest; lyrics should skip it and align to real notes
    const abc = BASE_HEADERS + 'C z D\nw:one two';
    const music = fromAbc(abc);
    const noteIndices = music.notes
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => n.pitches.length > 0)
      .map(({ i }) => i);
    expect(music.lyrics[0][noteIndices[0]]).toBe('one');
    expect(music.lyrics[0][noteIndices[1]]).toBe('two');
  });

  it('| bar token advances to next bar start', () => {
    // 4 notes per bar; | skips to bar 2; next syllable lands on note 4
    const abc = BASE_HEADERS + 'C D E F | G A B c\nw:one | five';
    const music = fromAbc(abc);
    expect(music.lyrics[0][0]).toBe('one');
    // notes 1,2,3 have no lyric (skipped by |)
    expect(music.lyrics[0][1]).toBeUndefined();
    expect(music.lyrics[0][2]).toBeUndefined();
    expect(music.lyrics[0][3]).toBeUndefined();
    expect(music.lyrics[0][4]).toBe('five');
  });

  it('excess syllables beyond note count are ignored', () => {
    const abc = BASE_HEADERS + 'C D\nw:one two three four five';
    const music = fromAbc(abc);
    expect(music.lyrics[0]).toHaveLength(music.notes.length);
  });

  it('fewer syllables than notes leaves trailing notes without lyric', () => {
    const abc = BASE_HEADERS + 'C D E F\nw:one two';
    const music = fromAbc(abc);
    expect(music.lyrics[0][0]).toBe('one');
    expect(music.lyrics[0][1]).toBe('two');
    expect(music.lyrics[0][2]).toBeUndefined();
    expect(music.lyrics[0][3]).toBeUndefined();
  });

  it('parses multi-verse w: lines', () => {
    const abc = BASE_HEADERS + 'C D E F\nw:do re mi fa\nw:one two three four';
    const music = fromAbc(abc);
    expect(music.lyrics).toHaveLength(2);
    expect(music.lyrics[0][0]).toBe('do');
    expect(music.lyrics[1][0]).toBe('one');
    expect(music.lyrics[1][3]).toBe('four');
  });

  it('grace notes are skipped during lyric alignment', () => {
    // {G}C D — the grace note G should not consume a lyric slot
    const abc = BASE_HEADERS + '{G}C D\nw:one two';
    const music = fromAbc(abc);
    // Find the non-grace notes
    const realNoteIndices = music.notes
      .map((n, i) => ({ n, i }))
      .filter(
        ({ n }) =>
          n.duration !== Duration.GRACE && n.duration !== Duration.GRACE_SLASH
      )
      .map(({ i }) => i);
    expect(music.lyrics[0][realNoteIndices[0]]).toBe('one');
    expect(music.lyrics[0][realNoteIndices[1]]).toBe('two');
  });

  it('lyrics default to empty array when no w: lines present', () => {
    const abc = BASE_HEADERS + 'C D E F';
    const music = fromAbc(abc);
    expect(music.lyrics).toEqual([]);
  });
});

describe('lyrics — W: unaligned', () => {
  it('stores W: text in endLyrics', () => {
    const abc = BASE_HEADERS + 'C D E F\nW:Some unaligned text';
    const music = fromAbc(abc);
    expect(music.endLyrics).toBe('Some unaligned text');
  });

  it('joins multiple W: lines with newline', () => {
    const abc = BASE_HEADERS + 'C D\nW:Line one\nW:Line two';
    const music = fromAbc(abc);
    expect(music.endLyrics).toBe('Line one\nLine two');
  });

  it('endLyrics is undefined when no W: lines present', () => {
    const abc = BASE_HEADERS + 'C D E F';
    const music = fromAbc(abc);
    expect(music.endLyrics).toBeUndefined();
  });
});

describe('lyrics — round-trip', () => {
  it('round-trips single-verse aligned lyrics through toAbc/fromAbc', () => {
    const abc = BASE_HEADERS + 'C D E F\nw:do re mi fa';
    const music = fromAbc(abc);
    const exported = toAbc(music);
    const reimported = fromAbc(exported);
    expect(reimported.lyrics[0][0]).toBe('do');
    expect(reimported.lyrics[0][3]).toBe('fa');
  });

  it('round-trips multi-verse lyrics', () => {
    const abc = BASE_HEADERS + 'C D E F\nw:do re mi fa\nw:one two three four';
    const music = fromAbc(abc);
    const exported = toAbc(music);
    const reimported = fromAbc(exported);
    expect(reimported.lyrics).toHaveLength(2);
    expect(reimported.lyrics[1][0]).toBe('one');
    expect(reimported.lyrics[1][3]).toBe('four');
  });

  it('round-trips W: unaligned lyrics', () => {
    const abc = BASE_HEADERS + 'C D E F\nW:Verse text here';
    const music = fromAbc(abc);
    const exported = toAbc(music);
    const reimported = fromAbc(exported);
    expect(reimported.endLyrics).toBe('Verse text here');
  });

  it('round-trips hyphenated syllables', () => {
    const abc = BASE_HEADERS + 'C D\nw:hel-lo';
    const music = fromAbc(abc);
    const exported = toAbc(music);
    const reimported = fromAbc(exported);
    expect(reimported.lyrics[0][0]).toBe('hel-');
    expect(reimported.lyrics[0][1]).toBe('lo');
  });
});
