// eslint-disable-next-line storybook/no-renderer-packages
import type { Meta, StoryObj } from '@storybook/react';
import { Vexflow } from './Vexflow';
import { Music, Note, Duration, DurationModifier } from './music';

const meta = {
  title: 'Components/Vexflow',
  component: Vexflow,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Vexflow>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to create simple music for stories
const createSimpleMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  music.notes = [
    new Note(60, Duration.QUARTER),
    new Note(62, Duration.QUARTER),
    new Note(64, Duration.QUARTER),
    new Note(65, Duration.QUARTER),
  ];
  music.autobar();
  return music;
};

export const Default: Story = {
  args: {
    music: createSimpleMusic(),
    colorNotes: 0,
  },
};

export const ColoredNotes: Story = {
  args: {
    music: createSimpleMusic(),
    colorNotes: 2, // Color first two notes
  },
};

const createAccidentalsMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  // C, C#, D, Db - sharp, flat, natural
  music.notes = [
    new Note(60, Duration.QUARTER, [], undefined),
    new Note(61, Duration.QUARTER, [], '#'),
    new Note(62, Duration.QUARTER, [], undefined),
    new Note(61, Duration.QUARTER, [], 'b'),
  ];
  music.autobar();
  return music;
};

export const Accidentals: Story = {
  args: {
    music: createAccidentalsMusic(),
    colorNotes: 0,
  },
};

const createKeySignatureMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  music.keySignature = 'G'; // 1 sharp
  music.notes = [
    new Note(67, Duration.QUARTER),
    new Note(69, Duration.QUARTER),
    new Note(71, Duration.QUARTER),
    new Note(72, Duration.QUARTER),
  ];
  music.autobar();
  return music;
};

export const KeySignature: Story = {
  args: {
    music: createKeySignatureMusic(),
    colorNotes: 0,
  },
};

const createDecorationsMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  music.notes = [
    new Note(60, Duration.QUARTER, ['p']),
    new Note(62, Duration.QUARTER, ['mf', 'accent']),
    new Note(64, Duration.QUARTER, ['fermata']),
    new Note(65, Duration.QUARTER, ['staccato', 'trill']),
  ];
  music.autobar();
  return music;
};

export const Decorations: Story = {
  args: {
    music: createDecorationsMusic(),
    colorNotes: 0,
  },
};

const createGraceNotesMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  music.notes = [
    new Note(64, Duration.GRACE),
    new Note(65, Duration.QUARTER),
    new Note(67, Duration.GRACE_SLASH),
    new Note(65, Duration.QUARTER),
    new Note(64, Duration.QUARTER),
    new Note(62, Duration.QUARTER),
  ];
  music.autobar();
  return music;
};

export const GraceNotes: Story = {
  args: {
    music: createGraceNotesMusic(),
    colorNotes: 0,
  },
};

const createTripletsMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  // 6 triplet quarters fill one 4/4 bar (3 triplets = 2 beats, so 6 = 4 beats)
  music.notes = [
    new Note(60, Duration.QUARTER, [], undefined, DurationModifier.TRIPLET),
    new Note(62, Duration.QUARTER, [], undefined, DurationModifier.TRIPLET),
    new Note(64, Duration.QUARTER, [], undefined, DurationModifier.TRIPLET),
    new Note(65, Duration.QUARTER, [], undefined, DurationModifier.TRIPLET),
    new Note(64, Duration.QUARTER, [], undefined, DurationModifier.TRIPLET),
    new Note(62, Duration.QUARTER, [], undefined, DurationModifier.TRIPLET),
  ];
  // Manually define bars since autobar doesn't handle triplet rounding
  music.bars = [
    { afterNoteNum: undefined, type: 'standard' },
    { afterNoteNum: 5, type: 'standard' },
  ];
  return music;
};

export const Triplets: Story = {
  args: {
    music: createTripletsMusic(),
    colorNotes: 0,
  },
};

