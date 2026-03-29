// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/react';
import { Music, Note, Duration, DurationModifier, type BarLine } from '../music';
import { Score } from './Score';

const meta = {
  title: 'Notation/Score',
  component: Score,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Score>;

export default meta;
type Story = StoryObj<typeof meta>;

const WIDTH = 720;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { Accidental } from '../music';

const Q = (pitch: number | undefined, acc?: Accidental) =>
  new Note(pitch as number, Duration.QUARTER, [], acc);

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

const createSimpleMusic = () => {
  const music = new Music();
  music.signatures[0].beatsPerBar = 4;
  music.signatures[0].beatValue = 4;
  music.notes = [Q(60), Q(62), Q(64), Q(65)];
  music.reflow();
  return music;
};

export const Default: Story = {
  args: { music: createSimpleMusic(), width: WIDTH },
};

export const EmptyMusic: Story = {
  args: { music: new Music(), width: WIDTH },
};

// --- Accidentals ---

export const Accidentals: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [Q(60), Q(61, '#'), Q(62), Q(61, 'b')];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Key signature ---

export const KeySignature: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.signatures[0].keySignature = 'G'; // 1 sharp
      music.notes = [Q(67), Q(69), Q(71), Q(72)];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

export const FlatKeySignature: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.signatures[0].keySignature = 'F'; // 1 flat
      music.notes = [Q(65), Q(67), Q(69), Q(70)];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Decorations ---

export const Decorations: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [
        new Note(60, Duration.QUARTER, ['p']),
        new Note(62, Duration.QUARTER, ['mf', 'accent']),
        new Note(64, Duration.QUARTER, ['fermata']),
        new Note(65, Duration.QUARTER, ['staccato', 'trill']),
        new Note(67, Duration.QUARTER, ['breath']),
      ];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Grace notes ---

export const GraceNotes: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [
        new Note(64, Duration.GRACE),
        new Note(65, Duration.QUARTER),
        new Note(67, Duration.GRACE_SLASH),
        new Note(65, Duration.QUARTER),
        new Note(64, Duration.QUARTER),
        new Note(62, Duration.QUARTER),
      ];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Rests ---

export const Rests: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [
        Q(60),
        new Note(undefined as unknown as number, Duration.QUARTER),
        Q(64),
        new Note(undefined as unknown as number, Duration.HALF),
      ];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Dotted notes ---

export const DottedNotes: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [
        new Note(60, Duration.HALF, [], undefined, DurationModifier.DOTTED),
        new Note(62, Duration.QUARTER),
      ];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Beams ---

export const Beams: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [
        new Note(60, Duration.EIGHTH),
        new Note(62, Duration.EIGHTH),
        new Note(64, Duration.EIGHTH),
        new Note(65, Duration.EIGHTH),
        new Note(67, Duration.EIGHTH),
        new Note(65, Duration.EIGHTH),
        new Note(64, Duration.EIGHTH),
        new Note(62, Duration.EIGHTH),
      ];
      music.beams = [[0, 7]];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Slurs ---

export const Slurs: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [Q(60), Q(62), Q(64), Q(65)];
      music.curves = [[0, 1], [2, 3]];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Triplets ---

export const Triplets: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      const T = (p: number) =>
        new Note(p, Duration.QUARTER, [], undefined, DurationModifier.TRIPLET);
      music.notes = [T(60), T(62), T(64), T(65), T(64), T(62)];
      music.bars = [
        { afterNoteNum: undefined, type: 'standard' },
        { afterNoteNum: 5, type: 'standard' },
      ];
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Cross-line tie ---

export const CrossLineTie: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      const bar = (pitches: number[]) =>
        pitches.map((p) => new Note(p, Duration.QUARTER));
      music.notes = [
        ...bar([60, 62, 64, 65]),
        ...bar([67, 65, 64, 62]),
        ...bar([60, 62, 64, 65]),
        ...bar([67, 65, 64, 62]),
      ];
      music.curves = [[11, 12]];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Cross-line triplets ---

export const CrossLineTriplets: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 2;
      music.signatures[0].beatValue = 4;
      const T = (p: number) =>
        new Note(p, Duration.QUARTER, [], undefined, DurationModifier.TRIPLET);
      const Qn = (p: number) => new Note(p, Duration.QUARTER);
      music.notes = [
        Qn(60), Qn(62), Qn(64), Qn(65),
        Qn(60), Qn(62), Qn(64), Qn(65),
        Qn(60), Qn(62), Qn(64),
        T(64), T(62), T(60),
      ];
      music.bars = [
        { afterNoteNum: undefined, type: 'standard' },
        { afterNoteNum: 3, type: 'standard' },
        { afterNoteNum: 7, type: 'standard' },
        { afterNoteNum: 12, type: 'standard' },
      ];
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Volta brackets ---

export const VoltaBrackets: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [
        Q(60), Q(62), Q(64), Q(65), // common
        Q(67), Q(69), Q(71), Q(72), // volta 1
        Q(62), Q(64), Q(65), Q(72), // volta 2
      ];
      const bars: BarLine[] = [
        { afterNoteNum: undefined, type: 'begin_repeat' },
        { afterNoteNum: 3, type: 'standard', volta: 1 },
        { afterNoteNum: 7, type: 'end_repeat', volta: 2 },
        { afterNoteNum: 11, type: 'end' },
      ];
      music.bars = bars;
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Begin-repeat on first bar (preamble gap) ---

export const BeginRepeat: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [Q(60), Q(62), Q(64), Q(65), Q(67), Q(65), Q(64), Q(62)];
      music.bars = [
        { afterNoteNum: undefined, type: 'begin_repeat' },
        { afterNoteNum: 3, type: 'end_repeat' },
        { afterNoteNum: 7, type: 'end' },
      ];
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Begin-repeat wrapping to a new line ---

export const BeginRepeatNewLine: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      const bar = (pitches: number[]) =>
        pitches.map((p) => new Note(p, Duration.QUARTER));
      music.notes = [
        ...bar([60, 62, 64, 65]),
        ...bar([67, 65, 64, 62]),
        ...bar([60, 62, 64, 65]),
        ...bar([67, 65, 64, 62]),
        ...bar([60, 62, 64, 65]),
      ];
      music.bars = [
        { afterNoteNum: undefined, type: 'standard' },
        { afterNoteNum: 3, type: 'end_repeat' },
        { afterNoteNum: 7, type: 'standard' },
        { afterNoteNum: 11, type: 'begin_repeat' },
        { afterNoteNum: 15, type: 'end_repeat' },
        { afterNoteNum: 19, type: 'end' },
      ];
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Bass clef ---

export const BassClef: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.clef = 'bass';
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [
        new Note(48, Duration.QUARTER), // C3
        new Note(50, Duration.QUARTER), // D3
        new Note(52, Duration.QUARTER), // E3
        new Note(53, Duration.QUARTER), // F3
      ];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Lyrics ---

export const Lyrics: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [Q(60), Q(62), Q(64), Q(65)];
      music.lyrics = [['do', 're', 'mi', 'fa']];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Multi-verse lyrics ---

export const MultiVerseLyrics: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [Q(60), Q(62), Q(64), Q(65)];
      music.lyrics = [
        ['do', 're', 'mi', 'fa'],
        ['one', 'two', 'three', 'four'],
      ];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Note results (correct / wrong coloring) ---

export const NoteResults: Story = {
  args: {
    music: createSimpleMusic(),
    width: WIDTH,
    noteResults: new Map([
      [0, 'correct'],
      [1, 'wrong'],
      [2, 'correct'],
    ]),
  },
};

// --- Cursor ---

export const WithCursor: Story = {
  args: {
    music: createSimpleMusic(),
    width: WIDTH,
    cursor: { noteIdx: 1 },
  },
};

// --- Multi-line (enough bars to wrap) ---

export const MultiLine: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      const bar = (pitches: number[]) =>
        pitches.map((p) => new Note(p, Duration.QUARTER));
      music.notes = [
        ...bar([60, 62, 64, 65]),
        ...bar([67, 65, 64, 62]),
        ...bar([60, 62, 64, 65]),
        ...bar([67, 65, 64, 62]),
        ...bar([60, 62, 64, 65]),
        ...bar([67, 65, 64, 62]),
      ];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- RTL layout should not corrupt rendering ---

export const RtlLayout: Story = {
  args: { music: createSimpleMusic(), width: WIDTH },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};

// --- Whole and half notes / rests ---

export const LongDurations: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.notes = [
        new Note(60, Duration.WHOLE),
        new Note(62, Duration.HALF),
        new Note(64, Duration.HALF),
      ];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};

// --- Tempo mark ---

export const TempoMark: Story = {
  args: {
    music: (() => {
      const music = new Music();
      music.signatures[0].beatsPerBar = 4;
      music.signatures[0].beatValue = 4;
      music.signatures[0].tempo = 120;
      music.signatures[0].tempoText = 'Allegro';
      music.notes = [Q(60), Q(62), Q(64), Q(65)];
      music.reflow();
      return music;
    })(),
    width: WIDTH,
  },
};
