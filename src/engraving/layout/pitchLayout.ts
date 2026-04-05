import { Duration, type Accidental } from '../../music';
import { PITCH_CONSTANTS } from '../../constants';
import { STAFF_HEIGHT, STAFF_SPACE, STEM_LENGTH } from './types';

// Maps a chromatic semitone (0–11) to a diatonic step (0–6), assuming sharp
// spelling (rounds down: C#→C, D#→D, etc.). When an explicit flat accidental is
// present we round up instead — see pitchToStaffPosition.
const SEMITONE_TO_STEP: number[] = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

// Diatonic letter names indexed by step (0–6).
const STEP_TO_LETTER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/** Clef name as stored in Music.clef. */
export type Clef = 'treble' | 'treble8va' | 'bass' | 'bass8va' | 'alto';

/**
 * Convert a MIDI pitch to an integer staff position.
 *
 * Staff position 0 = the middle line of the staff.
 * For treble clef that is B4; for bass clef D3; for alto clef C4.
 * Positive values go upward; negative go downward.
 *
 * @param pitch              MIDI pitch from music.notes[i].pitches[j]
 * @param accidental         The accidental for this pitch (determines spelling)
 * @param clef               Staff clef
 * @param displayPitchOffset Added to pitch before computation (−12 for treble8va)
 * @param keyAccidentalMap   Letter→±1 map for the active key signature. Used to
 *                           derive flat/sharp spelling for chromatic pitches that
 *                           carry no explicit accidental (key-implied accidentals).
 */
export function pitchToStaffPosition(
  pitch: number,
  accidental: Accidental,
  clef: Clef,
  displayPitchOffset = 0,
  keyAccidentalMap?: Record<string, number>
): number {
  const effectivePitch = pitch + displayPitchOffset;

  // Reverse the accidental to find the natural (diatonic) pitch, then derive
  // octave and semitone from that. This correctly handles octave-boundary cases
  // like ^B (B# = pitch 72, but the natural note B is in the previous octave).
  const accidentalOffset =
    accidental === '##'
      ? 2
      : accidental === '#'
        ? 1
        : accidental === 'bb'
          ? -2
          : accidental === 'b'
            ? -1
            : 0;
  const naturalNumber =
    effectivePitch - PITCH_CONSTANTS.OCTAVE_OFFSET - accidentalOffset;
  const octave = Math.floor(naturalNumber / 12);
  let semitone = naturalNumber % 12;
  if (semitone < 0) semitone += 12;

  let diatonicStep: number;
  if (accidentalOffset !== 0) {
    // Explicit accidental: semitone is now the natural note's semitone, always diatonic.
    diatonicStep = SEMITONE_TO_STEP[semitone];
  } else {
    // No explicit accidental. For chromatic pitches, check whether the active key
    // signature implies a flat spelling (e.g. Bb in K:F). Without this, chromatic
    // pitches default to sharp spelling (Bb → A line instead of B line).
    const isChromatic =
      SEMITONE_TO_STEP[semitone] === SEMITONE_TO_STEP[(semitone - 1 + 12) % 12];
    if (isChromatic && keyAccidentalMap) {
      const flatSemitone = (semitone + 1) % 12;
      const flatStep = SEMITONE_TO_STEP[flatSemitone];
      if (keyAccidentalMap[STEP_TO_LETTER[flatStep]] === -1) {
        diatonicStep = flatStep;
      } else {
        diatonicStep = SEMITONE_TO_STEP[semitone];
      }
    } else {
      diatonicStep = SEMITONE_TO_STEP[semitone];
    }
  }

  // Diatonic steps from C4 (stepsFromC4 = 0 means C4, 7 means C5, etc.)
  const stepsFromC4 = (octave - 3) * 7 + diatonicStep;

  // Middle-line notes per clef, expressed as stepsFromC4:
  //   treble: B4  = 6   → clefOffset = −6
  //   bass:   D3  = −6  → clefOffset = +6
  //   alto:   C4  = 0   → clefOffset = 0
  const clefOffset =
    clef === 'bass' || clef === 'bass8va' ? 6 : clef === 'alto' ? 0 : -6; // treble and treble8va both use −6

  return stepsFromC4 + clefOffset;
}

/**
 * Convert an integer staff position to an absolute SVG y coordinate.
 *
 * @param staffPosition  Integer staff position (0 = middle line)
 * @param staffTopY      Absolute SVG y of the top staff line
 */
export function staffPositionToY(
  staffPosition: number,
  staffTopY: number
): number {
  // Middle line is at staffTopY + STAFF_HEIGHT/2 = staffTopY + 20.
  // Each staff position step = STAFF_SPACE/2 = 5px.
  return staffTopY + STAFF_HEIGHT / 2 - staffPosition * (STAFF_SPACE / 2);
}

/**
 * Reference staff position for a rest glyph.
 *
 * Whole rest hangs from the 4th staff line (position +2).
 * Half rest sits on the 3rd staff line (position 0).
 * Quarter and shorter rests are centered on the staff (position 0).
 */
export function restStaffPosition(duration: string): number {
  if (duration === Duration.WHOLE) return 2;
  return 0;
}

/**
 * Determine stem direction for a note or chord.
 * If the average staff position is above the middle line, stem goes down.
 */
export function stemDirection(staffPositions: number[]): 'up' | 'down' {
  if (staffPositions.length === 0) return 'up';
  const avg = staffPositions.reduce((s, p) => s + p, 0) / staffPositions.length;
  return avg > 0 ? 'down' : 'up';
}

/**
 * Compute stem start and end Y coordinates.
 *
 * stemStartY is at the notehead closest to the flag/beam end:
 *   stem up   → start at the lowest notehead, end STEM_LENGTH above
 *   stem down → start at the highest notehead, end STEM_LENGTH below
 */
export function stemEndpoints(
  staffPositions: number[],
  staffTopY: number,
  direction: 'up' | 'down'
): { stemStartY: number; stemEndY: number } {
  if (staffPositions.length === 0) {
    const mid = staffPositionToY(0, staffTopY);
    return { stemStartY: mid, stemEndY: mid };
  }

  if (direction === 'up') {
    // Stem rises from the lowest notehead (most negative staff position)
    const lowestPos = Math.min(...staffPositions);
    const stemStartY = staffPositionToY(lowestPos, staffTopY);
    return { stemStartY, stemEndY: stemStartY - STEM_LENGTH };
  } else {
    // Stem falls from the highest notehead (most positive staff position)
    const highestPos = Math.max(...staffPositions);
    const stemStartY = staffPositionToY(highestPos, staffTopY);
    return { stemStartY, stemEndY: stemStartY + STEM_LENGTH };
  }
}