const createCrossLineTripletsMusic = () => {
  const music = new Music();
  music.beatsPerBar = 2;
  music.beatValue = 4;
  const T = (pitch: number) =>
    new Note(pitch, Duration.QUARTER, [], undefined, DurationModifier.TRIPLET);
  const Q = (pitch: number) => new Note(pitch, Duration.QUARTER);
  // At barsPerLine=3 (viewport 1000px): bars 0-1 are filler on line 0,
  // bar 2 (triplets) is last of line 0, bar 3 (triplets) is first of line 1.
  music.notes = [
    Q(60),
    Q(62),
    Q(64),
    Q(65),
    Q(60),
    Q(62),
    Q(64),
    Q(65),
    Q(60),
    Q(62),
    Q(64),
    T(64),
    T(62),
    T(60),
  ];
  music.bars = [
    { afterNoteNum: undefined, type: 'standard' },
    { afterNoteNum: 3, type: 'standard' },
    { afterNoteNum: 7, type: 'standard' },
    { afterNoteNum: 12, type: 'standard' },
  ];
  return music;
};

export const CrossLineTriplets: Story = {
  args: {
    music: createCrossLineTripletsMusic(),
    colorNotes: 0,
  },
};

const createCrossLineTieMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  // Enough notes to force a line break (~5 bars of 4/4)
  const bar = (pitches: number[]) =>
    pitches.map((p) => new Note(p, Duration.QUARTER));
  // At barsPerLine=3 (viewport 1000px): bars 0-2 on line 0, bar 3 starts line 1.
  // Tie note 11 (last of bar 2) → note 12 (first of bar 3) crosses the line boundary.
  music.notes = [
    ...bar([60, 62, 64, 65]),
    ...bar([67, 65, 64, 62]),
    ...bar([60, 62, 64, 65]),
    ...bar([67, 65, 64, 62]),
  ];
  music.curves = [[11, 12]];
  music.autobar();
  return music;
};

export const CrossLineTie: Story = {
  args: {
    music: createCrossLineTieMusic(),
    colorNotes: 0,
  },
};

const createBeamsMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
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
  // Beam all 8 notes together
  music.beams = [[0, 7]];
  music.autobar();
  return music;
};

export const Beams: Story = {
  args: {
    music: createBeamsMusic(),
    colorNotes: 0,
  },
};

const createRestsMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  music.notes = [
    new Note(60, Duration.QUARTER),
    new Note(undefined, Duration.QUARTER), // quarter rest
    new Note(64, Duration.QUARTER),
    new Note(undefined, Duration.QUARTER), // quarter rest
  ];
  music.autobar();
  return music;
};

export const Rests: Story = {
  args: {
    music: createRestsMusic(),
    colorNotes: 0,
  },
};

const createDottedNotesMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  music.notes = [
    new Note(60, Duration.HALF, [], undefined, DurationModifier.DOTTED),
    new Note(62, Duration.QUARTER),
  ];
  music.autobar();
  return music;
};

export const DottedNotes: Story = {
  args: {
    music: createDottedNotesMusic(),
    colorNotes: 0,
  },
};

const createSlursMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  music.notes = [
    new Note(60, Duration.QUARTER),
    new Note(62, Duration.QUARTER),
    new Note(64, Duration.QUARTER),
    new Note(65, Duration.QUARTER),
  ];
  music.curves = [
    [0, 1],
    [2, 3],
  ];
  music.autobar();
  return music;
};

export const Slurs: Story = {
  args: {
    music: createSlursMusic(),
    colorNotes: 0,
  },
};

export const EmptyMusic: Story = {
  args: {
    music: new Music(),
    colorNotes: 0,
  },
};

const createFreeTimeMusic = () => {
  const music = new Music();
  music.beatsPerBar = 4;
  music.beatValue = 4;
  // No bars set — free time mode. Enough notes to wrap to a second line.
  music.notes = [
    new Note(60, Duration.QUARTER),
    new Note(62, Duration.QUARTER),
    new Note(64, Duration.QUARTER),
    new Note(65, Duration.QUARTER),
    new Note(67, Duration.QUARTER),
    new Note(65, Duration.QUARTER),
    new Note(64, Duration.QUARTER),
    new Note(62, Duration.QUARTER),
    new Note(60, Duration.HALF),
    new Note(64, Duration.QUARTER),
    new Note(67, Duration.QUARTER),
    new Note(65, Duration.QUARTER),
    new Note(64, Duration.EIGHTH),
    new Note(62, Duration.EIGHTH),
    new Note(60, Duration.WHOLE),
  ];
  // bars is intentionally left empty
  return music;
};

export const FreeTime: Story = {
  args: {
    music: createFreeTimeMusic(),
    colorNotes: 0,
  },
};
