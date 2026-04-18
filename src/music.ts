import { NOTE_VALUES, PITCH_CONSTANTS, DURATION_TICKS } from './constants';

export const Duration = {
  WHOLE: 'w',
  HALF: 'h',
  QUARTER: 'q',
  EIGHTH: '8',
  SIXTEENTH: '16',
  THIRTY_SECOND: '32',
  GRACE: 'grace',
  GRACE_SLASH: 'grace-slash',
} as const;
export type Duration = (typeof Duration)[keyof typeof Duration];

/** Tuplet grouping metadata stored on each note of a tuplet. */
export interface Tuplet {
  /** The number displayed above the bracket (how many notes are played). */
  actual: number;
  /** "In the time of" this many written notes — determines duration ratio. */
  written: number;
  /** Total notes in this tuplet group (for rendering group boundaries). */
  groupSize: number;
}

/** Maps a key signature name to its position on the circle of fifths
 *  (positive = sharps, negative = flats). */
export const KEYS: Record<string, number> = {
  // Ionian (major)
  'C#': 7,
  'F#': 6,
  B: 5,
  E: 4,
  A: 3,
  D: 2,
  G: 1,
  C: 0,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7,
  // Aeolian (natural minor)
  'A#m': 7,
  'D#m': 6,
  'G#m': 5,
  'C#m': 4,
  'F#m': 3,
  Bm: 2,
  Em: 1,
  Am: 0,
  Dm: -1,
  Gm: -2,
  Cm: -3,
  Fm: -4,
  Bbm: -5,
  Ebm: -6,
  Abm: -7,
  // Mixolydian (one flat relative to major)
  'G#Mix': 7,
  'C#Mix': 6,
  'F#Mix': 5,
  BMix: 4,
  EMix: 3,
  AMix: 2,
  DMix: 1,
  GMix: 0,
  CMix: -1,
  FMix: -2,
  BbMix: -3,
  EbMix: -4,
  AbMix: -5,
  DbMix: -6,
  GbMix: -7,
  // Dorian (two flats relative to major)
  'D#Dor': 7,
  'G#Dor': 6,
  'C#Dor': 5,
  'F#Dor': 4,
  BDor: 3,
  EDor: 2,
  ADor: 1,
  DDor: 0,
  GDor: -1,
  CDor: -2,
  FDor: -3,
  BbDor: -4,
  EbDor: -5,
  AbDor: -6,
  DbDor: -7,
  // Phrygian (three flats relative to major)
  'E#Phr': 7,
  'A#Phr': 6,
  'D#Phr': 5,
  'G#Phr': 4,
  'C#Phr': 3,
  'F#Phr': 2,
  BPhr: 1,
  EPhr: 0,
  APhr: -1,
  DPhr: -2,
  GPhr: -3,
  CPhr: -4,
  FPhr: -5,
  BbPhr: -6,
  EbPhr: -7,
  // Lydian (one sharp relative to major)
  'F#Lyd': 7,
  BLyd: 6,
  ELyd: 5,
  ALyd: 4,
  DLyd: 3,
  GLyd: 2,
  CLyd: 1,
  FLyd: 0,
  BbLyd: -1,
  EbLyd: -2,
  AbLyd: -3,
  DbLyd: -4,
  GbLyd: -5,
  CbLyd: -6,
  FbLyd: -7,
  // Locrian (four flats relative to major)
  'B#Loc': 7,
  'E#Loc': 6,
  'A#Loc': 5,
  'D#Loc': 4,
  'G#Loc': 3,
  'C#Loc': 2,
  'F#Loc': 1,
  BLoc: 0,
  ELoc: -1,
  ALoc: -2,
  DLoc: -3,
  GLoc: -4,
  CLoc: -5,
  FLoc: -6,
  BbLoc: -7,
};

/** Maps a circle-of-fifths position to the accidentals active in that key
 *  (e.g. 1 → ['F#'], -2 → ['Bb', 'Eb']). */
export const FIFTHS_TO_ACCIDENTALS: Record<number, string[]> = {
  7: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'],
  6: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
  5: ['F#', 'C#', 'G#', 'D#', 'A#'],
  4: ['F#', 'C#', 'G#', 'D#'],
  3: ['F#', 'C#', 'G#'],
  2: ['F#', 'C#'],
  1: ['F#'],
  0: [],
  [-1]: ['Bb'],
  [-2]: ['Bb', 'Eb'],
  [-3]: ['Bb', 'Eb', 'Ab'],
  [-4]: ['Bb', 'Eb', 'Ab', 'Db'],
  [-5]: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
  [-6]: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
  [-7]: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
};

export type BarLineType =
  | 'begin'
  | 'standard'
  | 'double'
  | 'begin_repeat'
  | 'end_repeat'
  | 'begin_end_repeat'
  | 'end';
