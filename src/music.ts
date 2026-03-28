import {
  NOTE_VALUES,
  PITCH_TO_VEXFLOW,
  PITCH_CONSTANTS,
  DURATION_TICKS,
} from './constants';

export const Duration = {
  WHOLE: 'w',
  HALF: 'h',
  QUARTER: 'q',
  EIGHTH: '8',
  SIXTEENTH: '16',
  GRACE: 'grace',
  GRACE_SLASH: 'grace-slash',
} as const;
export type Duration = (typeof Duration)[keyof typeof Duration];

export const DurationModifier = {
  NONE: '',
  DOTTED: 'd',
  TRIPLET: 't',
} as const;
export type DurationModifier =
  (typeof DurationModifier)[keyof typeof DurationModifier];

// TODO: support other modes besides ionian
export const KEYS: { [key: string]: string[] } = {
  // Major keys
  'C#': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'],
  'F#': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
  B: ['F#', 'C#', 'G#', 'D#', 'A#'],
  E: ['F#', 'C#', 'G#', 'D#'],
  A: ['F#', 'C#', 'G#'],
  D: ['F#', 'C#'],
  G: ['F#'],
  C: [],
  F: ['Bb'],
  Bb: ['Bb', 'Eb'],
  Eb: ['Bb', 'Eb', 'Ab'],
  Ab: ['Bb', 'Eb', 'Ab', 'Db'],
  Db: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
  Gb: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
  Cb: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
  // minor keys
  'A#m': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'],
  'D#m': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
  'G#m': ['F#', 'C#', 'G#', 'D#', 'A#'],
  'C#m': ['F#', 'C#', 'G#', 'D#'],
  'F#m': ['F#', 'C#', 'G#'],
  Bm: ['F#', 'C#'],
  Em: ['F#'],
  Am: [],
  Dm: ['Bb'],
  Gm: ['Bb', 'Eb'],
  Cm: ['Bb', 'Eb', 'Ab'],
  Fm: ['Bb', 'Eb', 'Ab', 'Db'],
  Bbm: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
  Ebm: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
  Abm: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
};

export type BarLineType =
  | 'begin'
  | 'standard'
  | 'double'
  | 'begin_repeat'
  | 'end_repeat'
  | 'begin_end_repeat'
  | 'end';
export type Accidental = '#' | 'b' | 'n' | undefined;
export type Decoration =
  | 'accent'
  | 'breath'
  | 'fermata'
  | 'staccato'
  | 'tenuto'
  | 'trill'
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

export class Note {
  // Empty array means rest; one element = single note; multiple = chord.
  pitches: number[];
  duration: Duration;
  durationModifier: DurationModifier;
  // Parallel to pitches: accidentals[i] applies to pitches[i].
  accidentals: Accidental[];
  decorations: Decoration[];

  constructor(
    pitch: number | number[] | undefined = undefined,
    duration: Duration = Duration.QUARTER,
    decorations: Decoration[] = [],
    accidental: Accidental | Accidental[] = undefined,
    durationModifier: DurationModifier = DurationModifier.NONE
  ) {
    if (pitch === undefined) {
      this.pitches = [];
    } else if (Array.isArray(pitch)) {
      this.pitches = pitch;
    } else {
      this.pitches = [pitch];
    }
    this.duration = duration;
    this.durationModifier = durationModifier;
    // TODO: should we have a "invisible" rest? (like x in abc notation)
    if (Array.isArray(accidental)) {
      this.accidentals = accidental;
    } else {
      this.accidentals = this.pitches.map(() => accidental);
    }
    this.decorations = decorations;
  }

