import { describe, it, expect } from 'vitest';
import {
  Note,
  Music,
  Duration,
  expandRepeats,
  ticksToDuration,
  findNearestExpandedIndex,
} from './music';
import { fromAbc } from './io/abcImport';

describe('Note', () => {
  describe('fromAbc', () => {
    it('should parse basic notes', () => {
      const note = Note.fromAbc('C', Duration.QUARTER, 0, {}, '', '');
      expect(note.pitches[0]).toBe(60); // C in octave 3 (MIDI C4)
      expect(note.duration).toBe(Duration.QUARTER);
    });

    it('should parse lowercase notes in higher octave', () => {
      const note = Note.fromAbc('c', Duration.QUARTER, 0, {}, '', '');
      expect(note.pitches[0]).toBe(72); // c in octave 4 (MIDI C5)
    });

    it('should parse all note names', () => {
      const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      const expectedPitches = [60, 62, 64, 65, 67, 69, 71];

      notes.forEach((noteName, i) => {
        const note = Note.fromAbc(noteName, Duration.QUARTER, 0, {}, '', '');
        expect(note.pitches[0]).toBe(expectedPitches[i]);
      });
    });

    it('should handle octave modifiers with commas', () => {
      const c2 = Note.fromAbc('C,', Duration.QUARTER, 0, {}, '', '');
      expect(c2.pitches[0]).toBe(48); // C in octave 2 (MIDI C3)

      const c1 = Note.fromAbc('C,,', Duration.QUARTER, 0, {}, '', '');
      expect(c1.pitches[0]).toBe(36); // C in octave 1 (MIDI C2)

      const c0 = Note.fromAbc('C,,,', Duration.QUARTER, 0, {}, '', '');
      expect(c0.pitches[0]).toBe(24); // C in octave 0 (MIDI C1)
    });

    it('should handle octave modifiers with apostrophes', () => {
      const c5 = Note.fromAbc("c'", Duration.QUARTER, 0, {}, '', '');
      expect(c5.pitches[0]).toBe(84); // C in octave 5 (MIDI C6)

      const c6 = Note.fromAbc("c''", Duration.QUARTER, 0, {}, '', '');
      expect(c6.pitches[0]).toBe(96); // C in octave 6 (MIDI C7)

      const c7 = Note.fromAbc("c'''", Duration.QUARTER, 0, {}, '', '');
      expect(c7.pitches[0]).toBe(108); // C in octave 7 (MIDI C8)
    });

    it('should handle sharp accidentals', () => {
      const cSharp = Note.fromAbc('C', Duration.QUARTER, 0, {}, '^', '');
      expect(cSharp.pitches[0]).toBe(61); // C#
      expect(cSharp.accidentals[0]).toBe('#');
    });

    it('should handle flat accidentals', () => {
      const bFlat = Note.fromAbc('B', Duration.QUARTER, 0, {}, '_', '');
      expect(bFlat.pitches[0]).toBe(70); // Bb
      expect(bFlat.accidentals[0]).toBe('b');
    });

    it('should handle natural accidentals', () => {
      const eNatural = Note.fromAbc('E', Duration.QUARTER, 0, {}, '=', '');
      expect(eNatural.accidentals[0]).toBe('n');
    });

    it('should apply key adjustment', () => {
      const keyAdj = { F: 1 }; // G major: F#
      const fSharp = Note.fromAbc('F', Duration.QUARTER, 0, keyAdj, '', '');
      expect(fSharp.pitches[0]).toBe(66); // F#
    });

    it('should override key adjustment with explicit accidental', () => {
      const keyAdj = { F: 1 }; // G major: F#
      const fNatural = Note.fromAbc('F', Duration.QUARTER, 0, keyAdj, '=', '');
      expect(fNatural.accidentals[0]).toBe('n');
    });

    it('should parse rest with Z', () => {
      const rest = Note.fromAbc('Z', Duration.QUARTER, 0, {}, '', '');
      expect(rest.pitches).toHaveLength(0);
    });

    it('should parse rest with X', () => {
      const rest = Note.fromAbc('X', Duration.QUARTER, 0, {}, '', '');
      expect(rest.pitches).toHaveLength(0);
    });

    it('should parse fermata decoration', () => {
      const fermata = Note.fromAbc('C', Duration.QUARTER, 0, {}, '', 'H');
      expect(fermata.decorations).toContain('fermata');
    });

    it('should parse multiple decorations', () => {
      const note = Note.fromAbc('C', Duration.QUARTER, 0, {}, '', 'L.');
      expect(note.decorations).toContain('accent');
      expect(note.decorations).toContain('staccato');
    });

    it('should parse dynamics decorations', () => {
      const pp = Note.fromAbc('C', Duration.QUARTER, 0, {}, '', '!pp!');
      expect(pp.decorations).toContain('pp');

      const ff = Note.fromAbc('C', Duration.QUARTER, 0, {}, '', '!ff!');
      expect(ff.decorations).toContain('ff');
    });

    it('should throw error for unknown note', () => {
      expect(() => {
        Note.fromAbc('Q', Duration.QUARTER, 0, {}, '', '');
      }).toThrow('Unknown ABC note Q');
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
    it('returns 0 for grace durations', () => {
      expect(new Note(60, Duration.GRACE).ticks()).toBe(0);
      expect(new Note(60, Duration.GRACE_SLASH).ticks()).toBe(0);
    });

    it('returns correct ticks for undotted notes', () => {
      expect(new Note(60, Duration.WHOLE).ticks()).toBe(4096);
      expect(new Note(60, Duration.HALF).ticks()).toBe(2048);
      expect(new Note(60, Duration.QUARTER).ticks()).toBe(1024);
      expect(new Note(60, Duration.EIGHTH).ticks()).toBe(512);
      expect(new Note(60, Duration.SIXTEENTH).ticks()).toBe(256);
    });

    it('returns 1.5× base for dotted notes (dots=1)', () => {
      expect(new Note(60, Duration.HALF, [], undefined, 1).ticks()).toBe(3072);
      expect(new Note(60, Duration.QUARTER, [], undefined, 1).ticks()).toBe(
        1536
      );
      expect(new Note(60, Duration.EIGHTH, [], undefined, 1).ticks()).toBe(768);
    });

    it('returns 1.75× base for double-dotted notes (dots=2)', () => {
      expect(new Note(60, Duration.QUARTER, [], undefined, 2).ticks()).toBe(
        1792
      );
      expect(new Note(60, Duration.HALF, [], undefined, 2).ticks()).toBe(3584);
    });

    it('returns scaled ticks for triplet (3:2)', () => {
      const note = new Note(60, Duration.QUARTER);
      note.tuplet = { actual: 3, written: 2, groupSize: 3 };
      // quarter = 1024, × 2/3 = 682.67 → 683
      expect(note.ticks()).toBe(683);
    });

    it('returns scaled ticks for duplet (2:3)', () => {
      const note = new Note(60, Duration.QUARTER);
      note.tuplet = { actual: 2, written: 3, groupSize: 2 };
      // quarter = 1024, × 3/2 = 1536
      expect(note.ticks()).toBe(1536);
    });

    it('returns scaled ticks for quadruplet (4:3)', () => {
      const note = new Note(60, Duration.QUARTER);
      note.tuplet = { actual: 4, written: 3, groupSize: 4 };
      // quarter = 1024, × 3/4 = 768
      expect(note.ticks()).toBe(768);
    });

    it('returns scaled ticks for quintuplet (5:2) in simple time', () => {
      const note = new Note(60, Duration.QUARTER);
      note.tuplet = { actual: 5, written: 2, groupSize: 5 };
      // quarter = 1024, × 2/5 = 409.6 → 410
      expect(note.ticks()).toBe(410);
    });
  });

  describe('chord construction', () => {
    it('supports multiple pitches', () => {
      const chord = new Note([60, 64, 67], Duration.QUARTER);
      expect(chord.pitches).toEqual([60, 64, 67]);
      expect(chord.accidentals).toHaveLength(3);
    });
  });
});

describe('Music', () => {
  describe('reflow', () => {
    it('should create bars for 4/4 time', () => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
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
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
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
      music.signatures[0].beatsPerBar = 3;
      music.signatures[0].beatValue = 4;
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
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [];
      music.reflow();
      expect(music.bars).toHaveLength(1);
      expect(music.bars[0].type).toBe('begin');
    });

    it('should handle 6/8 time with eighth notes', () => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 6;
      music.signatures[0].beatValue = 8;
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
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      // Dotted half (3072 ticks) + half (2048 ticks) = 5 beats, overflows 4/4
      // Expected: dotted-half fits bar 1, remaining quarter+half split into bar 2
      // Actually: dotted-half = 3 beats, bar = 4 beats, remainder = 1 beat (quarter)
      // Half note (2048) = 2 beats; crosses bar: split into quarter (1024) + quarter (1024)
      music.notes = [
        new Note(60, Duration.HALF, [], undefined, 1),
        new Note(62, Duration.HALF),
      ];

      music.reflow();

      // dotted half fills 3 beats, then half note: 1 beat fits in bar 1, 1 beat in bar 2
      expect(music.notes).toHaveLength(3);
      expect(music.notes[0].duration).toBe(Duration.HALF);
      expect(music.notes[0].dots).toBe(1);
      expect(music.notes[1].duration).toBe(Duration.QUARTER);
      expect(music.notes[2].duration).toBe(Duration.QUARTER);
      // tie between notes[1] and notes[2]
      expect(music.curves).toContainEqual([1, 2]);
      // bar after note[1] (index 1)
      expect(music.bars.some((b) => b.afterNoteNum === 1)).toBe(true);
    });

    it('splits a whole-note rest across multiple 3/8 bars', () => {
      // z8 (whole = 4096 ticks) in 3/8 (bar = 1536 ticks): overflow of 2560 is
      // not a single standard duration — should still split correctly.
      const music = new Music();
      music.signatures[0].beatsPerBar = 3;
      music.signatures[0].beatValue = 8;
      music.notes = [new Note(undefined, Duration.WHOLE)];
      music.reflow();
      // whole rest should have been split into multiple notes across bars
      expect(music.notes.length).toBeGreaterThan(1);
      // all bars (except begin) should have valid afterNoteNum
      const realBars = music.bars.filter((b) => b.afterNoteNum !== undefined);
      expect(realBars.length).toBeGreaterThan(0);
      // total ticks should be preserved
      const totalTicks = music.notes.reduce((s, n) => s + n.ticks(), 0);
      expect(totalTicks).toBe(4096);
    });

    it('splits a note spanning more than two bars in 4/4', () => {
      // A whole note crossing a bar boundary when the bar is already half full:
      // currentTicks=2048 (half), whole(4096) overflows by 6144-4096=... let's
      // use a simpler case: two whole notes in 3/8 (each spans ~2.67 bars).
      const music = new Music();
      music.signatures[0].beatsPerBar = 3;
      music.signatures[0].beatValue = 8;
      music.notes = [
        new Note(undefined, Duration.WHOLE),
        new Note(undefined, Duration.WHOLE),
      ];
      music.reflow();
      const realBars = music.bars.filter((b) => b.afterNoteNum !== undefined);
      // 8192 ticks / 1536 per bar ≈ 5.33 bars → at least 5 bar lines
      expect(realBars.length).toBeGreaterThanOrEqual(5);
      const totalTicks = music.notes.reduce((s, n) => s + n.ticks(), 0);
      expect(totalTicks).toBe(8192);
    });

    it('merges tied same-pitch notes whose combined duration is standard', () => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
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

    it('multi-bar first ending plays common+volta1 then common+volta2', () => {
      // |: A B |1 C | D :|2 E |]
      // The first ending spans two bars: C and D.
      // The intermediate | bar (after C) has no volta annotation and must not
      // be processed as part of the common section.
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: A B |1 C D | E F :|2 G |]'
      );
      const result = expandRepeats(music);
      // notes: A(0) B(1) C(2) D(3) E(4) F(5) G(6)
      // Pass 1: A B (common) + C D E F (volta 1) = 6 notes
      // Pass 2: A B (common) + G (volta 2) = 3 notes → total 9
      // MIDI (uppercase): A=69 B=71 C=60 D=62 E=64 F=65 G=67
      expect(result.notes).toHaveLength(9);
      expect(p(result, 0)).toBe(69); // A
      expect(p(result, 1)).toBe(71); // B
      expect(p(result, 2)).toBe(60); // C (volta 1 start)
      expect(p(result, 5)).toBe(65); // F (volta 1 end)
      expect(p(result, 6)).toBe(69); // A (repeat)
      expect(p(result, 7)).toBe(71); // B
      expect(p(result, 8)).toBe(67); // G (volta 2)
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

  describe('DC/DS navigation', () => {
    it('!d.c.! plays the piece twice', () => {
      // C(60) D(62) E(64) !d.c.! on last note
      const music = fromAbc('X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nC D !d.c.!E');
      const result = expandRepeats(music);
      // First pass: C D E, second pass: C D E
      expect(result.notes).toHaveLength(6);
      expect(result.originalIndices).toEqual([0, 1, 2, 0, 1, 2]);
    });

    it('!d.c.alfine! stops at !fine! on the return pass', () => {
      // C(60) !fine!D(62) E(64) !d.c.alfine!F(65)
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nC !fine!D E !d.c.alfine!F'
      );
      const result = expandRepeats(music);
      // First pass: C D E F, return: C D (stops at fine, inclusive)
      expect(result.notes).toHaveLength(6);
      expect(result.originalIndices).toEqual([0, 1, 2, 3, 0, 1]);
    });

    it('!d.c.alcoda! with two !coda! marks: stop at first, jump to last', () => {
      // !coda!C(60) D(62) !d.c.alcoda!E(64) !coda!F(65) G(67)
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n!coda!C D !d.c.alcoda!E !coda!F G'
      );
      const result = expandRepeats(music);
      // First pass: C D E F G
      // Return from start: stop at first !coda! (C, index 0), inclusive
      // Jump to last !coda! (F, index 3), play to end: F G
      expect(result.originalIndices).toEqual([0, 1, 2, 3, 4, 0, 3, 4]);
    });

    it('!d.c.alcoda! with !alcoda! stop point and !coda! jump target', () => {
      // C(60) !alcoda!D(62) E(64) !d.c.alcoda!F(65) !coda!G(67) A(69)
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nC !alcoda!D E !d.c.alcoda!F !coda!G A'
      );
      const result = expandRepeats(music);
      // First pass: C D E F G A
      // Return: C D (stop at alcoda, index 1)
      // Jump to !coda! (G, index 4): G A
      expect(result.originalIndices).toEqual([0, 1, 2, 3, 4, 5, 0, 1, 4, 5]);
    });

    it('!d.s.alfine! returns to !segno! and stops at !fine!', () => {
      // A(69) B(71) !segno!C(60) D(62) !fine!E(64) F(65) !d.s.alfine!G(67)
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nA B !segno!C D !fine!E F !d.s.alfine!G'
      );
      const result = expandRepeats(music);
      // First pass: A B C D E F G (indices 0-6)
      // Return to segno (C=index 2): C D E (stops at fine, index 4, inclusive)
      expect(result.originalIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 2, 3, 4]);
    });

    it('!d.s.alcoda! returns to !segno!, stops at !alcoda!, jumps to !coda!', () => {
      // A(69) !segno!B(71) !alcoda!C(60) D(62) !d.s.alcoda!E(64) !coda!F(65) G(67)
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nA !segno!B !alcoda!C D !d.s.alcoda!E !coda!F G'
      );
      const result = expandRepeats(music);
      // First pass: A B C D E F G (indices 0-6)
      // Return to segno (B=1): B C (stop at alcoda=2)
      // Jump to coda (F=5): F G
      expect(result.originalIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 1, 2, 5, 6]);
    });

    it('!d.c.! skips repeats on the return pass', () => {
      // |: C D :| !d.c.!E  — first pass plays C D C D E; return plays C D E (no repeat)
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/2\nK:C\n|: C D :| !d.c.!E z'
      );
      const result = expandRepeats(music);
      // First pass: C D C D E z (indices 0 1 0 1 2 3)
      // Return (no repeat): C D E z (indices 0 1 2 3)
      expect(result.originalIndices).toEqual([0, 1, 0, 1, 2, 3, 0, 1, 2, 3]);
    });

    it('!d.c.! with volta brackets skips volta 1 on the return pass', () => {
      // |: C D |1 E :|2 F | !d.c.!G
      // notes: C(60)=0 D(62)=1 E(64)=2 F(65)=3 G(67)=4
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: C D z z |1 E z z z :|2 F z z z | !d.c.!G z z z'
      );
      const result = expandRepeats(music);
      // First pass (with volta): C D z z E z z z (pass1) + C D z z F z z z (pass2) + G z z z
      // Return (no repeats, skip volta 1): C D z z F z z z G z z z
      const origIdx = result.originalIndices;
      const firstPassEnd = origIdx.indexOf(4); // first G in expanded
      // After first G, return pass should not contain volta-1 notes (index 4,5,6,7 = E z z z)
      const returnPassIndices = origIdx.slice(firstPassEnd + 4); // after G z z z first occurrence
      expect(returnPassIndices).not.toContain(4); // E (volta-1) should be skipped
      expect(returnPassIndices).toContain(8); // F (volta-2) should be present
    });

    it('case-insensitive: !Fine! and !D.C.alfine! parse correctly', () => {
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n!Fine!C !D.C.alfine!D'
      );
      expect(music.notes[0].decorations).toContain('fine');
      expect(music.notes[1].decorations).toContain('d.c.alfine');
    });

    it('handles :|2 volta (second ending on the end_repeat bar itself)', () => {
      // |: C D :|2 E | F means: play C D, repeat, C D, then E F
      const music = fromAbc(
        'X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: C D z z :|2 E z z z | F z z z |]'
      );
      const result = expandRepeats(music);
      const pitches = result.notes.map((n) => n.pitches[0] ?? null);
      // Pass 1: C D z z; pass 2: C D z z; volta 2: E z z z; then F z z z
      expect(pitches.filter((p) => p === 60).length).toBe(2); // C appears twice
      expect(pitches).toContain(64); // E (volta 2) is present
      expect(pitches).toContain(65); // F is present
    });
  });
});

