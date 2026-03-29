import {
  BAR_TARGET_WIDTH,
  LEFT_MARGIN,
  RIGHT_MARGIN,
  type BarSizing,
  type LinePlan,
} from './types';

/**
 * Assign bars to staff lines and compute each bar's final x and width.
 *
 * Algorithm:
 * 1. Estimate barsPerLine from container width.
 * 2. Walk bars greedily: keep adding bars to the current line as long as their
 *    minimum widths fit. The first bar on each line uses preambleIfFirst; the
 *    rest use preambleIfNotFirst.
 * 3. Once a line is full, distribute any remaining horizontal space
 *    proportionally to each bar's tick count.
 */
export function breakIntoLines(
  barSizings: BarSizing[],
  containerWidth: number
): LinePlan[] {
  if (barSizings.length === 0) return [];

  const availableWidth = containerWidth - LEFT_MARGIN - RIGHT_MARGIN;

  const lines: LinePlan[] = [];
  let barStart = 0;

  while (barStart < barSizings.length) {
    // Determine how many bars fit on this line.
    let lineEnd = barStart; // exclusive upper bound

    // Estimate using the target width as a starting point.
    const estimatedBarsPerLine = Math.max(
      1,
      Math.floor(availableWidth / BAR_TARGET_WIDTH)
    );
    let candidate = Math.min(
      barStart + estimatedBarsPerLine,
      barSizings.length
    );

    // Shrink until the line fits within availableWidth.
    while (candidate > barStart + 1) {
      if (minLineWidth(barSizings, barStart, candidate) <= availableWidth)
        break;
      candidate--;
    }
    lineEnd = candidate;

    const isLastLine = lineEnd === barSizings.length;
    // Last line: expand to natural target width but don't stretch to fill the container.
    const targetWidth = isLastLine
      ? Math.min((lineEnd - barStart) * BAR_TARGET_WIDTH, availableWidth)
      : availableWidth;
    lines.push(buildLinePlan(barSizings, barStart, lineEnd, targetWidth));
    barStart = lineEnd;
  }

  return lines;
}

/** Sum of minimum bar widths for bars [start, end). */
function minLineWidth(
  sizings: BarSizing[],
  start: number,
  end: number
): number {
  let total = 0;
  for (let i = start; i < end; i++) {
    const preamble =
      i === start ? sizings[i].preambleIfFirst : sizings[i].preambleIfNotFirst;
    total += preamble + sizings[i].minNoteAreaWidth;
  }
  return total;
}

/** Build a LinePlan for bars [start, end), distributing surplus up to targetWidth. */
function buildLinePlan(
  sizings: BarSizing[],
  start: number,
  end: number,
  targetWidth: number
): LinePlan {
  const count = end - start;
  const preambles = Array.from({ length: count }, (_, k) =>
    k === 0
      ? sizings[start + k].preambleIfFirst
      : sizings[start + k].preambleIfNotFirst
  );
  const minNoteAreas = Array.from(
    { length: count },
    (_, k) => sizings[start + k].minNoteAreaWidth
  );

  const minTotal =
    preambles.reduce((s, p) => s + p, 0) +
    minNoteAreas.reduce((s, w) => s + w, 0);
  const surplus = Math.max(0, targetWidth - minTotal);

  // Distribute surplus space proportionally by tick count.
  const ticks = Array.from(
    { length: count },
    (_, k) => sizings[start + k].totalTicks
  );
  const totalTicks = ticks.reduce((s, t) => s + t, 0);

  const barWidths = Array.from({ length: count }, (_, k) => {
    const noteAreaExtra =
      surplus > 0 && totalTicks > 0 ? (ticks[k] / totalTicks) * surplus : 0;
    return preambles[k] + minNoteAreas[k] + noteAreaExtra;
  });

  // Compute absolute x positions.
  const barXs: number[] = [];
  let x = LEFT_MARGIN;
  for (let k = 0; k < count; k++) {
    barXs.push(x);
    x += barWidths[k];
  }

  return {
    barIndices: Array.from({ length: count }, (_, k) => start + k),
    barWidths,
    barXs,
  };
}