export type Accidental = '##' | '#' | 'b' | 'bb' | 'n' | undefined;
export type Decoration =
  | 'accent'
  | 'breath'
  | 'fermata'
  | 'lowermordent'
  | 'uppermordent'
  | 'upbow'
  | 'downbow'
  | 'staccato'
  | 'tenuto'
  | 'trill'
  | 'roll'
  | 'coda'
  | 'segno'
  | 'fine'
  | 'alcoda'
  | 'd.c.'
  | 'd.c.alfine'
  | 'd.c.alcoda'
  | 'd.s.'
  | 'd.s.alfine'
  | 'd.s.alcoda'
  | 'turn'
  | 'turnx'
  | 'invertedturn'
  | 'invertedturnx'
  | 'slide'
  | 'snap'
  | 'lhpizz'
  | 'open'
  | 'tremolo1'
  | 'tremolo2'
  | 'tremolo3'
  | 'tremolo4'
  | 'pppp'
  | 'ppp'
  | 'pp'
  | 'p'
  | 'mp'
  | 'mf'
  | 'f'
  | 'ff'
  | 'fff'
  | 'ffff';

export type SpanDecorationType = 'trill' | 'crescendo' | 'diminuendo';
export interface SpanDecoration {
  type: SpanDecorationType;
  startNoteIndex: number;
  endNoteIndex: number;
}

export type AnnotationPlacement = 'above' | 'below' | 'left' | 'right' | 'auto';
export interface Annotation {
  placement: AnnotationPlacement;
  text: string;
}

export class Note {
  // Empty array means rest; one element = single note; multiple = chord.
  pitches: number[];
  duration: Duration;
  /** Number of augmentation dots (0 = none, 1 = dotted, 2 = double-dotted). */
  dots: number;
  /** Tuplet grouping, if this note belongs to a tuplet. */
  tuplet: Tuplet | undefined;
  // Parallel to pitches: accidentals[i] applies to pitches[i].
  accidentals: Accidental[];
  decorations: Decoration[];
  annotations: Annotation[];

  constructor(
    pitch: number | number[] | undefined = undefined,
    duration: Duration = Duration.QUARTER,
    decorations: Decoration[] = [],
    accidental: Accidental | Accidental[] = undefined,
    dots: number = 0
  ) {
    if (pitch === undefined) {
      this.pitches = [];
    } else if (Array.isArray(pitch)) {
      this.pitches = pitch;
    } else {
      this.pitches = [pitch];
    }
    this.duration = duration;
    this.dots = dots;
    this.tuplet = undefined;
    // TODO: should we have a "invisible" rest? (like x in abc notation)
    if (Array.isArray(accidental)) {
      this.accidentals = accidental;
    } else {
      this.accidentals = this.pitches.map(() => accidental);
    }
    this.decorations = decorations;
    this.annotations = [];
  }

  ticks(): number {
    const base: Record<Duration, number> = {
      [Duration.WHOLE]: DURATION_TICKS.WHOLE,
      [Duration.HALF]: DURATION_TICKS.HALF,
      [Duration.QUARTER]: DURATION_TICKS.QUARTER,
      [Duration.EIGHTH]: DURATION_TICKS.EIGHTH,
      [Duration.SIXTEENTH]: DURATION_TICKS.SIXTEENTH,
      [Duration.THIRTY_SECOND]: DURATION_TICKS.THIRTY_SECOND,
      [Duration.GRACE]: 0,
      [Duration.GRACE_SLASH]: 0,
    };
    const t = base[this.duration];
    if (this.dots > 0) return t * (2 - 1 / 2 ** this.dots);
    if (this.tuplet)
      return Math.round((t * this.tuplet.written) / this.tuplet.actual);
    return t;
  }