  ticks(): number {
    const base: Record<Duration, number> = {
      [Duration.WHOLE]: DURATION_TICKS.WHOLE,
      [Duration.HALF]: DURATION_TICKS.HALF,
      [Duration.QUARTER]: DURATION_TICKS.QUARTER,
      [Duration.EIGHTH]: DURATION_TICKS.EIGHTH,
      [Duration.SIXTEENTH]: DURATION_TICKS.SIXTEENTH,
      [Duration.GRACE]: 0,
      [Duration.GRACE_SLASH]: 0,
    };
    const t = base[this.duration];
    if (this.durationModifier === DurationModifier.DOTTED) return t * 1.5;
    if (this.durationModifier === DurationModifier.TRIPLET)
      return Math.round((t * 2) / 3);
    return t;
  }

  static fromAbc(
    note: string,
    duration: Duration,
    durationModifier: DurationModifier,
    keyAdjustment: { [note: string]: number },
    accidental: string,
    decoration: string
  ): Note {
    const upperCaseNote = note[0].toUpperCase();
    let value = NOTE_VALUES[upperCaseNote as keyof typeof NOTE_VALUES];
    if (value === undefined) throw new Error(`Unknown ABC note ${note}`);

    let cleanedAccidental: Accidental = undefined;
    if (accidental === '=') {
      cleanedAccidental = 'n' as Accidental;
    } else if (accidental === '^' && value !== -1) {
      value += 1;
      cleanedAccidental = '#' as Accidental;
    } else if (accidental === '_' && value !== -1) {
      value -= 1;
      cleanedAccidental = 'b' as Accidental;
    } else {
      if (upperCaseNote in keyAdjustment) value += keyAdjustment[upperCaseNote];
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

    // handle decorations
    const decorations: Decoration[] = [];
    for (const d of decoration.matchAll(/!\S+!|\S/g)) {
      const convertedDecoration = {
        L: 'accent' as Decoration,
        '>': 'accent' as Decoration,
        '!accent!': 'accent' as Decoration,
        '!emphasis!': 'accent' as Decoration,
        '!breath!': 'breath' as Decoration,
        H: 'fermata' as Decoration,
        '!fermata!': 'fermata' as Decoration,
        '!tenuto!': 'tenuto' as Decoration,
        T: 'trill' as Decoration,
        '!trill!': 'trill' as Decoration,
        '.': 'staccato' as Decoration,
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
      }[d[0]];

      if (convertedDecoration) decorations.push(convertedDecoration);
    }

    if (value === -1) {
      return new Note(undefined, duration, decorations, [], durationModifier);
    } else {
      return new Note(
        octave * PITCH_CONSTANTS.SEMITONES_PER_OCTAVE +
          value +
          PITCH_CONSTANTS.OCTAVE_OFFSET,
        duration,
        decorations,
        cleanedAccidental,
        durationModifier
      );
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
      accidental === '#' || (accidental !== 'b' && useSharpSpelling);
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

  private pitchToVexflow(
    pitch: number,
    accidental: Accidental,
    useSharpSpelling: boolean
  ): string {
    const pitchClass = pitch % PITCH_CONSTANTS.SEMITONES_PER_OCTAVE;
    let note = PITCH_TO_VEXFLOW[pitchClass as keyof typeof PITCH_TO_VEXFLOW];
    const isBlackKey =
      pitchClass === 1 ||
      pitchClass === 3 ||
      pitchClass === 6 ||
      pitchClass === 8 ||
      pitchClass === 10;
    if (isBlackKey) {
      const asSharp =
        accidental === '#' || (accidental === undefined && useSharpSpelling);
      if (asSharp) {
        note =
          PITCH_TO_VEXFLOW[(pitchClass - 1) as keyof typeof PITCH_TO_VEXFLOW];
      }
    }
    const octave = Math.floor(
      pitch / PITCH_CONSTANTS.SEMITONES_PER_OCTAVE -
        PITCH_CONSTANTS.VEXFLOW_OCTAVE_OFFSET
    );
    return `${note}/${octave}`;
  }

  toVexflowPitchAndDuration(
    useSharpSpelling: boolean = true,
    displayPitchOffset: number = 0
  ): [string[], string] {
    const vexDuration =
      this.duration === Duration.GRACE
        ? 'q'
        : this.durationModifier === DurationModifier.TRIPLET
          ? this.duration // TODO: triplets render as base duration (VexFlow tuplet grouping deferred)
          : this.duration + this.durationModifier;

    if (this.pitches.length === 0) {
      return [['b/4'], vexDuration + 'r'];
    }

    return [
      this.pitches.map((p, i) =>
        this.pitchToVexflow(
          p + displayPitchOffset,
          this.accidentals[i],
          useSharpSpelling
        )
      ),
      vexDuration,
    ];
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

const TICKS_ORDERED: [number, Duration, DurationModifier][] = [
  [DURATION_TICKS.WHOLE, Duration.WHOLE, DurationModifier.NONE],
  [DURATION_TICKS.HALF_DOTTED, Duration.HALF, DurationModifier.DOTTED],
  [DURATION_TICKS.HALF, Duration.HALF, DurationModifier.NONE],
  [DURATION_TICKS.QUARTER_DOTTED, Duration.QUARTER, DurationModifier.DOTTED],
  [DURATION_TICKS.QUARTER, Duration.QUARTER, DurationModifier.NONE],
  [DURATION_TICKS.EIGHTH_DOTTED, Duration.EIGHTH, DurationModifier.DOTTED],
  [DURATION_TICKS.EIGHTH, Duration.EIGHTH, DurationModifier.NONE],
  [
    DURATION_TICKS.SIXTEENTH_DOTTED,
    Duration.SIXTEENTH,
    DurationModifier.DOTTED,
  ],
  [DURATION_TICKS.SIXTEENTH, Duration.SIXTEENTH, DurationModifier.NONE],
];

/** Maps a tick count to [Duration, DurationModifier] if it names a standard notated value, else null. */
export function ticksToDuration(
  ticks: number
): [Duration, DurationModifier] | null {
  for (const [t, d, m] of TICKS_ORDERED) {
    if (t === ticks) return [d, m];
  }
  return null;
}

/** Greedily decompose a tick count into the fewest standard [Duration, DurationModifier] pairs. */
function splitTicks(ticks: number): [Duration, DurationModifier][] {
  const result: [Duration, DurationModifier][] = [];
  let rem = ticks;
  while (rem >= DURATION_TICKS.SIXTEENTH) {
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
  beatsPerBar: number = 4;
  beatValue: number = 4;
  keySignature: string = 'G';
  clef: 'treble' | 'bass' | 'alto' | 'treble8va' = 'treble';
  // Tempo in BPM parsed from Q: header, if present.
  tempo?: number;
  // Tempo text label parsed from Q: header (e.g. "Allegro"), if present.
  tempoText?: string;
  notes: Note[] = [];
  beams: number[][] = [];
  curves: number[][] = [];
  bars: BarLine[] = [];
  // Aligned lyrics from w: fields. lyrics[verse][noteIndex] = syllable or undefined.
  lyrics: (string | undefined)[][] = [];
  // Unaligned lyrics from W: fields, newline-separated.
  endLyrics?: string;

  reflow(): Music {
    const barCapacity =
      (DURATION_TICKS.WHOLE / this.beatValue) * this.beatsPerBar;

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
    }

    // Phase B: rebuild bars, splitting any note that crosses a bar boundary
    // into two tied notes.
    this.bars = [{ afterNoteNum: undefined, type: 'begin' as BarLineType }];
    let currentTicks = 0;
    let noteIx = 0;
    while (noteIx < this.notes.length) {
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
  if (music.bars.length === 0) {
    return {
      notes: [...music.notes],
      curves: [...music.curves],
      originalIndices: music.notes.map((_, i) => i),
    };
  }

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
        if (ei > si && !resultCurves.some(([rs, re]) => rs === si && re === ei)) {
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
