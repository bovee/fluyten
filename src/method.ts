import { NOTE_NAMES, PITCH_CONSTANTS } from './constants';
import { type RecorderType } from './instrument';
import { Duration, type Music } from './music';

export const Technique = {
  Slur: 'slur',
  Tie: 'tie',
  GraceNote: 'grace-note',
  Triplet: 'triplet',
  WholeNote: 'whole-note',
  HalfNote: 'half-note',
  QuarterNote: 'quarter-note',
  EighthNote: 'eighth-note',
  SixteenthNote: 'sixteenth-note',
  DottedHalfNote: 'dotted-half-note',
  DottedQuarterNote: 'dotted-quarter-note',
  DottedEighthNote: 'dotted-eighth-note',
  WholeRest: 'whole-rest',
  HalfRest: 'half-rest',
  QuarterRest: 'quarter-rest',
  EighthRest: 'eighth-rest',
  SixteenthRest: 'sixteenth-rest',
  Trill: 'trill',
  Fermata: 'fermata',
  Breath: 'breath',
  Accent: 'accent',
  Staccato: 'staccato',
  Tenuto: 'tenuto',
  Repeat: 'repeat',
  Volta: 'volta',
} as const;
export type Technique = (typeof Technique)[keyof typeof Technique];

// Note names are ABC-style: uppercase = lower octave (C4–B4), lowercase = upper (C5–B5).
// A pitch like G#4 becomes 'G#', C5 becomes 'c', C#5 becomes 'c#'.
export type SongFeatures = Set<string | Technique>;

// Per-method lookup: keys are ABC-style note names or Technique string values.
// Features absent from the map are skipped.
// difficultyFromFeatures picks the lexicographically largest matched value.
type DifficultyMap = Record<string, string>;