  static fromAbc(
    note: string,
    duration: Duration,
    dots: number,
    keyAdjustment: { [note: string]: number },
    accidental: string,
    decoration: string,
    text: string = '',
    barAccidentals: { [note: string]: number } = {}
  ): Note {
    const upperCaseNote = note[0].toUpperCase();
    let value = NOTE_VALUES[upperCaseNote as keyof typeof NOTE_VALUES];
    if (value === undefined) throw new Error(`Unknown ABC note ${note}`);

    let cleanedAccidental: Accidental = undefined;
    if (accidental === '=') {
      cleanedAccidental = 'n' as Accidental;
    } else if (accidental === '^^' && value !== -1) {
      value += 2;
      cleanedAccidental = '##' as Accidental;
    } else if (accidental === '^' && value !== -1) {
      value += 1;
      cleanedAccidental = '#' as Accidental;
    } else if (accidental === '__' && value !== -1) {
      value -= 2;
      cleanedAccidental = 'bb' as Accidental;
    } else if (accidental === '_' && value !== -1) {
      value -= 1;
      cleanedAccidental = 'b' as Accidental;
    } else {
      // Bar accidentals apply only to the exact same note+octave string.
      // Key signature adjustments (uppercase letter keys) apply to all octaves.
      if (note in barAccidentals) value += barAccidentals[note];
      else if (upperCaseNote in keyAdjustment)
        value += keyAdjustment[upperCaseNote];
    }

    let octave = 4;
    if (note.toUpperCase() === note) octave = 3;
    if (note.endsWith(',,,')) {
      octave = 0;
    } else if (note.endsWith(',,')) {
      octave = 1;
    } else if (note.endsWith(',')) {
      octave = 2;
    } else if (note.endsWith("'''''")) {
      octave = 9;
    } else if (note.endsWith("''''")) {
      octave = 8;
    } else if (note.endsWith("'''")) {
      octave = 7;
    } else if (note.endsWith("''")) {
      octave = 6;
    } else if (note.endsWith("'")) {
      octave = 5;
    }

    // Normalize value into 0–11, adjusting octave for accidentals that cross a
    // boundary (e.g. _c: C=0, flat → -1 → wrap to B=11 in the octave below;
    //              ^B: B=11, sharp → 12 → wrap to C=0 in the octave above).
    if (value >= 12) {
      value -= 12;
      octave += 1;
    } else if (value >= 0 && value < 12) {
      // already in range, no adjustment needed
    } else if (value < 0) {
      value += 12;
      octave -= 1;
    }

    // handle decorations
    const decorations: Decoration[] = [];
    for (const d of decoration.matchAll(/!\S+!|\S/g)) {
      // Normalize !...! tokens to lowercase for case-insensitive matching.
      const key = d[0].startsWith('!') ? d[0].toLowerCase() : d[0];
      const convertedDecoration = {
        L: 'accent' as Decoration,
        '>': 'accent' as Decoration,
        '!accent!': 'accent' as Decoration,
        '!emphasis!': 'accent' as Decoration,
        '!breath!': 'breath' as Decoration,
        H: 'fermata' as Decoration,
        '!fermata!': 'fermata' as Decoration,
        '!tenuto!': 'tenuto' as Decoration,
        M: 'lowermordent' as Decoration,
        '!lowermordent!': 'lowermordent' as Decoration,
        '!mordent!': 'lowermordent' as Decoration,
        P: 'uppermordent' as Decoration,
        '!uppermordent!': 'uppermordent' as Decoration,
        '!pralltriller!': 'uppermordent' as Decoration,
        u: 'upbow' as Decoration,
        '!upbow!': 'upbow' as Decoration,
        v: 'downbow' as Decoration,
        '!downbow!': 'downbow' as Decoration,
        T: 'trill' as Decoration,
        '!trill!': 'trill' as Decoration,
        '.': 'staccato' as Decoration,
        '~': 'roll' as Decoration,
        '!roll!': 'roll' as Decoration,
        O: 'coda' as Decoration,
        '!coda!': 'coda' as Decoration,
        S: 'segno' as Decoration,
        '!segno!': 'segno' as Decoration,
        '!turn!': 'turn' as Decoration,
        '!turnx!': 'turnx' as Decoration,
        '!invertedturn!': 'invertedturn' as Decoration,
        '!invertedturnx!': 'invertedturnx' as Decoration,
        '!slide!': 'slide' as Decoration,
        '!snap!': 'snap' as Decoration,
        '!+!': 'lhpizz' as Decoration,
        '!open!': 'open' as Decoration,
        '!/!': 'tremolo1' as Decoration,
        '!//!': 'tremolo2' as Decoration,
        '!///!': 'tremolo3' as Decoration,
        '!tremolo!': 'tremolo3' as Decoration,
        '!////!': 'tremolo4' as Decoration,
        '!pppp!': 'pppp' as Decoration,
        '!ppp!': 'ppp' as Decoration,
        '!pp!': 'pp' as Decoration,
        '!p!': 'p' as Decoration,
        '!mp!': 'mp' as Decoration,
        '!mf!': 'mf' as Decoration,
        '!f!': 'f' as Decoration,
        '!ff!': 'ff' as Decoration,
        '!fff!': 'fff' as Decoration,
        '!ffff!': 'ffff' as Decoration,
        '!fine!': 'fine' as Decoration,
        '!alcoda!': 'alcoda' as Decoration,
        '!d.c.!': 'd.c.' as Decoration,
        '!d.c.alfine!': 'd.c.alfine' as Decoration,
        '!d.c.alcoda!': 'd.c.alcoda' as Decoration,
        '!d.s.!': 'd.s.' as Decoration,
        '!d.s.alfine!': 'd.s.alfine' as Decoration,
        '!d.s.alcoda!': 'd.s.alcoda' as Decoration,
      }[key];

      if (convertedDecoration) decorations.push(convertedDecoration);
    }

    // Parse annotation strings: "^text", "_text", "<text", ">text", "@text"
    const annotations: Annotation[] = [];
    const PLACEMENT_MAP: Record<string, AnnotationPlacement> = {
      '^': 'above',
      _: 'below',
      '<': 'left',
      '>': 'right',
      '@': 'auto',
    };
    for (const m of text.matchAll(/"([_<>@^])([^"]*?)"/g)) {
      const placement = PLACEMENT_MAP[m[1]];
      if (placement) annotations.push({ placement, text: m[2] });
    }

