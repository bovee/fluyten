import { Duration, type Note } from '../../music';
import {
  CLEF_WIDTH,
  FLAG_EXTRA_SPACING,
  KEY_SIG_ACCIDENTAL_WIDTH,
  MIN_NOTE_SPACING,
  NOTE_AREA_PADDING,
  REPEAT_BARLINE_GAP,
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
    // Add extra width for notes with accidentals.
    const mainNotes = bar.noteIndices.filter(
      (idx) =>
        notes[idx].duration !== Duration.GRACE &&
        notes[idx].duration !== Duration.GRACE_SLASH
    );

    const minNoteAreaWidth = Math.max(
      mainNotes.reduce((sum, idx) => {
        const note = notes[idx];
        const hasAccidental = note.accidentals.some((a) => a);
        const isFlagged =
          note.duration === Duration.EIGHTH ||
          note.duration === Duration.SIXTEENTH ||
          note.duration === Duration.THIRTY_SECOND;
        return (
          sum +
          MIN_NOTE_SPACING +
          (hasAccidental ? ACCIDENTAL_EXTRA_SPACING : 0) +
          (isFlagged ? FLAG_EXTRA_SPACING : 0)
        );
      }, 0),
      MIN_NOTE_SPACING
    );

    const totalTicks = bar.noteIndices.reduce((sum, idx) => {
      return sum + notes[idx].ticks();
    }, 0);

    return {
      preambleIfFirst,
      preambleIfNotFirst,
      timeSigChanged,
      minNoteAreaWidth,
      totalTicks,
    };
  });
}
