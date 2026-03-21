import { describe, it, expect } from 'vitest';
import {
  Note,
  Music,
  Duration,
  DurationModifier,
  expandRepeats,
} from './music';
import { fromAbc } from './io/abcImport';

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
  describe('reflow', () => {
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

      music.reflow();

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

      music.reflow();

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

      music.reflow();

      expect(music.bars.length).toBe(2);
      expect(music.bars[1].afterNoteNum).toBe(2);
    });

    it('empty Music: only begin bar', () => {
      const music = new Music();
      music.beatsPerBar = 4;
      music.beatValue = 4;
      music.notes = [];
      music.reflow();
      expect(music.bars).toHaveLength(1);
      expect(music.bars[0].type).toBe('begin');
    });

    it('should handle 6/8 time with eighth notes', () => {
      const music = new Music();
      music.beatsPerBar = 6;
      music.beatValue = 8;
      // 6 eighth notes = one bar of 6/8 (6 × 512 = 3072 ticks)
      music.notes = [
        new Note(60, Duration.EIGHTH),
        new Note(62, Duration.EIGHTH),
        new Note(64, Duration.EIGHTH),
        new Note(65, Duration.EIGHTH),
        new Note(67, Duration.EIGHTH),
        new Note(69, Duration.EIGHTH),
      ];
      music.reflow();
      expect(music.bars).toHaveLength(2);
      expect(music.bars[0].type).toBe('begin');
      expect(music.bars[1].afterNoteNum).toBe(5);
    });

    it('splits a note that overflows a bar boundary with a tie', () => {
      const music = new Music();
      music.beatsPerBar = 4;
      music.beatValue = 4;
      // Dotted half (3072 ticks) + half (2048 ticks) = 5 beats, overflows 4/4
      // Expected: dotted-half fits bar 1, remaining quarter+half split into bar 2
      // Actually: dotted-half = 3 beats, bar = 4 beats, remainder = 1 beat (quarter)
      // Half note (2048) = 2 beats; crosses bar: split into quarter (1024) + quarter (1024)
      music.notes = [
        new Note(60, Duration.HALF, [], undefined, DurationModifier.DOTTED),
        new Note(62, Duration.HALF),
      ];

      music.reflow();

      // dotted half fills 3 beats, then half note: 1 beat fits in bar 1, 1 beat in bar 2
      expect(music.notes).toHaveLength(3);
      expect(music.notes[0].duration).toBe(Duration.HALF);
      expect(music.notes[0].durationModifier).toBe(DurationModifier.DOTTED);
      expect(music.notes[1].duration).toBe(Duration.QUARTER);
      expect(music.notes[2].duration).toBe(Duration.QUARTER);
      // tie between notes[1] and notes[2]
      expect(music.curves).toContainEqual([1, 2]);
      // bar after note[1] (index 1)
      expect(music.bars.some((b) => b.afterNoteNum === 1)).toBe(true);
    });

    it('merges tied same-pitch notes whose combined duration is standard', () => {
      const music = new Music();
      music.beatsPerBar = 4;
      music.beatValue = 4;
      // Two quarter notes tied = half note
      music.notes = [
        new Note(60, Duration.QUARTER),
        new Note(60, Duration.QUARTER),
        new Note(62, Duration.HALF),
      ];
      music.curves = [[0, 1]]; // tie between the two C quarters

      music.reflow();

      expect(music.notes).toHaveLength(2);
      expect(music.notes[0].duration).toBe(Duration.HALF);
      expect(music.notes[0].pitches).toEqual([60]);
      expect(music.curves).not.toContainEqual([0, 1]);
    });
  });
});

