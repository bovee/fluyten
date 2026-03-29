import {
  type Music,
  Duration,
  DurationModifier,
  KEYS,
  FIFTHS_TO_ACCIDENTALS,
} from '../music';
import { parseFragment } from './abcImport';
import { notesToAbc } from './abcExport';

// Duration in sixteenth-note units (for non-dotted notes)
const DURATION_SIXTEENTHS: Partial<Record<Duration, number>> = {
  [Duration.WHOLE]: 16,
  [Duration.HALF]: 8,
  [Duration.QUARTER]: 4,
  [Duration.EIGHTH]: 2,
  [Duration.SIXTEENTH]: 1,
};

const SIXTEENTHS_TO_DURATION = new Map<number, [Duration, DurationModifier]>([
  [1, [Duration.SIXTEENTH, DurationModifier.NONE]],
  [2, [Duration.EIGHTH, DurationModifier.NONE]],
  [3, [Duration.EIGHTH, DurationModifier.DOTTED]],
  [4, [Duration.QUARTER, DurationModifier.NONE]],
  [6, [Duration.QUARTER, DurationModifier.DOTTED]],
  [8, [Duration.HALF, DurationModifier.NONE]],
  [12, [Duration.HALF, DurationModifier.DOTTED]],
  [16, [Duration.WHOLE, DurationModifier.NONE]],
  [24, [Duration.WHOLE, DurationModifier.DOTTED]],
]);

function scaleDuration(
  duration: Duration,
  modifier: DurationModifier,
  factor: 2 | 0.5
): [Duration, DurationModifier] {
  const base = DURATION_SIXTEENTHS[duration];
  if (base === undefined) return [duration, modifier]; // grace notes — leave unchanged
  const sixteenths =
    modifier === DurationModifier.DOTTED ? (base * 3) / 2 : base;
  const scaled = sixteenths * factor;
  return SIXTEENTHS_TO_DURATION.get(scaled) ?? [duration, modifier];
}

// --- Accidental normalization helpers ---

const BLACK_KEY_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

// For C major / no-accidental key: C/F/G → sharp, B/E → flat
// pitch: 1(C#)→#, 3(Eb)→b, 6(F#)→#, 8(G#)→#, 10(Bb)→b
const C_MAJOR_BLACK_KEY_SPELLINGS: Record<number, '#' | 'b'> = {
  1: '#',
  3: 'b',
  6: '#',
  8: '#',
  10: 'b',
};

const LETTER_PITCH_CLASSES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

interface KeyAccidentalMaps {
  inKeyPitchClasses: Map<number, '#' | 'b'>; // adjusted pitch class → accidental type
  naturalPitchClasses: Set<number>; // "natural" pitch class of each key-adjusted letter
  keyDirection: '#' | 'b' | null; // dominant accidental direction (null = C major / Am)
}

function buildKeyAccidentalMaps(keySignature: string): KeyAccidentalMaps {
  const keyNotes = FIFTHS_TO_ACCIDENTALS[KEYS[keySignature] ?? 0] ?? [];
  const inKeyPitchClasses = new Map<number, '#' | 'b'>();
  const naturalPitchClasses = new Set<number>();

  for (const keyNote of keyNotes) {
    const letter = keyNote[0];
    const isSharp = keyNote[1] === '#';
    const basePitchClass = LETTER_PITCH_CLASSES[letter];
    const adjustedPitchClass = (basePitchClass + (isSharp ? 1 : -1) + 12) % 12;
    inKeyPitchClasses.set(adjustedPitchClass, isSharp ? '#' : 'b');
    naturalPitchClasses.add(basePitchClass);
  }

  const keyDirection: '#' | 'b' | null =
    keyNotes.length === 0 ? null : keyNotes[0].includes('#') ? '#' : 'b';

  return { inKeyPitchClasses, naturalPitchClasses, keyDirection };
}

function preferredBlackKeyAccidental(
  pitchClass: number,
  keyDirection: '#' | 'b' | null
): '#' | 'b' {
  if (keyDirection !== null) return keyDirection;
  return C_MAJOR_BLACK_KEY_SPELLINGS[pitchClass] ?? '#';
}

export interface Transformation {
  id: string;
  labelKey: string; // i18n key
  apply: (music: Music) => void;
}