const METHOD_DIFFICULTY: Record<string, DifficultyMap> = {
  orrC: {
    G: '1.12',
    [Technique.WholeNote]: '1.12',
    [Technique.HalfNote]: '1.12',
    [Technique.QuarterNote]: '1.12',
    [Technique.Breath]: '1.12',
    A: '1.13',
    B: '1.13',
    [Technique.DottedHalfNote]: '1.14',
    c: '1.14',
    d: '1.14',
    [Technique.EighthNote]: '1.20',
    [Technique.Repeat]: '1.20',
    [Technique.QuarterRest]: '1.20',
    [Technique.DottedQuarterNote]: '1.22',
    C: '1.28',
    D: '1.29',
    E: '1.29',
    F: '1.29',
    'A#': '1.33',
  },
  sweetPipesC: {
    G: '1.06',
    [Technique.Breath]: '1.06',
    [Technique.QuarterNote]: '1.06',
    [Technique.QuarterRest]: '1.06',
    A: '1.06',
    [Technique.HalfNote]: '1.07',
    [Technique.HalfRest]: '1.07',
    B: '1.07',
    [Technique.WholeNote]: '1.08',
    [Technique.WholeRest]: '1.08',
    c: '1.09',
    [Technique.EighthNote]: '1.11',
    d: '1.12',
    [Technique.DottedHalfNote]: '1.12',
    [Technique.Repeat]: '1.13',
    [Technique.Fermata]: '1.14',
    'F#': '1.15',
    [Technique.DottedQuarterNote]: '1.17',
    [Technique.Volta]: '1.17',
    E: '1.18',
    e: '1.20',
    [Technique.Tie]: '1.21',
    D: '1.24',
    'c#': '1.27',
    C: '1.29',
    // [Technique.DCAlFine]: '1.30',
    F: '1.31',
    'A#': '1.34',
    'G#': '1.37',
  },
  sweetPipesF: {
    c: '1.06',
    [Technique.Breath]: '1.06',
    [Technique.QuarterNote]: '1.06',
    [Technique.QuarterRest]: '1.06',
    d: '1.06',
    [Technique.HalfNote]: '1.07',
    [Technique.HalfRest]: '1.07',
    e: '1.07',
    [Technique.WholeNote]: '1.08',
    [Technique.WholeRest]: '1.08',
    f: '1.09',
    [Technique.EighthNote]: '1.11',
    g: '1.12',
    [Technique.DottedHalfNote]: '1.12',
    [Technique.Repeat]: '1.13',
    [Technique.Fermata]: '1.14',
    B: '1.15',
    [Technique.DottedQuarterNote]: '1.17',
    [Technique.Volta]: '1.17',
    A: '1.18',
    a: '1.20',
    [Technique.Tie]: '1.21',
    G: '1.24',
    'f#': '1.27',
    F: '1.29',
    // [Technique.DCAlFine]: '1.30',
    'A#': '1.31',
    'd#': '1.34',
    'c#': '1.37',
  },
  zeitlinC: {
    B: '1.03',
    A: '1.03',
    G: '1.04',
    [Technique.WholeNote]: '1.05',
    [Technique.HalfNote]: '1.05',
    c: '1.06',
    d: '1.06',
    [Technique.QuarterNote]: '1.07',
    [Technique.WholeRest]: '1.09',
    [Technique.HalfRest]: '1.09',
    [Technique.QuarterRest]: '1.09',
    [Technique.Breath]: '1.10',
    [Technique.DottedHalfNote]: '1.11',
    F: '1.12',
    E: '1.13',
    [Technique.EighthNote]: '1.14',
    [Technique.Tie]: '1.16',
    D: '1.18',
    C: '1.19',
    [Technique.DottedQuarterNote]: '1.20',
    [Technique.Slur]: '1.21',
    [Technique.Fermata]: '1.21',
    [Technique.Repeat]: '1.22',
    [Technique.Volta]: '1.23',
    'A#': '1.25',
    [Technique.Accent]: '1.29',
    [Technique.Staccato]: '1.29',
    [Technique.EighthRest]: '1.30',
    'F#': '1.31',
    e: '2.06',
    [Technique.SixteenthNote]: '2.08',
    [Technique.DottedEighthNote]: '2.12',
    f: '2.15',
    g: '2.17',
    // [Technique.DCAlFine]: '2.19',
    a: '2.24',
    'f#': '2.24',
    [Technique.Tenuto]: '2.26',
    'c#': '2.32',
    'd#': '2.42',
    'a#': '3.06',
    [Technique.GraceNote]: '3.08',
    [Technique.Triplet]: '3.12',
    [Technique.Trill]: '3.14',
    b: '3.20',
    'C#': '3.24',
    'D#': '3.26',
    'G#': '3.36',
    "c'": '3.42',
  },
};

/** Converts an absolute MIDI pitch to an ABC-style note name.
 *  Octave 3 (C4–B4) → uppercase; octave 4 (C5–B5) → lowercase.
 *  Higher/lower octaves use the same case with tick/comma suffixes omitted
 *  (features only need pitch class + rough octave identity). */
function midiToAbcName(midi: number): string {
  const relative = midi - PITCH_CONSTANTS.OCTAVE_OFFSET;
  const octave = Math.floor(relative / PITCH_CONSTANTS.SEMITONES_PER_OCTAVE);
  // Round to nearest semitone so microtonal (fractional) pitches resolve to
  // the closest named note, then wrap to keep the index in 0–11.
  const semitone =
    Math.round(relative % PITCH_CONSTANTS.SEMITONES_PER_OCTAVE) %
    PITCH_CONSTANTS.SEMITONES_PER_OCTAVE;
  const name = NOTE_NAMES[semitone];
  // octave 3 = uppercase (C, G#)
  // octave 4 = lowercase (c, g#)
  // octave 5+ = lowercase with tick suffixes (c', c'', ...)
  if (octave < 4) return name;
  return name.toLowerCase() + "'".repeat(octave - 4);
}