    if (NOTE_VALUES[upperCaseNote as keyof typeof NOTE_VALUES] === -1) {
      const n = new Note(undefined, duration, decorations, [], dots);
      n.annotations = annotations;
      return n;
    } else {
      const n = new Note(
        octave * PITCH_CONSTANTS.SEMITONES_PER_OCTAVE +
          value +
          PITCH_CONSTANTS.OCTAVE_OFFSET,
        duration,
        decorations,
        cleanedAccidental,
        dots
      );
      n.annotations = annotations;
      return n;
    }
  }

  private namePitch(
    pitch: number,
    accidental: Accidental,
    useSharpSpelling: boolean
  ): string {
    const pitchClass = pitch % PITCH_CONSTANTS.SEMITONES_PER_OCTAVE;
    const isBlackKey =
      pitchClass === 1 ||
      pitchClass === 3 ||
      pitchClass === 6 ||
      pitchClass === 8 ||
      pitchClass === 10;
    if (!isBlackKey) {
      return (
        ['C', 'D', 'E', 'F', 'G', 'A', 'B'][
          [0, 2, 4, 5, 7, 9, 11].indexOf(pitchClass)
        ] ?? ''
      );
    }
    const asSharp =
      accidental === '#' ||
      accidental === '##' ||
      (accidental !== 'b' && accidental !== 'bb' && useSharpSpelling);
    if (asSharp) {
      return (
        { 1: 'C♯', 3: 'D♯', 6: 'F♯', 8: 'G♯', 10: 'A♯' } as Record<
          number,
          string
        >
      )[pitchClass];
    } else {
      return (
        { 1: 'D♭', 3: 'E♭', 6: 'G♭', 8: 'A♭', 10: 'B♭' } as Record<
          number,
          string
        >
      )[pitchClass];
    }
  }

  name(useSharpSpelling: boolean = true): string {
    if (this.pitches.length === 0) return '';
    return this.pitches
      .map((p, i) => this.namePitch(p, this.accidentals[i], useSharpSpelling))
      .join('/');
  }
}

export interface Song {
  id: string;
  title: string;
  abc: string;
  tempo?: number;
}

export interface BarLine {
  afterNoteNum?: number;
  type: BarLineType;
  volta?: number; // 1 = first ending, 2 = second ending, etc.
}

/** A key/meter/tempo snapshot that applies from `atNoteIndex` onward.
 *  All required fields are always present so each entry is self-contained.
 *  The array on Music is sorted by atNoteIndex; signatures[0].atNoteIndex === 0. */
export interface Signature {
  atNoteIndex: number;
  keySignature: string;
  beatsPerBar: number;
  beatValue: number;
  tempo?: number;
  tempoText?: string;
  /** Unit note length (L: field) — retained only for round-trip ABC export. */
  defaultDuration?: Duration;
  /** When true, display as C (common time) or C| (cut time) instead of numerals. */
  commonTime?: boolean;
}

/** Returns the signature active at the given note index. */
export function signatureAt(music: Music, noteIndex: number): Signature {
  let result = music.signatures[0];
  for (const sig of music.signatures) {
    if (sig.atNoteIndex > noteIndex) break;
    result = sig;
  }
  return result;
}

const TICKS_ORDERED: [number, Duration, number][] = [
  [DURATION_TICKS.WHOLE, Duration.WHOLE, 0],
  [DURATION_TICKS.HALF_DOTTED, Duration.HALF, 1],
  [DURATION_TICKS.HALF, Duration.HALF, 0],
  [DURATION_TICKS.QUARTER_DOTTED, Duration.QUARTER, 1],
  [DURATION_TICKS.QUARTER, Duration.QUARTER, 0],
  [DURATION_TICKS.EIGHTH_DOTTED, Duration.EIGHTH, 1],
  [DURATION_TICKS.EIGHTH, Duration.EIGHTH, 0],
  [DURATION_TICKS.SIXTEENTH_DOTTED, Duration.SIXTEENTH, 1],
  [DURATION_TICKS.SIXTEENTH, Duration.SIXTEENTH, 0],
  [DURATION_TICKS.THIRTY_SECOND_DOTTED, Duration.THIRTY_SECOND, 1],
  [DURATION_TICKS.THIRTY_SECOND, Duration.THIRTY_SECOND, 0],
];

/** Maps a tick count to [Duration, DurationModifier] if it names a standard notated value, else null. */
export function ticksToDuration(ticks: number): [Duration, number] | null {
  for (const [t, d, m] of TICKS_ORDERED) {
    if (t === ticks) return [d, m];
  }
  return null;
}