describe('expandRepeats', () => {
  it('no bars → identity', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER),
      new Note(62, Duration.QUARTER),
    ];
    music.curves = [[0, 1]];
    music.bars = [];

    const result = expandRepeats(music);

    expect(result.notes).toHaveLength(2);
    expect(result.notes[0].pitches).toEqual([60]);
    expect(result.notes[1].pitches).toEqual([62]);
    expect(result.curves).toEqual([[0, 1]]);
    expect(result.originalIndices).toEqual([0, 1]);
  });

  it('standard bars only → no duplication', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER),
      new Note(62, Duration.QUARTER),
      new Note(64, Duration.QUARTER),
      new Note(65, Duration.QUARTER),
    ];
    music.bars = [{ afterNoteNum: 1, type: 'standard' }];

    const result = expandRepeats(music);

    expect(result.notes).toHaveLength(4);
    expect(result.originalIndices).toEqual([0, 1, 2, 3]);
  });

  it('simple |: ... :| repeats notes twice', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER),
      new Note(62, Duration.QUARTER),
    ];
    music.bars = [
      { afterNoteNum: -1, type: 'begin_repeat' },
      { afterNoteNum: 1, type: 'end_repeat' },
    ];

    const result = expandRepeats(music);

    expect(result.notes).toHaveLength(4);
    expect(result.notes[0].pitches).toEqual([60]);
    expect(result.notes[1].pitches).toEqual([62]);
    expect(result.notes[2].pitches).toEqual([60]);
    expect(result.notes[3].pitches).toEqual([62]);
  });

  it('|: at start (afterNoteNum < 0) repeats from 0', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER),
      new Note(62, Duration.QUARTER),
      new Note(64, Duration.QUARTER),
    ];
    music.bars = [
      { afterNoteNum: -1, type: 'begin_repeat' },
      { afterNoteNum: 2, type: 'end_repeat' },
    ];

    const result = expandRepeats(music);

    expect(result.notes).toHaveLength(6);
    expect(result.originalIndices).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it(':| without matching |: repeats from start of piece', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER),
      new Note(62, Duration.QUARTER),
    ];
    music.bars = [{ afterNoteNum: 1, type: 'end_repeat' }];

    const result = expandRepeats(music);

    expect(result.notes).toHaveLength(4);
    expect(result.originalIndices).toEqual([0, 1, 0, 1]);
  });

  it(':: (begin_end_repeat) creates two independent repeated sections', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER), // 0: section A
      new Note(62, Duration.QUARTER), // 1: section A
      new Note(64, Duration.QUARTER), // 2: section B
      new Note(65, Duration.QUARTER), // 3: section B
    ];
    music.bars = [
      { afterNoteNum: -1, type: 'begin_repeat' },
      { afterNoteNum: 1, type: 'begin_end_repeat' },
      { afterNoteNum: 3, type: 'end_repeat' },
    ];

    const result = expandRepeats(music);

    // Section A played twice, then section B played twice
    expect(result.notes).toHaveLength(8);
    expect(result.originalIndices).toEqual([0, 1, 0, 1, 2, 3, 2, 3]);
  });

  it('multiple independent repeats', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER), // 0
      new Note(62, Duration.QUARTER), // 1
      new Note(64, Duration.QUARTER), // 2
      new Note(65, Duration.QUARTER), // 3
    ];
    music.bars = [
      { afterNoteNum: -1, type: 'begin_repeat' },
      { afterNoteNum: 1, type: 'end_repeat' },
      { afterNoteNum: 1, type: 'begin_repeat' },
      { afterNoteNum: 3, type: 'end_repeat' },
    ];

    const result = expandRepeats(music);

    expect(result.notes).toHaveLength(8);
    expect(result.originalIndices).toEqual([0, 1, 0, 1, 2, 3, 2, 3]);
  });

  it('curves inside repeat are duplicated with remapped indices', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER), // 0
      new Note(62, Duration.QUARTER), // 1
    ];
    music.curves = [[0, 1]];
    music.bars = [
      { afterNoteNum: -1, type: 'begin_repeat' },
      { afterNoteNum: 1, type: 'end_repeat' },
    ];

    const result = expandRepeats(music);

    expect(result.curves).toHaveLength(2);
    expect(result.curves[0]).toEqual([0, 1]);
    expect(result.curves[1]).toEqual([2, 3]);
  });

  it('curves spanning repeat boundary are NOT duplicated', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER), // 0
      new Note(62, Duration.QUARTER), // 1 — repeat ends here
      new Note(64, Duration.QUARTER), // 2 — outside repeat
    ];
    // Curve from note 1 to note 2 crosses the repeat boundary
    music.curves = [[1, 2]];
    music.bars = [
      { afterNoteNum: -1, type: 'begin_repeat' },
      { afterNoteNum: 1, type: 'end_repeat' },
    ];

    const result = expandRepeats(music);

    // The curve [1,2] only has the start inside the repeat, so it won't be
    // included for either pass (it's not fully contained in either segment).
    // Only curves fully inside a segment get duplicated.
    expect(result.curves).toHaveLength(0);
  });

  it('originalIndices correctness for simple repeat', () => {
    const music = new Music();
    music.notes = [
      new Note(60, Duration.QUARTER),
      new Note(62, Duration.QUARTER),
      new Note(64, Duration.QUARTER),
      new Note(65, Duration.QUARTER),
    ];
    music.bars = [
      { afterNoteNum: -1, type: 'begin_repeat' },
      { afterNoteNum: 3, type: 'end_repeat' },
    ];

    const result = expandRepeats(music);

    expect(result.originalIndices).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  it('integration: fromAbc → expandRepeats', () => {
    const music = fromAbc('X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: C D E F :|');

    const result = expandRepeats(music);

    expect(result.notes).toHaveLength(8);
    expect(result.notes[0].pitches).toEqual([60]);
    expect(result.notes[4].pitches).toEqual([60]);
    expect(result.originalIndices).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
  });

  describe('volta brackets', () => {
    // Helper to get pitch from expanded note index
    const p = (result: ReturnType<typeof expandRepeats>, i: number) =>
      result.notes[i].pitches[0];

    it('|1 ... :|2 plays common+volta1 then common+volta2', () => {
      // |: C D E F |1 G A B c :|2 d e f g |]
      // notes: C=60 D=62 E=64 F=65 | G=67 A=69 B=71 c=72 | d=74 e=76 f=77 g=79
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: C D E F |1 G A B c :|2 d e f g |]'
      );
      const result = expandRepeats(music);
      // Pass 1: C D E F G A B c  (8 notes)
      // Pass 2: C D E F d e f g  (8 notes)
      expect(result.notes).toHaveLength(16);
      // Pass 1
      expect(p(result, 0)).toBe(60); // C
      expect(p(result, 3)).toBe(65); // F
      expect(p(result, 4)).toBe(67); // G (volta 1)
      expect(p(result, 7)).toBe(72); // c
      // Pass 2
      expect(p(result, 8)).toBe(60); // C
      expect(p(result, 11)).toBe(65); // F
      expect(p(result, 12)).toBe(74); // d (volta 2)
      expect(p(result, 15)).toBe(79); // g
      expect(result.originalIndices).toEqual([
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7, // pass 1: common + volta 1
        0,
        1,
        2,
        3,
        8,
        9,
        10,
        11, // pass 2: common + volta 2
      ]);
    });

    it('[1 ... :|2 (bracket form) works the same as |1 ... :|2', () => {
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: C D E F [1 G A B c :|2 d e f g |]'
      );
      const result = expandRepeats(music);
      expect(result.notes).toHaveLength(16);
      expect(p(result, 4)).toBe(67); // G in volta 1
      expect(p(result, 12)).toBe(74); // d in volta 2
    });

    it('volta 1 bar is correctly marked in parsed bars', () => {
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: C D E F |1 G A :|2 B c |]'
      );
      const volta1Bars = music.bars.filter((b) => b.volta === 1);
      const volta2Bars = music.bars.filter((b) => b.volta === 2);
      expect(volta1Bars).toHaveLength(1);
      expect(volta1Bars[0].type).toBe('standard');
      expect(volta2Bars).toHaveLength(1);
      expect(volta2Bars[0].type).toBe('end_repeat');
    });

    it('curves inside volta 1 are duplicated on the repeat', () => {
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: C D |1 E F :|2 G A |]'
      );
      // notes: C(0) D(1) | E(2) F(3) | G(4) A(5)
      // Add a curve within the common section
      music.curves = [[0, 1]];
      const result = expandRepeats(music);
      // Pass 1: C D E F, Pass 2: C D G A
      // Curve [0,1] (C-D) is in common section → should appear in both passes
      expect(result.curves).toContainEqual([0, 1]); // pass 1 common
      expect(result.curves).toContainEqual([4, 5]); // pass 2 common (offset 4)
    });
  });
});
