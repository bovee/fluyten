import {
  type Tuplet,
  FIFTHS_TO_ACCIDENTALS,
  KEYS,
  type Music,
} from '../../music';
import { assignNotesToBars } from './barAssignment';
import { computeBarSizings } from './barSizing';
import { breakIntoLines } from './lineBreaking';
import { layoutBar, computeBarBeams, unifyBeamStems } from './measureLayout';
import { staffPositionToY, type Clef } from './pitchLayout';
import {
  BAR_HEIGHT,
  FREE_TIME_BAR_TARGET_WIDTH,
  LEFT_MARGIN,
  LYRICS_LINE_HEIGHT,
  NOTE_AREA_PADDING,
  TIME_SIG_WIDTH,
  TOP_MARGIN,
  type BarData,
  type BarLayout,
  type BarlineEndType,
  type BarlineStartType,
  type LayoutResult,
  type LineLayout,
  type PreambleBarLayout,
  type PreambleLayout,
  type TieLayout,
  type TupletLayout,
  type VoltaSegment,
  type SpanDecorationLayout,
  STAFF_HEIGHT,
  STAFF_SPACE,
} from './types';

/** Entry point: convert a Music object and container width into a full LayoutResult. */
export function computeLayout(
  music: Music,
  containerWidth: number
): LayoutResult {
  const sig = music.signatures[0];
  const clef = music.clef as Clef;
  const displayPitchOffset = music.clef.endsWith('8va') ? -12 : 0;

  const fifths = KEYS[sig.keySignature] ?? 0;
  const keyAccidentals = FIFTHS_TO_ACCIDENTALS[fifths] ?? [];
  const numKeyAccidentals = keyAccidentals.length;
  const keyAccidentalType: 'sharp' | 'flat' | 'none' =
    fifths > 0 ? 'sharp' : fifths < 0 ? 'flat' : 'none';

  const lineHeight = BAR_HEIGHT + music.lyrics.length * LYRICS_LINE_HEIGHT;

  // ---------------------------------------------------------------------------
  // Stage 1: Assign notes to bars
  // ---------------------------------------------------------------------------
  const barData = assignNotesToBars(music, containerWidth);
  if (barData.length === 0) {
    return {
      width: containerWidth,
      height: TOP_MARGIN + lineHeight,
      lineHeight,
      lines: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Stage 2: Size each bar
  // ---------------------------------------------------------------------------
  const barSizings = computeBarSizings(barData, music.notes, numKeyAccidentals);

  // ---------------------------------------------------------------------------
  // Stage 3: Line breaking
  // ---------------------------------------------------------------------------
  const isFreeTime = music.bars.length === 0;
  const linePlans = breakIntoLines(
    barSizings,
    containerWidth,
    isFreeTime ? FREE_TIME_BAR_TARGET_WIDTH : undefined
  );

  // ---------------------------------------------------------------------------
  // Stage 4: Build per-bar note layouts
  // ---------------------------------------------------------------------------

  // Flat lookup: barIndex → its LinePlan entry and position within that plan
  const barToLine = new Map<number, { lineIndex: number; posInLine: number }>();
  for (const [lineIndex, plan] of linePlans.entries()) {
    for (const [posInLine, barIdx] of plan.barIndices.entries()) {
      barToLine.set(barIdx, { lineIndex, posInLine });
    }
  }

  // Compute note layouts for every bar upfront so cross-bar element computation
  // can reference any note position.
  const allBarLayouts: BarLayout[] = barData.map((bar, barIdx) => {
    const loc = barToLine.get(barIdx)!;
    const plan = linePlans[loc.lineIndex];
    const isFirstOnLine = loc.posInLine === 0;
    const isFirstBar = barIdx === 0;

    const sizing = barSizings[barIdx];

    // For first-on-line bars, the preamble (clef/key-sig/time-sig) is rendered
    // as a separate PreambleBarLayout pseudo-bar. The real bar starts immediately
    // after the preamble content, with only NOTE_AREA_PADDING as its own preamble.
    // Mid-line bars with a time sig change also get a pseudo-bar (just time sig digits).
    const sigChangePreambleWidth =
      !isFirstOnLine && sizing.timeSigChanged ? TIME_SIG_WIDTH : 0;
    const linePreambleWidth = isFirstOnLine
      ? sizing.preambleIfFirst - NOTE_AREA_PADDING
      : sigChangePreambleWidth;
    const preambleWidth = NOTE_AREA_PADDING; // same for all real bars
    const barX = plan.barXs[loc.posInLine] + linePreambleWidth;
    const barWidth = plan.barWidths[loc.posInLine] - linePreambleWidth;
    const noteAreaWidth = barWidth - preambleWidth;
    const noteAreaX = barX + preambleWidth;

    const staffTopY = TOP_MARGIN + loc.lineIndex * lineHeight;

    const preamble = buildPreambleLayout(
      preambleWidth,
      numKeyAccidentals,
      keyAccidentalType,
      false, // clef/key-sig are in the pseudo-bar, not here
      false,
      ''
    );

    const notes = layoutBar(
      bar,
      music.notes,
      { noteAreaX, noteAreaWidth, staffTopY },
      clef,
      displayPitchOffset,
      music.lyrics
    );

    const beams = computeBarBeams(notes, bar.noteIndices, music.beams);

    const unifiedNotes = unifyBeamStems(notes, beams, staffTopY);

    const { barlineStart, barlineEnd } = resolveBarlineTypes(
      bar,
      barData,
      barIdx
    );

    // Recompute beam stemEndYs and stemXs, then interpolate middle stems onto the beam line.
    const beamsWithStemXs = beams.map((beam) => {
      const dir = unifiedNotes[beam.noteIndices[0]]?.stemDirection ?? 'up';
      const stemOffset = dir === 'up' ? 5 : -5;
      return {
        ...beam,
        stemEndYs: beam.noteIndices.map(
          (li) => unifiedNotes[li]?.stemEndY ?? 0
        ),
        stemXs: beam.noteIndices.map(
          (li) => (unifiedNotes[li]?.x ?? 0) + stemOffset
        ),
      };
    });

    // For each beam, interpolate the slanted beam Y at every note's stem X so
    // middle stems end exactly on the beam line rather than poking through it.
    const interpolatedNotes = unifiedNotes.slice();
    const unifiedBeams = beamsWithStemXs.map((beam) => {
      const n = beam.noteIndices.length;
      if (n < 2) return beam;
      const x1 = beam.stemXs[0];
      const x2 = beam.stemXs[n - 1];
      let y1 = beam.stemEndYs[0];
      let y2 = beam.stemEndYs[n - 1];
      const dir = unifiedNotes[beam.noteIndices[0]]?.stemDirection ?? 'up';
      // Shift beam so it clears all middle notes that protrude beyond the first/last baseline.
      // For stem-up, higher notes have smaller Y; for stem-down, lower notes have larger Y.
      let maxShift = 0;
      for (let k = 1; k < n - 1; k++) {
        const sx = beam.stemXs[k];
        const interpolated =
          x2 === x1 ? y1 : y1 + ((y2 - y1) * (sx - x1)) / (x2 - x1);
        const noteEndY = beam.stemEndYs[k];
        const overshoot =
          dir === 'up' ? interpolated - noteEndY : noteEndY - interpolated;
        if (overshoot > maxShift) maxShift = overshoot;
      }
      if (maxShift > 0) {
        const shift = dir === 'up' ? -maxShift : maxShift;
        y1 += shift;
        y2 += shift;
      }
      const interpolatedEndYs = beam.stemXs.map((sx) =>
        x2 === x1 ? y1 : y1 + ((y2 - y1) * (sx - x1)) / (x2 - x1)
      );
      // Update each note's stemEndY to match the beam line.
      beam.noteIndices.forEach((li, k) => {
        const nl = interpolatedNotes[li];
        if (nl)
          interpolatedNotes[li] = { ...nl, stemEndY: interpolatedEndYs[k] };
      });
      return { ...beam, stemEndYs: interpolatedEndYs };
    });
    return {
      barIndex: barIdx,
      x: barX,
      width: barWidth,
      preamble,
      noteAreaX,
      noteAreaWidth,
      notes: interpolatedNotes,
      beams: unifiedBeams,
      barlineStart,
      barlineEnd,
      volta: undefined, // filled in below
      isFirstOnLine,
      isFirstBar,
    };
  });

  // ---------------------------------------------------------------------------
  // Stage 5: Cross-bar elements
  // ---------------------------------------------------------------------------
  const tiesByLine = computeTies(
    music,
    allBarLayouts,
    barToLine,
    linePlans.length,
    containerWidth,
    lineHeight
  );

  const tupletsByLine = computeTuplets(
    music,
    allBarLayouts,
    barToLine,
    linePlans.length,
    lineHeight
  );

  const spanDecorationsByLine = computeSpanDecorations(
    music,
    allBarLayouts,
    barToLine,
    linePlans.length,
    containerWidth,
    lineHeight
  );

  // Voltas
  assignVoltas(barData, allBarLayouts);

  // ---------------------------------------------------------------------------
  // Stage 6: Assemble lines
  // ---------------------------------------------------------------------------
  const lines: LineLayout[] = linePlans.map((plan, lineIndex) => {
    const bars = plan.barIndices.map((barIdx) => allBarLayouts[barIdx]);

    // Build preamble pseudo-bars for this line:
    // one at the start of each line, plus one before any mid-line time sig changes.
    const preambleBars: PreambleBarLayout[] = [];
    const firstBarIdx = plan.barIndices[0];
    if (firstBarIdx !== undefined) {
      const sizing = barSizings[firstBarIdx];
      const isFirstBar = firstBarIdx === 0;
      const linePreambleWidth = sizing.preambleIfFirst - NOTE_AREA_PADDING;
      const firstBarSig = barData[firstBarIdx].signature;
      const firstBarTimeSig = firstBarSig.commonTime
        ? firstBarSig.beatValue === 2
          ? 'C|'
          : 'C'
        : `${firstBarSig.beatsPerBar}/${firstBarSig.beatValue}`;
      const preamble = buildPreambleLayout(
        linePreambleWidth,
        numKeyAccidentals,
        keyAccidentalType,
        true, // showClef
        isFirstBar || sizing.timeSigChanged, // showTimeSig
        firstBarTimeSig
      );
      preambleBars.push({
        x: plan.barXs[0], // = LEFT_MARGIN
        width: linePreambleWidth,
        preamble,
      });
    }

    // Mid-line time sig change preambles (one per non-first bar that has a change).
    for (let pos = 1; pos < plan.barIndices.length; pos++) {
      const barIdx = plan.barIndices[pos];
      const sizing = barSizings[barIdx];
      if (!sizing.timeSigChanged) continue;
      const barLayout = allBarLayouts[barIdx];
      const sig = barData[barIdx].signature;
      const timeSig = sig.commonTime
        ? sig.beatValue === 2
          ? 'C|'
          : 'C'
        : `${sig.beatsPerBar}/${sig.beatValue}`;
      const preamble = buildPreambleLayout(
        TIME_SIG_WIDTH,
        0,
        'none',
        false, // no clef
        true, // show time sig only
        timeSig
      );
      preambleBars.push({
        x: barLayout.x - TIME_SIG_WIDTH,
        width: TIME_SIG_WIDTH,
        preamble,
      });
    }

    return {
      y: TOP_MARGIN + lineIndex * lineHeight,
      bars,
      preambleBars,
      ties: tiesByLine[lineIndex] ?? [],
      tuplets: tupletsByLine[lineIndex] ?? [],
      spanDecorations: spanDecorationsByLine[lineIndex] ?? [],
    };
  });

  const totalLines = linePlans.length;
  const height = TOP_MARGIN + totalLines * lineHeight;

  return { width: containerWidth, height, lineHeight, lines };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPreambleLayout(
  totalWidth: number,
  numKeyAccidentals: number,
  accidentalType: 'sharp' | 'flat' | 'none',
  showClef: boolean,
  showTimeSig: boolean,
  timeSig: string
): PreambleLayout {
  const clefX = 5; // small left margin
  const keySigX = showClef ? clefX + 30 : clefX;
  const timeSigX = showClef ? keySigX + numKeyAccidentals * 10 : clefX; // mid-line: no clef or key sig before it
  return {
    width: totalWidth,
    showClef,
    showKeySig: showClef && numKeyAccidentals > 0,
    showTimeSig: showTimeSig,
    numKeyAccidentals,
    accidentalType,
    clefX,
    keySigX,
    timeSigX,
    timeSig,
  };
}

function resolveBarlineTypes(
  bar: BarData,
  allBars: BarData[],
  barIdx: number
): { barlineStart: BarlineStartType; barlineEnd: BarlineEndType } {
  let barlineEnd: BarlineEndType = 'standard';
  const t = bar.barLineType;
  if (t === 'double') barlineEnd = 'double';
  else if (t === 'end') barlineEnd = 'end';
  else if (t === 'end_repeat') barlineEnd = 'end_repeat';
  else if (t === 'begin_end_repeat') barlineEnd = 'begin_end_repeat';

  // Determine left-edge barline type
  let barlineStart: BarlineStartType = 'none';
  if (bar.barLineStartType === 'begin_repeat') {
    barlineStart = 'begin_repeat';
    // begin_end_repeat already draws the right-side begin_repeat visually in
    // the preceding bar's barlineEnd; don't duplicate it as a barlineStart.
  } else if (barIdx > 0) {
    const prevType = allBars[barIdx - 1].barLineType;
    if (prevType === 'begin_repeat') {
      barlineStart = 'begin_repeat';
    }
  }

  return { barlineStart, barlineEnd };
}

interface NotePosEntry {
  x: number;
  topY: number;
  bottomY: number;
  stemEndY: number;
  stemDirection: 'up' | 'down';
  lineIndex: number;
  staffTopY: number;
}

/** Shared helper: builds a map from musicNoteIndex to layout position data. */
function buildNotePosMap(
  barLayouts: BarLayout[],
  barToLine: Map<number, { lineIndex: number; posInLine: number }>,
  lineHeight: number
): Map<number, NotePosEntry> {
  const map = new Map<number, NotePosEntry>();
  for (const bar of barLayouts) {
    const loc = barToLine.get(bar.barIndex)!;
    const staffTopY = TOP_MARGIN + loc.lineIndex * lineHeight;
    for (const note of bar.notes) {
      const noteYs = note.staffPositions.map((sp) =>
        staffPositionToY(sp, staffTopY)
      );
      map.set(note.musicNoteIndex, {
        x: note.x,
        topY: noteYs.length > 0 ? Math.min(...noteYs) : staffTopY,
        bottomY: noteYs.length > 0 ? Math.max(...noteYs) : staffTopY,
        stemEndY: note.stemEndY,
        stemDirection: note.stemDirection,
        lineIndex: loc.lineIndex,
        staffTopY,
      });
    }
  }
  return map;
}

function computeTies(
  music: Music,
  barLayouts: BarLayout[],
  barToLine: Map<number, { lineIndex: number; posInLine: number }>,
  numLines: number,
  containerWidth: number,
  lineHeight: number
): TieLayout[][] {
  const notePosMap = buildNotePosMap(barLayouts, barToLine, lineHeight);
  const result: TieLayout[][] = Array.from({ length: numLines }, () => []);

  for (const [startIdx, endIdx] of music.curves) {
    // Don't draw ties to/from rests
    if (music.notes[startIdx]?.pitches.length === 0) continue;
    if (music.notes[endIdx]?.pitches.length === 0) continue;
    const startPos = notePosMap.get(startIdx);
    const endPos = notePosMap.get(endIdx);
    if (!startPos || !endPos) continue;

    // Curve direction set by start note's stem: stem-up → below (notehead side), stem-down → above.
    const curveDirection: 'above' | 'below' =
      startPos.stemDirection === 'down' ? 'above' : 'below';
    // Attach to the correct notehead at each end regardless of individual stem directions.
    const tieY =
      curveDirection === 'above' ? startPos.topY - 8 : startPos.bottomY + 8;
    const endTieY =
      curveDirection === 'above' ? endPos.topY - 8 : endPos.bottomY + 8;

    if (startPos.lineIndex === endPos.lineIndex) {
      result[startPos.lineIndex].push({
        startX: startPos.x,
        startY: tieY,
        endX: endPos.x,
        endY: endTieY,
        lineIndex: startPos.lineIndex,
        curveDirection,
        isOpenEnd: false,
        isOpenStart: false,
      });
    } else {
      // Cross-line: first half extends to right edge of its line
      result[startPos.lineIndex].push({
        startX: startPos.x,
        startY: tieY,
        endX: containerWidth - 15,
        endY: tieY,
        lineIndex: startPos.lineIndex,
        curveDirection,
        isOpenEnd: true,
        isOpenStart: false,
      });
      // Second half starts from the left staff edge so the arc has room to curve.
      // The preamble renders on top and naturally masks the hidden portion.
      result[endPos.lineIndex].push({
        startX: LEFT_MARGIN,
        startY: endTieY,
        endX: endPos.x,
        endY: endTieY,
        lineIndex: endPos.lineIndex,
        curveDirection,
        isOpenEnd: false,
        isOpenStart: true,
      });
    }
  }

  return result;
}

function computeTuplets(
  music: Music,
  barLayouts: BarLayout[],
  barToLine: Map<number, { lineIndex: number; posInLine: number }>,
  numLines: number,
  lineHeight: number
): TupletLayout[][] {
  const result: TupletLayout[][] = Array.from({ length: numLines }, () => []);

  // noteAreaX of the first bar on each line — used as left edge for cross-line bracket continuations.
  const lineFirstNoteAreaX = new Map<number, number>();
  for (const bar of barLayouts) {
    const loc = barToLine.get(bar.barIndex)!;
    if (loc.posInLine === 0)
      lineFirstNoteAreaX.set(loc.lineIndex, bar.noteAreaX);
  }

  const notePosMap = buildNotePosMap(barLayouts, barToLine, lineHeight);

  // Find runs of tuplet notes in music.notes. A group ends when the note count
  // reaches groupSize, a non-tuplet note appears, or the group crosses a staff line.
  let tupletStart = -1;
  let currentTuplet: Tuplet | undefined;
  for (let i = 0; i <= music.notes.length; i++) {
    const note = i < music.notes.length ? music.notes[i] : undefined;
    const noteTuplet = note?.tuplet;
    const isTuplet = noteTuplet !== undefined;

    // Detect group boundary: new tuplet with different params, or non-tuplet note
    const groupChanged =
      isTuplet &&
      currentTuplet &&
      (noteTuplet.actual !== currentTuplet.actual ||
        noteTuplet.written !== currentTuplet.written ||
        noteTuplet.groupSize !== currentTuplet.groupSize);

    const groupSize = i - tupletStart;
    const expectedGroupSize = currentTuplet?.groupSize ?? 0;

    if (tupletStart !== -1) {
      const posA = notePosMap.get(tupletStart);
      const posB = notePosMap.get(i - 1);
      const crossedLine =
        isTuplet &&
        !groupChanged &&
        groupSize > 0 &&
        posA &&
        posB &&
        posA.lineIndex !== posB.lineIndex;

      if (
        !isTuplet ||
        groupChanged ||
        crossedLine ||
        groupSize === expectedGroupSize
      ) {
        if (groupSize > 0 && posA && posB && currentTuplet) {
          const NOTEHEAD_HALF = 5;
          const num = currentTuplet.actual;
          const writtenLabel = undefined as number | undefined;

          let downCount = 0;
          let upCount = 0;
          for (let j = tupletStart; j < i; j++) {
            const p = notePosMap.get(j);
            if (p) {
              if (p.stemDirection === 'down') downCount++;
              else upCount++;
            }
          }
          const direction: 'above' | 'below' =
            downCount > upCount ? 'below' : 'above';
          const BRACKET_OFFSET = 8;

          if (posA.lineIndex === posB.lineIndex) {
            let bracketY: number;
            if (direction === 'above') {
              bracketY =
                Math.min(posA.stemEndY, posB.stemEndY) - BRACKET_OFFSET;
            } else {
              bracketY =
                Math.max(posA.stemEndY, posB.stemEndY) + BRACKET_OFFSET;
            }
            result[posA.lineIndex].push({
              startX: posA.x - NOTEHEAD_HALF,
              endX: posB.x + NOTEHEAD_HALF,
              y: bracketY,
              num,
              written: writtenLabel,
              direction,
              lineIndex: posA.lineIndex,
            });
          } else {
            const bracketYA =
              direction === 'above'
                ? posA.stemEndY - BRACKET_OFFSET
                : posA.stemEndY + BRACKET_OFFSET;
            const bracketYB =
              direction === 'above'
                ? posB.stemEndY - BRACKET_OFFSET
                : posB.stemEndY + BRACKET_OFFSET;
            result[posA.lineIndex].push({
              startX: posA.x - NOTEHEAD_HALF,
              endX: posA.x + 60,
              y: bracketYA,
              num,
              written: writtenLabel,
              direction,
              lineIndex: posA.lineIndex,
            });
            result[posB.lineIndex].push({
              startX: lineFirstNoteAreaX.get(posB.lineIndex) ?? posB.x - 60,
              endX: posB.x + NOTEHEAD_HALF,
              y: bracketYB,
              num,
              written: writtenLabel,
              direction,
              lineIndex: posB.lineIndex,
            });
          }
        }
        tupletStart = -1;
        currentTuplet = undefined;
      }
    }

    if (isTuplet && tupletStart === -1) {
      tupletStart = i;
      currentTuplet = noteTuplet;
    }
  }

  return result;
}

function computeSpanDecorations(
  music: Music,
  barLayouts: BarLayout[],
  barToLine: Map<number, { lineIndex: number; posInLine: number }>,
  numLines: number,
  containerWidth: number,
  lineHeight: number
): SpanDecorationLayout[][] {
  const notePosMap = buildNotePosMap(barLayouts, barToLine, lineHeight);
  const result: SpanDecorationLayout[][] = Array.from(
    { length: numLines },
    () => []
  );

  for (const span of music.spanDecorations) {
    const startPos = notePosMap.get(span.startNoteIndex);
    const endPos = notePosMap.get(span.endNoteIndex);
    if (!startPos || !endPos) continue;

    const isHairpin = span.type === 'crescendo' || span.type === 'diminuendo';
    // Hairpins go below the staff; trill spans go above.
    const startY = isHairpin
      ? startPos.staffTopY + STAFF_HEIGHT + STAFF_SPACE * 2
      : startPos.staffTopY - STAFF_SPACE * 2;
    const endY = isHairpin
      ? endPos.staffTopY + STAFF_HEIGHT + STAFF_SPACE * 2
      : endPos.staffTopY - STAFF_SPACE * 2;

    if (startPos.lineIndex === endPos.lineIndex) {
      result[startPos.lineIndex].push({
        type: span.type,
        startX: startPos.x,
        endX: endPos.x,
        y: startY,
        lineIndex: startPos.lineIndex,
        isOpenEnd: false,
        isOpenStart: false,
      });
    } else {
      // First segment: from start note to right edge of its line
      result[startPos.lineIndex].push({
        type: span.type,
        startX: startPos.x,
        endX: containerWidth - LEFT_MARGIN,
        y: startY,
        lineIndex: startPos.lineIndex,
        isOpenEnd: true,
        isOpenStart: false,
      });
      // Last segment: from left edge of end note's line to end note
      result[endPos.lineIndex].push({
        type: span.type,
        startX: LEFT_MARGIN,
        endX: endPos.x,
        y: endY,
        lineIndex: endPos.lineIndex,
        isOpenEnd: false,
        isOpenStart: true,
      });
      // Intermediate lines (if any): full-width continuation
      for (let li = startPos.lineIndex + 1; li < endPos.lineIndex; li++) {
        const lineY = isHairpin
          ? TOP_MARGIN + li * lineHeight + STAFF_HEIGHT + STAFF_SPACE * 2
          : TOP_MARGIN + li * lineHeight - STAFF_SPACE * 2;
        result[li].push({
          type: span.type,
          startX: LEFT_MARGIN,
          endX: containerWidth - LEFT_MARGIN,
          y: lineY,
          lineIndex: li,
          isOpenEnd: true,
          isOpenStart: true,
        });
      }
    }
  }

  return result;
}

function assignVoltas(barData: BarData[], barLayouts: BarLayout[]) {
  // Walk bars; each bar with a volta annotation gets a VoltaSegment.
  // Consecutive bars sharing the same volta number form begin/mid/end segments.
  for (let i = 0; i < barData.length; i++) {
    const volta = barData[i].volta;
    if (volta === undefined) continue;

    const prev = i > 0 ? barData[i - 1].volta : undefined;
    const next = i < barData.length - 1 ? barData[i + 1].volta : undefined;

    let type: VoltaSegment['type'];
    if (prev === volta && next === volta) type = 'mid';
    else if (prev === volta) type = 'end';
    else if (next === volta) type = 'begin';
    else type = 'begin_end';

    const bl = barLayouts[i];
    const voltaX = bl.x;
    const voltaWidth = bl.width;
    barLayouts[i] = {
      ...bl,
      volta: {
        number: volta,
        type,
        x: voltaX,
        width: voltaWidth,
      },
    };
  }
}