export function featuresFromMusic(music: Music): SongFeatures {
  const features: SongFeatures = new Set();

  for (const note of music.notes) {
    // Pitches
    for (const pitch of note.pitches) {
      features.add(midiToAbcName(pitch));
    }

    const isRest = note.pitches.length === 0;

    // Duration-based techniques
    if (
      note.duration === Duration.GRACE ||
      note.duration === Duration.GRACE_SLASH
    ) {
      features.add(Technique.GraceNote);
    } else if (note.tuplet) {
      features.add(Technique.Triplet);
    } else {
      const dotted = note.dots > 0;
      if (isRest) {
        if (note.duration === Duration.WHOLE) features.add(Technique.WholeRest);
        else if (note.duration === Duration.HALF)
          features.add(Technique.HalfRest);
        else if (note.duration === Duration.QUARTER)
          features.add(Technique.QuarterRest);
        else if (note.duration === Duration.EIGHTH)
          features.add(Technique.EighthRest);
        else if (note.duration === Duration.SIXTEENTH)
          features.add(Technique.SixteenthRest);
      } else {
        if (note.duration === Duration.WHOLE) features.add(Technique.WholeNote);
        else if (note.duration === Duration.HALF)
          features.add(dotted ? Technique.DottedHalfNote : Technique.HalfNote);
        else if (note.duration === Duration.QUARTER)
          features.add(
            dotted ? Technique.DottedQuarterNote : Technique.QuarterNote
          );
        else if (note.duration === Duration.EIGHTH)
          features.add(
            dotted ? Technique.DottedEighthNote : Technique.EighthNote
          );
        else if (note.duration === Duration.SIXTEENTH)
          features.add(Technique.SixteenthNote);
      }
    }

    // Decorations
    for (const dec of note.decorations) {
      if (dec === 'trill') features.add(Technique.Trill);
      else if (dec === 'fermata') features.add(Technique.Fermata);
      else if (dec === 'breath') features.add(Technique.Breath);
      else if (dec === 'accent') features.add(Technique.Accent);
      else if (dec === 'staccato') features.add(Technique.Staccato);
      else if (dec === 'tenuto') features.add(Technique.Tenuto);
    }
  }

  // Ties and slurs: same-pitch consecutive curves = tie, otherwise slur
  for (const [start, end] of music.curves) {
    const startNote = music.notes[start];
    const endNote = music.notes[end];
    if (startNote && endNote) {
      const isTie =
        startNote.pitches.length > 0 &&
        startNote.pitches[0] === endNote.pitches[0] &&
        end === start + 1;
      features.add(isTie ? Technique.Tie : Technique.Slur);
    }
  }

  // Repeats
  for (const bar of music.bars) {
    if (
      bar.type === 'begin_repeat' ||
      bar.type === 'end_repeat' ||
      bar.type === 'begin_end_repeat'
    ) {
      features.add(Technique.Repeat);
    }
    if (bar.volta !== undefined) {
      features.add(Technique.Volta);
    }
  }

  return features;
}

// Methods available for each instrument type.
export const METHODS_FOR_INSTRUMENT: Record<RecorderType, string[]> = {
  CONTRABASS: [],
  GREATBASS: [],
  BASS: [],
  TENOR: ['orrC', 'sweetPipesC', 'zeitlinC'],
  VOICEFLUTE: [],
  ALTO: ['sweetPipesF'],
  SOPRANO: ['orrC', 'sweetPipesC', 'zeitlinC'],
  SOPRANINO: ['sweetPipesF'],
  GARKLEIN: [],
};

export const METHOD_DISPLAY_NAMES: Record<string, string> = {
  orrC: 'Orr (C)',
  sweetPipesC: 'Sweet Pipes (C)',
  sweetPipesF: 'Sweet Pipes (F)',
  zeitlinC: 'Zeitlin (C)',
};

export function difficultyFromFeatures(
  features: SongFeatures,
  method: string
): string {
  const map = METHOD_DIFFICULTY[method] ?? {};
  let result = '';
  for (const feature of features) {
    const val = map[feature as string];
    if (val !== undefined && val > result) result = val;
  }
  return result;
}