export const TRANSFORMATIONS: Transformation[] = [
  {
    id: 'octave-up',
    labelKey: 'transformOctaveUp',
    apply: (music) => {
      for (const note of music.notes) {
        note.pitches = note.pitches.map((p) => p + 12);
      }
    },
  },
  {
    id: 'fifth-up',
    labelKey: 'transformFifthUp',
    apply: (music) => {
      for (const note of music.notes) {
        note.pitches = note.pitches.map((p) => p + 7);
      }
    },
  },
  {
    id: 'semitone-up',
    labelKey: 'transformSemitoneUp',
    apply: (music) => {
      for (const note of music.notes) {
        note.pitches = note.pitches.map((p) => p + 1);
      }
    },
  },
  {
    id: 'semitone-down',
    labelKey: 'transformSemitoneDown',
    apply: (music) => {
      for (const note of music.notes) {
        note.pitches = note.pitches.map((p) => p - 1);
      }
    },
  },
  {
    id: 'fifth-down',
    labelKey: 'transformFifthDown',
    apply: (music) => {
      for (const note of music.notes) {
        note.pitches = note.pitches.map((p) => p - 7);
      }
    },
  },
  {
    id: 'octave-down',
    labelKey: 'transformOctaveDown',
    apply: (music) => {
      for (const note of music.notes) {
        note.pitches = note.pitches.map((p) => p - 12);
      }
    },
  },
  {
    id: 'double-duration',
    labelKey: 'transformDoubleDuration',
    apply: (music) => {
      for (const note of music.notes) {
        [note.duration, note.durationModifier] = scaleDuration(
          note.duration,
          note.durationModifier,
          2
        );
      }
    },
  },
  {
    id: 'halve-duration',
    labelKey: 'transformHalveDuration',
    apply: (music) => {
      for (const note of music.notes) {
        [note.duration, note.durationModifier] = scaleDuration(
          note.duration,
          note.durationModifier,
          0.5
        );
      }
    },
  },
  {
    id: 'simplify-accidentals',
    labelKey: 'transformSimplifyAccidentals',
    apply: (music) => {
      const { inKeyPitchClasses, naturalPitchClasses, keyDirection } =
        buildKeyAccidentalMaps(music.signatures[0].keySignature);
      for (const note of music.notes) {
        for (let i = 0; i < note.pitches.length; i++) {
          const pitchClass = note.pitches[i] % 12;
          if (inKeyPitchClasses.has(pitchClass)) {
            note.accidentals[i] = undefined;
          } else if (naturalPitchClasses.has(pitchClass)) {
            note.accidentals[i] = 'n';
          } else if (BLACK_KEY_PITCH_CLASSES.has(pitchClass)) {
            note.accidentals[i] = preferredBlackKeyAccidental(
              pitchClass,
              keyDirection
            );
          } else {
            note.accidentals[i] = undefined;
          }
        }
      }
    },
  },
  {
    id: 'add-all-accidentals',
    labelKey: 'transformAddAllAccidentals',
    apply: (music) => {
      const { inKeyPitchClasses, naturalPitchClasses, keyDirection } =
        buildKeyAccidentalMaps(music.signatures[0].keySignature);
      for (const note of music.notes) {
        for (let i = 0; i < note.pitches.length; i++) {
          const pitchClass = note.pitches[i] % 12;
          if (BLACK_KEY_PITCH_CLASSES.has(pitchClass)) {
            note.accidentals[i] =
              inKeyPitchClasses.get(pitchClass) ??
              preferredBlackKeyAccidental(pitchClass, keyDirection);
          } else if (naturalPitchClasses.has(pitchClass)) {
            note.accidentals[i] = 'n';
          } else {
            note.accidentals[i] = undefined;
          }
        }
      }
    },
  },
];

/**
 * Parse a selected fragment of ABC text using context from the full tune,
 * apply a named transformation, and return the transformed ABC text.
 */
export function transformFragment(
  fragment: string,
  fullAbc: string,
  transformId: string
): string {
  const transform = TRANSFORMATIONS.find((t) => t.id === transformId);
  if (!transform) throw new Error(`Unknown transformation: ${transformId}`);

  const { music, keySignature, defaultDuration } = parseFragment(
    fragment,
    fullAbc
  );
  transform.apply(music);
  return notesToAbc(music, keySignature, defaultDuration);
}
