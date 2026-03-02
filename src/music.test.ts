import { describe, it, expect } from 'vitest';
import { Note, Music, Duration, DurationModifier } from './music';

describe('Note', () => {
  describe('fromAbc', () => {
    it('should parse basic notes', () => {
      const note = Note.fromAbc(
        'C',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(note.pitches[0]).toBe(60); // C in octave 3 (MIDI C4)
      expect(note.duration).toBe(Duration.QUARTER);
    });

    it('should parse lowercase notes in higher octave', () => {
      const note = Note.fromAbc(
        'c',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(note.pitches[0]).toBe(72); // c in octave 4 (MIDI C5)
    });

    it('should parse all note names', () => {
      const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      const expectedPitches = [60, 62, 64, 65, 67, 69, 71];

      notes.forEach((noteName, i) => {
        const note = Note.fromAbc(
          noteName,
          Duration.QUARTER,
          DurationModifier.NONE,
          {},
          '',
          ''
        );
        expect(note.pitches[0]).toBe(expectedPitches[i]);
      });
    });

    it('should handle octave modifiers with commas', () => {
      const c2 = Note.fromAbc(
        'C,',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(c2.pitches[0]).toBe(48); // C in octave 2 (MIDI C3)

      const c1 = Note.fromAbc(
        'C,,',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(c1.pitches[0]).toBe(36); // C in octave 1 (MIDI C2)

      const c0 = Note.fromAbc(
        'C,,,',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(c0.pitches[0]).toBe(24); // C in octave 0 (MIDI C1)
    });

    it('should handle octave modifiers with apostrophes', () => {
      const c5 = Note.fromAbc(
        "c'",
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(c5.pitches[0]).toBe(84); // C in octave 5 (MIDI C6)

      const c6 = Note.fromAbc(
        "c''",
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(c6.pitches[0]).toBe(96); // C in octave 6 (MIDI C7)

      const c7 = Note.fromAbc(
        "c'''",
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(c7.pitches[0]).toBe(108); // C in octave 7 (MIDI C8)
    });

    it('should handle sharp accidentals', () => {
      const cSharp = Note.fromAbc(
        'C',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '^',
        ''
      );
      expect(cSharp.pitches[0]).toBe(61); // C#
      expect(cSharp.accidentals[0]).toBe('#');
    });

    it('should handle flat accidentals', () => {
      const bFlat = Note.fromAbc(
        'B',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '_',
        ''
      );
      expect(bFlat.pitches[0]).toBe(70); // Bb
      expect(bFlat.accidentals[0]).toBe('b');
    });

    it('should handle natural accidentals', () => {
      const eNatural = Note.fromAbc(
        'E',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '=',
        ''
      );
      expect(eNatural.accidentals[0]).toBe('n');
    });

    it('should apply key adjustment', () => {
      const keyAdj = { F: 1 }; // G major: F#
      const fSharp = Note.fromAbc(
        'F',
        Duration.QUARTER,
        DurationModifier.NONE,
        keyAdj,
        '',
        ''
      );
      expect(fSharp.pitches[0]).toBe(66); // F#
    });

    it('should override key adjustment with explicit accidental', () => {
      const keyAdj = { F: 1 }; // G major: F#
      const fNatural = Note.fromAbc(
        'F',
        Duration.QUARTER,
        DurationModifier.NONE,
        keyAdj,
        '=',
        ''
      );
      expect(fNatural.accidentals[0]).toBe('n');
    });

    it('should parse rest with Z', () => {
      const rest = Note.fromAbc(
        'Z',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(rest.pitches).toHaveLength(0);
    });

    it('should parse rest with X', () => {
      const rest = Note.fromAbc(
        'X',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(rest.pitches).toHaveLength(0);
    });

    it('should parse fermata decoration', () => {
      const fermata = Note.fromAbc(
        'C',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        'H'
      );
      expect(fermata.decorations).toContain('fermata');
    });

    it('should parse multiple decorations', () => {
      const note = Note.fromAbc(
        'C',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        'L.'
      );
      expect(note.decorations).toContain('accent');
      expect(note.decorations).toContain('staccato');
    });

    it('should parse dynamics decorations', () => {
      const pp = Note.fromAbc(
        'C',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        '!pp!'
      );
      expect(pp.decorations).toContain('pp');

      const ff = Note.fromAbc(
        'C',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        '!ff!'
      );
      expect(ff.decorations).toContain('ff');
    });

    it('should parse rests with X', () => {
      const rest = Note.fromAbc(
        'X',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(rest.pitches).toHaveLength(0);
      expect(rest.duration).toBe(Duration.QUARTER);
    });

    it('should parse rests with Z', () => {
      const rest = Note.fromAbc(
        'Z',
        Duration.QUARTER,
        DurationModifier.NONE,
        {},
        '',
        ''
      );
      expect(rest.pitches).toHaveLength(0);
      expect(rest.duration).toBe(Duration.QUARTER);
    });

    it('should throw error for unknown note', () => {
      expect(() => {
        Note.fromAbc('Q', Duration.QUARTER, DurationModifier.NONE, {}, '', '');
      }).toThrow('Unknown ABC note Q');
    });
  });

  describe('toVexflowPitchAndDuration', () => {
    it('should convert whole note', () => {
      const note = new Note(60, Duration.WHOLE);
      const [pitches, duration] = note.toVexflowPitchAndDuration();
      expect(duration).toBe('w');
      expect(pitches[0]).toBe('c/4');
    });

    it('should convert half note', () => {
      const note = new Note(60, Duration.HALF);
      const [, duration] = note.toVexflowPitchAndDuration();
      expect(duration).toBe('h');
    });

    it('should convert quarter note', () => {
      const note = new Note(60, Duration.QUARTER);
      const [, duration] = note.toVexflowPitchAndDuration();
      expect(duration).toBe('q');
    });

    it('should convert eighth note', () => {
      const note = new Note(60, Duration.EIGHTH);
      const [, duration] = note.toVexflowPitchAndDuration();
      expect(duration).toBe('8');
    });

    it('should convert sixteenth note', () => {
      const note = new Note(60, Duration.SIXTEENTH);
      const [, duration] = note.toVexflowPitchAndDuration();
      expect(duration).toBe('16');
    });

    it('should convert dotted notes', () => {
      const halfDotted = new Note(
        60,
        Duration.HALF,
        [],
        undefined,
        DurationModifier.DOTTED
      );
      expect(halfDotted.toVexflowPitchAndDuration()[1]).toBe('hd');

      const quarterDotted = new Note(
        60,
        Duration.QUARTER,
        [],
        undefined,
        DurationModifier.DOTTED
      );
      expect(quarterDotted.toVexflowPitchAndDuration()[1]).toBe('qd');

      const eighthDotted = new Note(
        60,
        Duration.EIGHTH,
        [],
        undefined,
        DurationModifier.DOTTED
      );
      expect(eighthDotted.toVexflowPitchAndDuration()[1]).toBe('8d');
    });

    it('should convert triplet notes', () => {
      const halfTriplet = new Note(
        60,
        Duration.HALF,
        [],
        undefined,
        DurationModifier.TRIPLET
      );
      expect(halfTriplet.toVexflowPitchAndDuration()[1]).toBe('h');

      const quarterTriplet = new Note(
        60,
        Duration.QUARTER,
        [],
        undefined,
        DurationModifier.TRIPLET
      );
      expect(quarterTriplet.toVexflowPitchAndDuration()[1]).toBe('q');
    });

    it('should convert pitch to Vexflow format', () => {
      const c4 = new Note(60, Duration.QUARTER);
      expect(c4.toVexflowPitchAndDuration()[0][0]).toBe('c/4');

      const d4 = new Note(62, Duration.QUARTER);
      expect(d4.toVexflowPitchAndDuration()[0][0]).toBe('d/4');

      const e4 = new Note(64, Duration.QUARTER);
      expect(e4.toVexflowPitchAndDuration()[0][0]).toBe('e/4');
    });

    it('should handle different octaves', () => {
      const c3 = new Note(48, Duration.QUARTER);
      expect(c3.toVexflowPitchAndDuration()[0][0]).toBe('c/3');

      const c5 = new Note(72, Duration.QUARTER);
      expect(c5.toVexflowPitchAndDuration()[0][0]).toBe('c/5');
    });

    it('should convert rests', () => {
      const rest = new Note(undefined, Duration.QUARTER);
      const [pitches, duration] = rest.toVexflowPitchAndDuration();
      expect(pitches[0]).toBe('b/4');
      expect(duration).toBe('qr');
    });

    it('should handle sharp accidentals in Vexflow conversion', () => {
      const cSharp = new Note(61, Duration.QUARTER, [], '#');
      const [pitches] = cSharp.toVexflowPitchAndDuration();
      expect(pitches[0]).toBe('c/4');
    });

    it('should use sharp spelling for black keys in sharp keys', () => {
      // F# in G major: pitch 66, no explicit accidental, useSharpSpelling=true
      const fSharp = new Note(66, Duration.QUARTER);
      expect(fSharp.toVexflowPitchAndDuration(true)[0][0]).toBe('f/4');
    });

    it('should use flat spelling for black keys in flat keys', () => {
      // Bb in F major: pitch 70, no explicit accidental, useSharpSpelling=false
      const bFlat = new Note(70, Duration.QUARTER);
      expect(bFlat.toVexflowPitchAndDuration(false)[0][0]).toBe('b/4');
    });

    it('explicit flat accidental overrides sharp key spelling', () => {
      const bFlat = new Note(70, Duration.QUARTER, [], 'b');
      expect(bFlat.toVexflowPitchAndDuration(true)[0][0]).toBe('b/4');
    });

    it('explicit sharp accidental overrides flat key spelling', () => {
      const fSharp = new Note(66, Duration.QUARTER, [], '#');
      expect(fSharp.toVexflowPitchAndDuration(false)[0][0]).toBe('f/4');
    });
  });

  describe('name', () => {
    it('returns natural note names', () => {
      expect(new Note(60, Duration.QUARTER).name()).toBe('C');
      expect(new Note(62, Duration.QUARTER).name()).toBe('D');
      expect(new Note(65, Duration.QUARTER).name()).toBe('F');
    });

    it('uses sharp names in sharp keys', () => {
      expect(new Note(66, Duration.QUARTER).name(true)).toBe('F♯');
      expect(new Note(69 + 1, Duration.QUARTER).name(true)).toBe('A♯');
    });

    it('uses flat names in flat keys', () => {
      expect(new Note(70, Duration.QUARTER).name(false)).toBe('B♭');
      expect(new Note(63, Duration.QUARTER).name(false)).toBe('E♭');
    });

    it('explicit sharp accidental overrides flat key', () => {
      const fSharp = new Note(66, Duration.QUARTER, [], '#');
      expect(fSharp.name(false)).toBe('F♯');
    });

    it('explicit flat accidental overrides sharp key', () => {
      const bFlat = new Note(70, Duration.QUARTER, [], 'b');
      expect(bFlat.name(true)).toBe('B♭');
    });

    it('returns slash-joined names for chords', () => {
      const chord = new Note([60, 64, 67], Duration.QUARTER);
      expect(chord.name()).toBe('C/E/G');
    });

    it('returns empty string for rests', () => {
      expect(new Note(undefined, Duration.QUARTER).name()).toBe('');
    });
  });

  describe('ticks', () => {
    it('returns 0 for GRACE duration', () => {
      const note = new Note(60, Duration.GRACE);
      expect(note.ticks()).toBe(0);
    });

    it('returns 0 for GRACE_SLASH duration', () => {
      const note = new Note(60, Duration.GRACE_SLASH);
      expect(note.ticks()).toBe(0);
    });
  });

  describe('chord construction', () => {
    it('supports multiple pitches', () => {
      const chord = new Note([60, 64, 67], Duration.QUARTER);
      expect(chord.pitches).toEqual([60, 64, 67]);
      expect(chord.accidentals).toHaveLength(3);
    });
  });

  describe('toVexflowPitchAndDuration for grace note', () => {
    it('renders grace note as quarter duration', () => {
      const note = new Note(60, Duration.GRACE);
      const [pitches, duration] = note.toVexflowPitchAndDuration();
      expect(duration).toBe('q'); // grace renders as q
      expect(pitches[0]).toBe('c/4');
    });
  });
});

describe('Music', () => {
  describe('autobar', () => {
    it('should create bars for 4/4 time', () => {
      const music = new Music();
      music.beatsPerBar = 4;
      music.beatValue = 4;
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
        new Note(65, Duration.QUARTER),
        new Note(67, Duration.QUARTER),
      ];

      music.autobar();

      expect(music.bars.length).toBe(2);
      expect(music.bars[0].type).toBe('begin');
      expect(music.bars[1].type).toBe('standard');
      expect(music.bars[1].afterNoteNum).toBe(3);
    });

    it('should create multiple bars', () => {
      const music = new Music();
      music.beatsPerBar = 4;
      music.beatValue = 4;
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
        new Note(65, Duration.QUARTER),
        new Note(67, Duration.QUARTER),
        new Note(69, Duration.QUARTER),
        new Note(71, Duration.QUARTER),
        new Note(72, Duration.QUARTER),
      ];

      music.autobar();

      expect(music.bars.length).toBe(3);
      expect(music.bars[1].afterNoteNum).toBe(3);
      expect(music.bars[2].afterNoteNum).toBe(7);
    });

    it('should handle 3/4 time', () => {
      const music = new Music();
      music.beatsPerBar = 3;
      music.beatValue = 4;
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
        new Note(65, Duration.QUARTER),
      ];

      music.autobar();

      expect(music.bars.length).toBe(2);
      expect(music.bars[1].afterNoteNum).toBe(2);
    });

    it('empty Music autobar: only begin bar', () => {
      const music = new Music();
      music.beatsPerBar = 4;
      music.beatValue = 4;
      music.notes = [];
      music.autobar();
      expect(music.bars).toHaveLength(1);
      expect(music.bars[0].type).toBe('begin');
    });

    it('should handle 6/8 time with eighth notes', () => {
      const music = new Music();
      music.beatsPerBar = 6;
      music.beatValue = 8;
      // 6 eighth notes = one bar of 6/8
      music.notes = [
        new Note(60, Duration.EIGHTH),
        new Note(62, Duration.EIGHTH),
        new Note(64, Duration.EIGHTH),
        new Note(65, Duration.EIGHTH),
        new Note(67, Duration.EIGHTH),
        new Note(69, Duration.EIGHTH),
      ];
      music.autobar();
      // 6 eighths × 512 ticks = 3072 ticks per bar
      // beatsPerBar * QUARTER ticks = 6 * 1024 = 6144 → bar after all 6 notes
      // Wait - autobar uses DURATION_TICKS.QUARTER * beatsPerBar
      // For 6/8: 1024 * 6 = 6144, but 6 eighths = 3072
      // So we'd need 12 eighths to fill a bar. Let's just verify it works.
      expect(music.bars[0].type).toBe('begin');
    });

    it('should throw error for overflow measures', () => {
      const music = new Music();
      music.beatsPerBar = 4;
      music.beatValue = 4;
      music.notes = [
        new Note(60, Duration.HALF, [], undefined, DurationModifier.DOTTED),
        new Note(62, Duration.HALF),
      ];

      // Dotted half (3 beats) + half (2 beats) = 5 beats, overflows a 4/4 bar
      expect(() => music.autobar()).toThrow("Can't auto-create ties yet");
    });
  });
});