describe('ticksToDuration', () => {
  it('returns correct duration for standard note lengths', () => {
    expect(ticksToDuration(4096)).toEqual([Duration.WHOLE, 0]);
    expect(ticksToDuration(2048)).toEqual([Duration.HALF, 0]);
    expect(ticksToDuration(1024)).toEqual([Duration.QUARTER, 0]);
    expect(ticksToDuration(512)).toEqual([Duration.EIGHTH, 0]);
    expect(ticksToDuration(256)).toEqual([Duration.SIXTEENTH, 0]);
  });

  it('returns dotted durations', () => {
    expect(ticksToDuration(3072)).toEqual([Duration.HALF, 1]);
    expect(ticksToDuration(1536)).toEqual([Duration.QUARTER, 1]);
    expect(ticksToDuration(768)).toEqual([Duration.EIGHTH, 1]);
  });

  it('returns null for unrecognised tick counts', () => {
    expect(ticksToDuration(999)).toBeNull();
    expect(ticksToDuration(0)).toBeNull();
    expect(ticksToDuration(1)).toBeNull();
  });
});

describe('findNearestExpandedIndex', () => {
  it('returns the expanded index that maps to targetOrigIdx', () => {
    const indices = [0, 1, 2, 0, 1, 2];
    expect(findNearestExpandedIndex(indices, 1, 0)).toBe(1);
  });

  it('returns -1 when targetOrigIdx is not in originalIndices', () => {
    const indices = [0, 1, 2];
    expect(findNearestExpandedIndex(indices, 5, 0)).toBe(-1);
  });

  it('picks the occurrence closest to currentExpandedIdx', () => {
    // orig index 1 appears at expanded positions 1 and 4
    const indices = [0, 1, 2, 0, 1, 2];
    // closest to expanded position 3 → position 4
    expect(findNearestExpandedIndex(indices, 1, 3)).toBe(4);
    // closest to expanded position 0 → position 1
    expect(findNearestExpandedIndex(indices, 1, 0)).toBe(1);
  });

  it('handles empty originalIndices array', () => {
    expect(findNearestExpandedIndex([], 0, 0)).toBe(-1);
  });
});