/** Greedily decompose a tick count into the fewest standard [Duration, dots] pairs. */
function splitTicks(ticks: number): [Duration, number][] {
  const result: [Duration, number][] = [];
  let rem = ticks;
  while (rem >= DURATION_TICKS.THIRTY_SECOND) {
    let placed = false;
    for (const [t, dur, mod] of TICKS_ORDERED) {
      if (t <= rem) {
        result.push([dur, mod]);
        rem -= t;
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
  return result;
}

export class Music {
  title?: string = '';
  composer?: string;
  clef: 'treble' | 'bass' | 'alto' | 'treble8va' | 'bass8va' = 'treble';
  /** Key/meter/tempo snapshots. Always has at least one entry with atNoteIndex === 0. */
  signatures: Signature[] = [
    { atNoteIndex: 0, keySignature: 'C', beatsPerBar: 4, beatValue: 4 },
  ];
  notes: Note[] = [];
  beams: number[][] = [];
  curves: number[][] = [];
  spanDecorations: SpanDecoration[] = [];
  bars: BarLine[] = [];
  // Aligned lyrics from w: fields. lyrics[verse][noteIndex] = syllable or undefined.
  lyrics: (string | undefined)[][] = [];
  // Unaligned lyrics from W: fields, newline-separated.
  endLyrics?: string;

  reflow(): Music {
    // Signatures are sorted by atNoteIndex; track which one is current.
    let sigIdx = 0;
    let barCapacity =
      (DURATION_TICKS.WHOLE / this.signatures[0].beatValue) *
      this.signatures[0].beatsPerBar;

    // Phase A: merge consecutive tied same-pitch notes back into single notes
    // where the combined duration is expressible as a single notated value.
    const toMerge: number[] = [];
    for (const [start, end] of this.curves) {
      if (end !== start + 1) continue;
      const a = this.notes[start];
      const b = this.notes[end];
      if (
        a.pitches.length !== b.pitches.length ||
        !a.pitches.every((p, i) => p === b.pitches[i])
      )
        continue;
      if (ticksToDuration(a.ticks() + b.ticks()) !== null) {
        toMerge.push(start);
      }
    }
    for (const idx of toMerge.slice().sort((a, b) => b - a)) {
      const a = this.notes[idx];
      const b = this.notes[idx + 1];
      const [dur, mod] = ticksToDuration(a.ticks() + b.ticks())!;
      this.notes.splice(
        idx,
        2,
        new Note(a.pitches, dur, a.decorations, a.accidentals, mod)
      );
      this.curves = this.curves
        .filter(([s, e]) => !(s === idx && e === idx + 1))
        .map(([s, e]) => [s > idx + 1 ? s - 1 : s, e > idx + 1 ? e - 1 : e]);
      this.beams = this.beams.map(([s, e]) => [
        s > idx + 1 ? s - 1 : s,
        e > idx + 1 ? e - 1 : e,
      ]);
      this.spanDecorations = this.spanDecorations.map((span) => ({
        ...span,
        startNoteIndex:
          span.startNoteIndex > idx + 1
            ? span.startNoteIndex - 1
            : span.startNoteIndex,
        endNoteIndex:
          span.endNoteIndex > idx + 1
            ? span.endNoteIndex - 1
            : span.endNoteIndex,
      }));
      // Shift signature indices past the removed note.
      this.signatures = this.signatures.map((sig) =>
        sig.atNoteIndex > idx + 1
          ? { ...sig, atNoteIndex: sig.atNoteIndex - 1 }
          : sig
      );
    }

    // Phase B: rebuild bars, splitting any note that crosses a bar boundary
    // into two tied notes.
    this.bars = [{ afterNoteNum: undefined, type: 'begin' as BarLineType }];
    let currentTicks = 0;
    let noteIx = 0;
    while (noteIx < this.notes.length) {
      // Advance to the next signature that applies at this note index.
      while (
        sigIdx + 1 < this.signatures.length &&
        this.signatures[sigIdx + 1].atNoteIndex <= noteIx
      ) {
        sigIdx++;
        const sig = this.signatures[sigIdx];
        barCapacity = (DURATION_TICKS.WHOLE / sig.beatValue) * sig.beatsPerBar;
        currentTicks = 0; // meter change resets the bar position
      }

      const note = this.notes[noteIx];
      const noteTicks = note.ticks();
      const total = currentTicks + noteTicks;

      if (total === barCapacity) {
        currentTicks = 0;
        this.bars.push({
          afterNoteNum: noteIx,
          type: 'standard' as BarLineType,
        });
        noteIx++;
      } else if (total < barCapacity) {
        currentTicks = total;
        noteIx++;
      } else {
        // Note crosses the bar line — try to split it.
        const remainingTicks = barCapacity - currentTicks;
        const overflowTicks = noteTicks - remainingTicks;
        const firstDur = ticksToDuration(remainingTicks);
        // Decompose overflow into one or more standard durations (handles
        // cases like z8 in 3/8 where overflow isn't a single notated value).
        const overflowDurs = splitTicks(overflowTicks);

        if (firstDur && overflowDurs.length > 0) {
          const [d1, m1] = firstDur;
          const first = new Note(
            note.pitches,
            d1,
            note.decorations,
            note.accidentals,
            m1
          );
          const overflowNotes = overflowDurs.map(
            ([d, m]) =>
              new Note(
                note.pitches,
                d,
                [],
                note.accidentals.map(() => undefined as Accidental),
                m
              )
          );
          const insertCount = overflowNotes.length;
          this.notes.splice(noteIx, 1, first, ...overflowNotes);
          this.curves = this.curves.map(([s, e]) => [
            s > noteIx ? s + insertCount : s,
            e > noteIx ? e + insertCount : e,
          ]);
          this.beams = this.beams.map(([s, e]) => [
            s > noteIx ? s + insertCount : s,
            e > noteIx ? e + insertCount : e,
          ]);
          // Shift signature indices past the inserted notes.
          this.signatures = this.signatures.map((sig) =>
            sig.atNoteIndex > noteIx
              ? { ...sig, atNoteIndex: sig.atNoteIndex + insertCount }
              : sig
          );
          // Tie first → overflow[0] → overflow[1] → … → overflow[N-1]
          for (let i = 0; i < insertCount; i++) {
            this.curves.push([noteIx + i, noteIx + i + 1]);
          }
          this.bars.push({
            afterNoteNum: noteIx,
            type: 'standard' as BarLineType,
          });
          currentTicks = 0;
          // Advance past `first`; overflow[0] will be re-evaluated so it can
          // be split further if it also crosses the next bar boundary.
          noteIx++;
        } else {
          // Can't split cleanly (e.g. triplets or sub-sixteenth) — leave as-is.
          currentTicks = total % barCapacity;
          noteIx++;
        }
      }
    }

    return this;
  }
}

/**
 * Expands repeat bar lines (|: :|  ::) into a flat note/curve sequence
 * so consumers (player, pitch tracker) can walk it linearly without
 * knowing about repeats.
 *
 * Curves (ties/slurs) that fall entirely within a repeated segment are
 * duplicated with adjusted indices.
 *
 * Supports first/second endings (volta brackets): |1 ... :|2 or [1 ... :|2.
 * On the first pass the volta-1 bars play; on the repeat the volta-2 bars play.
 *
 * Limitation: nested repeats (e.g. |: A |: B :| C :|) are not supported.
 * This matches ABC standard practice where nested repeats are poorly defined.
 */
export function expandRepeats(music: Music): {
  notes: Note[];
  curves: number[][];
  originalIndices: number[];
} {
  const resultNotes: Note[] = [];
  const resultCurves: number[][] = [];
  const resultOriginalIndices: number[] = [];

  const addSegment = (startIdx: number, endIdx: number) => {
    const clampedEnd = Math.min(endIdx, music.notes.length - 1);
    if (startIdx > clampedEnd) return;
    const offset = resultNotes.length - startIdx;
    for (let i = startIdx; i <= clampedEnd; i++) {
      resultNotes.push(music.notes[i]);
      resultOriginalIndices.push(i);
    }
    for (const [s, e] of music.curves) {
      if (s >= startIdx && e <= clampedEnd) {
        resultCurves.push([s + offset, e + offset]);
      }
    }
  };

  let repeatStartNoteIdx = 0;
  let prevEndIdx = -1;
  let inVolta1 = false; // true after seeing a volta=1 bar, until the end_repeat clears it
  let i = 0;

  while (i < music.bars.length) {
    const bar = music.bars[i];

    if (bar.afterNoteNum === undefined || bar.afterNoteNum < 0) {
      if (bar.type === 'begin_repeat' || bar.type === 'begin_end_repeat') {
        repeatStartNoteIdx = 0;
        inVolta1 = false;
      }
      i++;
      continue;
    }

    const segEnd = bar.afterNoteNum;

    if (bar.type === 'end_repeat' || bar.type === 'begin_end_repeat') {
      inVolta1 = false;
      // Look back to find a volta-1 bar within this repeat section.
      let volta1BarIdx = -1;
      for (let j = 0; j <= i; j++) {
        const b = music.bars[j];
        if (
          b.volta === 1 &&
          b.afterNoteNum !== undefined &&
          b.afterNoteNum >= repeatStartNoteIdx - 1
        ) {
          volta1BarIdx = j;
          break;
        }
      }

      if (volta1BarIdx !== -1) {
        // Volta bracket detected.
        const volta1Bar = music.bars[volta1BarIdx];
        const commonEnd = volta1Bar.afterNoteNum!; // last note of common section
        const volta1Start = commonEnd + 1;
        const volta1End = segEnd; // notes before end_repeat are volta 1

        // Volta 2 may be on the end_repeat bar itself (:|2) or the next bar ([2 / |2).
        let volta2Start: number;
        let volta2End: number;
        let consumed = 0; // extra bars consumed for volta 2

        if (bar.volta === 2) {
          // :|2 — second ending notes follow this bar
          volta2Start = segEnd + 1;
          const nextBar = music.bars[i + 1];
          volta2End =
            nextBar?.afterNoteNum !== undefined
              ? nextBar.afterNoteNum
              : music.notes.length - 1;
          consumed = 1; // consume the bar that closes volta 2
        } else {
          // Look for a separate [2 / |2 bar immediately after this end_repeat
          const nextBar = music.bars[i + 1];
          if (nextBar?.volta === 2 && nextBar.afterNoteNum !== undefined) {
            volta2Start = segEnd + 1;
            const barAfterVolta2 = music.bars[i + 2];
            volta2End =
              barAfterVolta2?.afterNoteNum !== undefined
                ? barAfterVolta2.afterNoteNum
                : music.notes.length - 1;
            consumed = 2; // consume volta-2 bar and the bar that closes it
          } else {
            // No volta 2 found — fall back to simple repeat
            addSegment(prevEndIdx + 1, segEnd);
            addSegment(repeatStartNoteIdx, segEnd);
            if (bar.type === 'begin_end_repeat') {
              repeatStartNoteIdx = segEnd + 1;
            }
            prevEndIdx = segEnd;
            i++;
            continue;
          }
        }

        // Pass 1: common + volta 1
        addSegment(prevEndIdx + 1, commonEnd);
        addSegment(volta1Start, volta1End);
        // Pass 2: common (repeated) + volta 2
        addSegment(repeatStartNoteIdx, commonEnd);
        addSegment(volta2Start, volta2End);

        if (bar.type === 'begin_end_repeat') repeatStartNoteIdx = volta2End + 1;
        prevEndIdx = volta2End;
        i += 1 + consumed;
        continue;
      }

      // No volta — simple repeat (existing behaviour)
      addSegment(prevEndIdx + 1, segEnd);
      addSegment(repeatStartNoteIdx, segEnd);
      if (bar.type === 'begin_end_repeat') repeatStartNoteIdx = segEnd + 1;
      prevEndIdx = segEnd;
    } else {
      // Standard / double / begin / end bar.
      // Volta-annotated bars and bars inside a volta-1 bracket are deferred:
      // the end_repeat handler will emit them.
      if (bar.volta === 1) {
        inVolta1 = true;
      } else if (bar.volta === undefined && !inVolta1) {
        addSegment(prevEndIdx + 1, segEnd);
        prevEndIdx = segEnd;
      }
      // For volta bars and bars inside a volta-1 bracket, prevEndIdx stays
      // where it was so the end_repeat handler can emit from prevEndIdx+1
      // through commonEnd correctly.

      if (bar.type === 'begin_repeat') {
        repeatStartNoteIdx = segEnd + 1;
        inVolta1 = false;
      }
    }

    i++;
  }

  // Notes after the last bar line
  addSegment(prevEndIdx + 1, music.notes.length - 1);

  // DC/DS navigation: if there's a Da Capo or Dal Segno instruction, append
  // the return-pass notes. Repeats are skipped (volta-1 sections are skipped,
  // volta-2 sections are played) on the return pass.
  const DC_DS_DECORATIONS = new Set<Decoration>([
    'd.c.',
    'd.c.alfine',
    'd.c.alcoda',
    'd.s.',
    'd.s.alfine',
    'd.s.alcoda',
  ]);

  // Find the first DC/DS instruction in the original notes.
  let dcDsDec: Decoration | null = null;
  for (const note of music.notes) {
    for (const d of note.decorations) {
      if (DC_DS_DECORATIONS.has(d)) {
        dcDsDec = d;
        break;
      }
    }
    if (dcDsDec) break;
  }

  if (dcDsDec !== null) {
    // Find landmark note indices in the original score.
    const findFirst = (...decs: Decoration[]): number => {
      const decSet = new Set(decs);
      return music.notes.findIndex((n) =>
        n.decorations.some((d) => decSet.has(d))
      );
    };
    const findLast = (...decs: Decoration[]): number => {
      const decSet = new Set(decs);
      let idx = -1;
      for (let k = 0; k < music.notes.length; k++) {
        if (music.notes[k].decorations.some((d) => decSet.has(d))) idx = k;
      }
      return idx;
    };

    // Pre-compute volta-1 note ranges to skip on the no-repeat pass.
    // A volta-1 section runs from (volta1Bar.afterNoteNum + 1) to
    // (the matching end_repeat bar's afterNoteNum), inclusive.
    const volta1Ranges: [number, number][] = [];
    {
      let inVolta1Range = false;
      let volta1Start = 0;
      for (const bar of music.bars) {
        if (bar.afterNoteNum === undefined || bar.afterNoteNum < 0) continue;
        if (bar.volta === 1) {
          inVolta1Range = true;
          volta1Start = bar.afterNoteNum + 1;
        } else if (inVolta1Range && bar.type === 'end_repeat') {
          volta1Ranges.push([volta1Start, bar.afterNoteNum]);
          inVolta1Range = false;
        }
      }
    }

    const isInVolta1 = (noteIdx: number): boolean =>
      volta1Ranges.some(([s, e]) => noteIdx >= s && noteIdx <= e);

    // Emit notes from startOrig..endOrig without any repeats, skipping volta-1.
    const addSegmentNoRepeat = (startOrig: number, endOrig: number): void => {
      const clampedEnd = Math.min(endOrig, music.notes.length - 1);
      if (startOrig > clampedEnd) return;
      // Iterate through the range, emitting contiguous runs outside volta-1.
      let runStart = -1;
      const flush = (runEnd: number) => {
        if (runStart === -1) return;
        addSegment(runStart, runEnd);
        runStart = -1;
      };
      for (let k = startOrig; k <= clampedEnd; k++) {
        if (isInVolta1(k)) {
          flush(k - 1);
        } else {
          if (runStart === -1) runStart = k;
        }
      }
      flush(clampedEnd);
    };

    const isDc = dcDsDec.startsWith('d.c.');
    const isAlFine = dcDsDec.endsWith('alfine');
    const isAlCoda = dcDsDec.endsWith('alcoda');

    const jumpStart = isDc ? 0 : findFirst('segno');
    let jumpEnd: number;
    let codaJump = false;

    if (isAlFine) {
      jumpEnd = findFirst('fine');
    } else if (isAlCoda) {
      // Stop at the first !alcoda! marker, or failing that, the first !coda!.
      const alcoda = findFirst('alcoda');
      const firstCoda = findFirst('coda');
      // Use whichever appears first (both are valid stop points).
      if (alcoda !== -1 && (firstCoda === -1 || alcoda < firstCoda)) {
        jumpEnd = alcoda;
      } else {
        jumpEnd = firstCoda;
      }
      codaJump = true;
    } else {
      jumpEnd = music.notes.length - 1;
    }

    if (jumpStart !== -1 && jumpEnd !== -1) {
      addSegmentNoRepeat(jumpStart, jumpEnd);
      if (codaJump) {
        // Jump to the last !coda! marker and play to end.
        const lastCoda = findLast('coda');
        if (lastCoda !== -1) {
          addSegmentNoRepeat(lastCoda, music.notes.length - 1);
        }
      }
    }
  }

  // addSegment only includes curves where both endpoints fall within the same
  // segment call.  Ties that cross a standard bar line land in adjacent
  // segments and are therefore missed.  Do a second pass: for every tie in the
  // original (consecutive indices, identical pitches) that was not yet
  // captured, find the matching result-index pairs and add them.
  //
  // We intentionally restrict this to same-pitch consecutive-index curves
  // (i.e. true ties) so that slurs crossing repeat-section boundaries continue
  // to be excluded, preserving the existing behaviour for those cases.
  const origToResultIndices = new Map<number, number[]>();
  for (let i = 0; i < resultOriginalIndices.length; i++) {
    const orig = resultOriginalIndices[i];
    const arr = origToResultIndices.get(orig);
    if (arr) arr.push(i);
    else origToResultIndices.set(orig, [i]);
  }
  for (const [s, e] of music.curves) {
    if (e !== s + 1) continue; // only consecutive-note ties
    const ns = music.notes[s];
    const ne = music.notes[e];
    if (!ns || !ne || ns.pitches.length === 0) continue;
    if (
      ns.pitches.length !== ne.pitches.length ||
      !ns.pitches.every((p, i) => p === ne.pitches[i])
    )
      continue;
    const sIdxs = origToResultIndices.get(s) ?? [];
    const eIdxs = origToResultIndices.get(e) ?? [];
    for (const si of sIdxs) {
      for (const ei of eIdxs) {
        if (
          ei > si &&
          !resultCurves.some(([rs, re]) => rs === si && re === ei)
        ) {
          resultCurves.push([si, ei]);
        }
      }
    }
  }

  return {
    notes: resultNotes,
    curves: resultCurves,
    originalIndices: resultOriginalIndices,
  };
}

/**
 * Find the expanded-sequence index nearest to `currentExpandedIdx` whose
 * original note index matches `targetOrigIdx`.  Returns -1 if no match exists.
 */
export function findNearestExpandedIndex(
  originalIndices: number[],
  targetOrigIdx: number,
  currentExpandedIdx: number
): number {
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let k = 0; k < originalIndices.length; k++) {
    if (originalIndices[k] === targetOrigIdx) {
      const dist = Math.abs(k - currentExpandedIdx);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = k;
      }
    }
  }
  return bestIdx;
}
