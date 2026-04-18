import { PITCH_CONSTANTS } from '../constants';

function abcOctaveOf(pitch: number): number {
  return Math.floor(
    (Math.round(pitch) - PITCH_CONSTANTS.OCTAVE_OFFSET) /
      PITCH_CONSTANTS.SEMITONES_PER_OCTAVE
  );
}

/**
 * Returns how many octave dots to show above a note name (0, 1, or 2),
 * relative to the instrument's lowest octave (which gets 0 dots).
 */
export function noteOctaveDots(pitch: number, basePitch: number): number {
  const baseOctave = abcOctaveOf(basePitch);
  const dots = abcOctaveOf(pitch) - baseOctave;
  return Math.min(Math.max(dots, 0), 2);
}
