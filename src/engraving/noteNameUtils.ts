import { PITCH_CONSTANTS } from '../constants';
import { RECORDER_TYPES, type RecorderType } from '../instrument';

function abcOctaveOf(pitch: number): number {
  return Math.floor(
    (pitch - PITCH_CONSTANTS.OCTAVE_OFFSET) /
      PITCH_CONSTANTS.SEMITONES_PER_OCTAVE
  );
}

/**
 * Returns how many octave dots to show above a note name (0, 1, or 2),
 * relative to the instrument's lowest octave (which gets 0 dots).
 */
export function noteOctaveDots(
  pitch: number,
  instrumentType: RecorderType
): number {
  const lowestPitch = RECORDER_TYPES[instrumentType].basePitch + 1;
  const baseOctave = abcOctaveOf(lowestPitch);
  const dots = abcOctaveOf(pitch) - baseOctave;
  return Math.min(Math.max(dots, 0), 2);
}
