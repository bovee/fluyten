import { Duration, signatureAt, type Music } from '../../music';
import { DURATION_TICKS } from '../../constants';
import { FREE_TIME_BAR_TARGET_WIDTH, LEFT_MARGIN, type BarData } from './types';

function isGrace(duration: string): boolean {
  return duration === Duration.GRACE || duration === Duration.GRACE_SLASH;
}

/**
 * Split music notes into bars (bar-based mode) or pseudo-bars (free-time mode).
 *
 * Bar-based: uses music.bars barline markers.
 * Free-time: accumulates ticks and wraps at ticksPerLine boundaries.
 */
export function assignNotesToBars(
  music: Music,
  containerWidth: number
): BarData[] {
  if (music.bars.length === 0) {
    return assignFreeTimePseudoBars(music, containerWidth);
  }
  return assignBarredNotes(music);
}

function assignBarredNotes(music: Music): BarData[] {
  const bars: BarData[] = [];
  let noteStart = 0;
  let pendingStartType = undefined as BarData['barLineStartType'];

  for (const bar of music.bars) {
    // Bars with no afterNoteNum (or negative) are markers before any notes — e.g. an
    // initial |: that has no notes before it. Record the start-type for the first real bar.
    if (bar.afterNoteNum === undefined || bar.afterNoteNum < 0) {
      if (bar.type === 'begin_repeat' || bar.type === 'begin_end_repeat') {
        pendingStartType = bar.type;
      }
      continue;
    }

    // If afterNoteNum points at a grace note, walk backwards to the last main note
    // so the grace notes that open the next bar aren't stranded.
    let afterNoteIdx = bar.afterNoteNum;
    while (
      afterNoteIdx > noteStart &&
      isGrace(music.notes[afterNoteIdx]?.duration ?? '')
    ) {
      afterNoteIdx--;
    }
    if (afterNoteIdx < noteStart) continue;

    const noteIndices: number[] = [];
    for (let i = noteStart; i <= afterNoteIdx; i++) noteIndices.push(i);

    bars.push({
      barIndex: bars.length,
      noteIndices,
      barLineType: bar.type,
      barLineStartType: pendingStartType,
      volta: bar.volta,
      signature: signatureAt(music, noteIndices[0] ?? 0),
    });

    pendingStartType = undefined;
    // The begin_repeat and begin_end_repeat types also signal the NEXT bar's start
    if (bar.type === 'begin_repeat' || bar.type === 'begin_end_repeat') {
      pendingStartType = bar.type;
    }
    noteStart = afterNoteIdx + 1;
  }

  // Remaining notes after the last explicit barline
  if (noteStart < music.notes.length) {
    const noteIndices: number[] = [];
    for (let i = noteStart; i < music.notes.length; i++) noteIndices.push(i);
    bars.push({
      barIndex: bars.length,
      noteIndices,
      barLineType: 'end',
      barLineStartType: pendingStartType,
      signature: signatureAt(music, noteStart),
    });
  }

  return bars;
}

function assignFreeTimePseudoBars(
  music: Music,
  containerWidth: number
): BarData[] {
  const sig = music.signatures[0];
  const barsPerLine = Math.max(
    1,
    Math.floor((containerWidth - LEFT_MARGIN) / FREE_TIME_BAR_TARGET_WIDTH)
  );
  const ticksPerLine = barsPerLine * sig.beatsPerBar * DURATION_TICKS.QUARTER;

  const bars: BarData[] = [];
  let lineStart = 0;
  let accTicks = 0;

  for (let i = 0; i < music.notes.length; i++) {
    const note = music.notes[i];
    accTicks += note.ticks();

    const isLast = i === music.notes.length - 1;
    if ((accTicks >= ticksPerLine && !isLast) || isLast) {
      const noteIndices: number[] = [];
      for (let j = lineStart; j <= i; j++) noteIndices.push(j);
      bars.push({
        barIndex: bars.length,
        noteIndices,
        barLineType: isLast ? 'end' : 'standard',
        signature: signatureAt(music, lineStart),
      });
      lineStart = i + 1;
      accTicks = 0;
    }
  }

  return bars;
}
