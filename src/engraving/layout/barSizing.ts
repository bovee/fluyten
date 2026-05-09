import { Duration, type Note } from '../../music';
import {
  CLEF_WIDTH,
  FLAG_EXTRA_SPACING,
  KEY_SIG_ACCIDENTAL_WIDTH,
  MIN_NOTE_SPACING,
  NOTE_AREA_PADDING,
  REPEAT_BARLINE_GAP,
  REST_EXTRA_SPACING,
  TIME_SIG_WIDTH,
  type BarData,
  type BarSizing,
} from './types';

const ACCIDENTAL_EXTRA_SPACING = 15;

/**
 * Compute width budgets for every bar.
 *
 * Each bar has two possible preamble widths depending on whether it's the first
 * bar on a staff line (which must show the clef and key signature). We can't
 * know line assignment until after line breaking, so we compute both values and
 * let the line-breaking step pick the right one.
 */
export function computeBarSizings(
  bars: BarData[],
  notes: Note[],
  numKeyAccidentals: number
): BarSizing[] {
  return bars.map((bar, i) => {
    const isFirstBarOfPiece = i === 0;
    const prevBar = bars[i - 1];
    const timeSigChanged =
      !isFirstBarOfPiece &&
      (bar.signature.beatsPerBar !== prevBar.signature.beatsPerBar ||
        bar.signature.beatValue !== prevBar.signature.beatValue);

    const keySigWidth = numKeyAccidentals * KEY_SIG_ACCIDENTAL_WIDTH;

    const hasRepeatStart = bar.barLineStartType === 'begin_repeat';

    const preambleIfFirst =
      CLEF_WIDTH +
      keySigWidth +
      (isFirstBarOfPiece || timeSigChanged ? TIME_SIG_WIDTH : 0) +
      (hasRepeatStart ? REPEAT_BARLINE_GAP : 0) +
      NOTE_AREA_PADDING;

    const preambleIfNotFirst =
      (timeSigChanged ? TIME_SIG_WIDTH : 0) + NOTE_AREA_PADDING;

    // Count main notes only (grace notes consume no horizontal space of their own).
    const mainNotes = bar.noteIndices.filter(
      (idx) =>
        notes[idx].duration !== Duration.GRACE &&
        notes[idx].duration !== Duration.GRACE_SLASH
    );

    const N = mainNotes.length;

    // Per-note minimum spacing: same formula as measureLayout (excluding stem
    // collision which requires pitch data unavailable here).
    const noteSpacings = mainNotes.map((idx) => {
      const note = notes[idx];
      const isRest = note.pitches.length === 0;
      const hasAccidental = note.accidentals.some((a) => a);
      const isFlagged =
        note.duration === Duration.EIGHTH ||
        note.duration === Duration.SIXTEENTH ||
        note.duration === Duration.THIRTY_SECOND;
      return (
        MIN_NOTE_SPACING +
        (isRest ? REST_EXTRA_SPACING : 0) +
        (hasAccidental ? ACCIDENTAL_EXTRA_SPACING : 0) +
        (isFlagged ? FLAG_EXTRA_SPACING : 0)
      );
    });

    const totalTicks = mainNotes.reduce(
      (sum, idx) => sum + notes[idx].ticks(),
      0
    );

    // tailMinWidth[j] = sum of noteSpacings[j+1 .. N-1]: minimum space needed
    // after note j's position to accommodate the remaining notes.
    const tailMinWidth = new Array<number>(N).fill(0);
    for (let j = N - 2; j >= 0; j--) {
      tailMinWidth[j] = tailMinWidth[j + 1] + noteSpacings[j + 1];
    }

    // For each note j (assumed at its proportional position accTicks[j]/total*W),
    // the remaining width W*(totalTicks-accTicks[j])/totalTicks must fit
    // tailMinWidth[j]. Taking the max over all j gives the minimum W.
    let minNoteAreaWidth = MIN_NOTE_SPACING;
    let accTicksCum = 0;
    for (let j = 0; j < N; j++) {
      const remainingTicks = totalTicks - accTicksCum;
      if (remainingTicks > 0 && tailMinWidth[j] > 0) {
        minNoteAreaWidth = Math.max(
          minNoteAreaWidth,
          (tailMinWidth[j] * totalTicks) / remainingTicks
        );
      }
      accTicksCum += notes[mainNotes[j]].ticks();
    }
    // Right-side clearance: reserve space after the last note so its notehead
    // doesn't clip the right barline (covers both single-note bars and dense bars
    // where the formula places the last note exactly at the note area edge).
    minNoteAreaWidth += MIN_NOTE_SPACING;

    return {
      preambleIfFirst,
      preambleIfNotFirst,
      timeSigChanged,
      minNoteAreaWidth,
      totalTicks,
    };
  });
}
