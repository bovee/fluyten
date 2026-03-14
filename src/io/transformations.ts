import { type Music, Duration, DurationModifier } from '../music';
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
  const sixteenths = modifier === DurationModifier.DOTTED ? (base * 3) / 2 : base;
  const scaled = sixteenths * factor;
  return SIXTEENTHS_TO_DURATION.get(scaled) ?? [duration, modifier];
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

  const { music, keySignature, defaultDuration } = parseFragment(fragment, fullAbc);
  transform.apply(music);
  return notesToAbc(music, keySignature, defaultDuration);
}
