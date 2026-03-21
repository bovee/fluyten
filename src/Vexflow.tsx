import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accidental,
  Annotation,
  Articulation,
  Barline,
  Beam,
  Curve,
  Dot,
  Formatter,
  GraceNote,
  GraceNoteGroup,
  KeySignature,
  Ornament,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Tuplet,
  Voice,
  Volta,
} from 'vexflow';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';

import {
  type BarLineType,
  type Decoration,
  Duration,
  DurationModifier,
  KEYS,
  Music,
  Note,
} from './music';
import { DURATION_TICKS } from './constants';
import { FingeringDiagram } from './FingeringDiagram';

// https://github.com/0xfe/vexflow/blob/master/src/gracenote.ts
// https://vexflow.github.io/vexflow-examples/demos/tests/unit-tests/
// https://github.com/0xfe/vexflow/wiki/Tutorial

const DYNAMIC_DECORATIONS = new Set<Decoration>([
  'pppp',
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'ffff',
]);

const ARTICULATION_MAP: Partial<Record<Decoration, string>> = {
  accent: 'a>',
  fermata: 'a@',
  staccato: 'a.',
  tenuto: 'a-',
};

function applyAccidentals(
  note: GraceNote | StaveNote,
  accidentals: Note['accidentals']
) {
  for (let i = 0; i < accidentals.length; i++) {
    const acc = accidentals[i];
    if (acc === 'b') note.addModifier(new Accidental('b'), i);
    if (acc === 'n') note.addModifier(new Accidental('n'), i);
    if (acc === '#') note.addModifier(new Accidental('#'), i);
  }
}

function addNoteModifiers(staveNote: StaveNote, note: Note, duration: string) {
  if (duration.endsWith('d')) {
    Dot.buildAndAttach([staveNote]);
  }
  applyAccidentals(staveNote, note.accidentals);
  for (const decoration of note.decorations) {
    if (DYNAMIC_DECORATIONS.has(decoration)) {
      staveNote.addModifier(
        new Annotation(decoration).setFont('Serif', 12, '200', 'italic'),
        0
      );
    } else if (decoration === 'trill') {
      staveNote.addModifier(new Ornament('tr'), 0);
    } else {
      const articCode = ARTICULATION_MAP[decoration];
      if (articCode) staveNote.addModifier(new Articulation(articCode), 0);
    }
  }
}

function buildMarkings(
  music: Music,
  allNotes: StaveNote[],
  musicIndexToNoteIndex: Map<number, number>,
  noteIndexMap: number[],
  noteToLine: Map<StaveNote, number>
): (Beam | StaveTie | Curve | Tuplet)[] {
  const markings: (Beam | StaveTie | Curve | Tuplet)[] = [];

  for (const [curveStart, curveEnd] of music.curves) {
    const a = musicIndexToNoteIndex.get(curveStart);
    const b = musicIndexToNoteIndex.get(curveEnd);
    if (a === undefined || b === undefined) continue;
    const lineA = noteToLine.get(allNotes[a])!;
    const lineB = noteToLine.get(allNotes[b])!;
    if (lineA === lineB) {
      if (b - a === 1) {
        markings.push(
          new StaveTie({
            firstNote: allNotes[a],
            lastNote: allNotes[b],
            firstIndexes: [0],
            lastIndexes: [0],
          })
        );
      } else {
        markings.push(new Curve(allNotes[a], allNotes[b], {}));
      }
    } else {
      // Cross-line: split into an open-ended tie on each line.
      markings.push(
        new StaveTie({
          firstNote: allNotes[a],
          lastNote: undefined as unknown as null,
          firstIndexes: [0],
          lastIndexes: [0],
        })
      );
      markings.push(
        new StaveTie({
          firstNote: undefined as unknown as null,
          lastNote: allNotes[b],
          firstIndexes: [0],
          lastIndexes: [0],
        })
      );
    }
  }

  for (const [beamStart, beamEnd] of music.beams) {
    const a = musicIndexToNoteIndex.get(beamStart);
    const b = musicIndexToNoteIndex.get(beamEnd);
    if (a === undefined || b === undefined) continue;
    markings.push(new Beam(allNotes.slice(a, b + 1)));
  }

  // Wrap triplet notes in Tuplets, closing each group of 3 and splitting at line boundaries.
  let tripletStart = -1;
  for (let i = 0; i <= allNotes.length; i++) {
    const isTriplet =
      i < allNotes.length &&
      music.notes[noteIndexMap[i]].durationModifier ===
        DurationModifier.TRIPLET;
    if (isTriplet && tripletStart === -1) {
      tripletStart = i;
    }
    if (tripletStart !== -1) {
      const groupSize = i - tripletStart;
      const crossedLine =
        isTriplet &&
        groupSize > 0 &&
        noteToLine.get(allNotes[i - 1]) !== noteToLine.get(allNotes[i]);
      if (!isTriplet || crossedLine || groupSize === 3) {
        if (groupSize > 0) {
          markings.push(
            new Tuplet(allNotes.slice(tripletStart, i), { numNotes: 3 })
          );
        }
        tripletStart = isTriplet ? i : -1;
      }
    }
  }

  return markings;
}

function toStavenotes(
  music: Music,
  barsPerLine: number,
  freeTime: boolean,
  ticksPerLine: number,
  clef: string,
  displayPitchOffset: number = 0
): {
  barredNotes: StaveNote[][];
  markings: (Beam | StaveTie | Curve | Tuplet)[];
  noteIndexMap: number[];
  usedBarTypes: BarLineType[];
  usedVoltas: (number | undefined)[];
} {
  // noteIndexMap[i] = index into music.notes for the i-th stave note.
  // Grace notes are not added as standalone stave notes, so indices may diverge.
  const noteIndexMap: number[] = [];
  const notes: StaveNote[] = [];
  // musicIndexToNoteIndex maps music.notes index → notes[] index (for beams/curves).
  // Grace note indices are excluded (they have no entry).
  const musicIndexToNoteIndex = new Map<number, number>();

  let pendingGraceNotes: GraceNote[] = [];
  let pendingGraceSlash = false;

  const keyAccidentals = KEYS[music.keySignature] ?? [];
  const useSharpSpelling =
    keyAccidentals.length === 0 || keyAccidentals[0].includes('#');

  for (const [musicIx, note] of music.notes.entries()) {
    if (
      note.duration === Duration.GRACE ||
      note.duration === Duration.GRACE_SLASH
    ) {
      if (pendingGraceNotes.length === 0)
        pendingGraceSlash = note.duration === Duration.GRACE_SLASH;
      const [pitches] = note.toVexflowPitchAndDuration(
        useSharpSpelling,
        displayPitchOffset
      );
      const graceNote = new GraceNote({
        keys: [pitches[0]],
        duration: '8',
        slash: note.duration === Duration.GRACE_SLASH,
        clef,
      });
      applyAccidentals(graceNote, note.accidentals.slice(0, 1));
      pendingGraceNotes.push(graceNote);
      continue;
    }

    const [pitches, duration] = note.toVexflowPitchAndDuration(
      useSharpSpelling,
      displayPitchOffset
    );
    const staveNote = new StaveNote({ keys: pitches, duration, clef });

    if (pendingGraceNotes.length > 0) {
      const graceGroup = new GraceNoteGroup(
        pendingGraceNotes,
        pendingGraceSlash
      );
      staveNote.addModifier(graceGroup, 0);
      pendingGraceNotes = [];
    }

    addNoteModifiers(staveNote, note, duration);

    musicIndexToNoteIndex.set(musicIx, notes.length);
    noteIndexMap.push(musicIx);
    notes.push(staveNote);
  }

  // Split notes into bars (or lines in free time).
  const barredNotes: StaveNote[][] = [];
  const usedBarTypes: BarLineType[] = [];
  const usedVoltas: (number | undefined)[] = [];
  let lineOf: (barIx: number) => number;

  if (freeTime) {
    // Split by accumulated ticks into lines (no bar lines drawn).
    let accTicks = 0;
    let lineStart = 0;
    for (let i = 0; i < notes.length; i++) {
      accTicks += music.notes[noteIndexMap[i]].ticks();
      if (accTicks >= ticksPerLine && i < notes.length - 1) {
        barredNotes.push(notes.slice(lineStart, i + 1));
        lineStart = i + 1;
        accTicks = 0;
      }
    }
    if (lineStart < notes.length) barredNotes.push(notes.slice(lineStart));
    lineOf = (barIx) => barIx; // each barredNotes entry IS a line
  } else {
    let barStartNoteIx = 0;
    for (const bar of music.bars) {
      if (bar.afterNoteNum === undefined) continue;
      let afterNoteIx = musicIndexToNoteIndex.get(bar.afterNoteNum);
      if (afterNoteIx === undefined) {
        for (let ix = bar.afterNoteNum - 1; ix >= 0; ix--) {
          afterNoteIx = musicIndexToNoteIndex.get(ix);
          if (afterNoteIx !== undefined) break;
        }
      }
      if (afterNoteIx === undefined) continue;
      barredNotes.push(notes.splice(0, afterNoteIx - barStartNoteIx + 1));
      usedBarTypes.push(bar.type);
      usedVoltas.push(bar.volta);
      barStartNoteIx = afterNoteIx + 1;
    }
    if (notes.length) barredNotes.push(notes);
    lineOf = (barIx) => Math.floor(barIx / barsPerLine);
  }

  const allNotes: StaveNote[] = barredNotes.flat();
  const noteToLine = new Map<StaveNote, number>();
  for (const [barIx, barNotes] of barredNotes.entries()) {
    for (const n of barNotes) noteToLine.set(n, lineOf(barIx));
  }

  const markings = buildMarkings(
    music,
    allNotes,
    musicIndexToNoteIndex,
    noteIndexMap,
    noteToLine
  );

  return { barredNotes, markings, noteIndexMap, usedBarTypes, usedVoltas };
}

type BarBound = { x1: number; x2: number; y1: number; y2: number };

function drawNotesAndRecordBounds(
  notes: StaveNote[],
  context: ReturnType<Renderer['getContext']>,
  stave: Stave,
  staveX: number,
  staveWidth: number,
  newNoteSvgs: SVGGElement[],
  newBarBounds: BarBound[]
) {
  for (const [noteInBar, note] of notes.entries()) {
    const group = context.openGroup();
    note.setContext(context).draw();
    context.closeGroup();
    newNoteSvgs.push(group);
    if (noteInBar === 0) {
      const bbox = group.getBBox();
      newBarBounds.push({
        x1: bbox.x + bbox.width / 2,
        x2: staveX + staveWidth,
        y1: stave.getYForLine(0),
        y2: stave.getYForLine(4),
      });
    }
  }
}

export function Vexflow(props: {
  music: Music;
  colorNotes: number;
  cursor?: { noteIdx: number };
}) {
  const { t } = useTranslation();
  const vexDiv = useRef<HTMLDivElement>(null);
  const renderer = useRef<Renderer>(null);
  const noteSvgs = useRef<SVGGElement[]>([]);
  const barBounds = useRef<BarBound[]>([]);
  const cursorLine = useRef<SVGLineElement | null>(null);
  // noteIndexMap[staveIdx] = music note index. Populated during rendering so
  // the cursor effect can find the stave note for a given music note index.
  const noteIndexMapRef = useRef<number[]>([]);
  // noteBarIdx[staveIdx] = barBounds index for that stave note.
  const noteBarIdxRef = useRef<number[]>([]);
  const [windowWidth, setWindowWidth] = useState(
    () => document.documentElement.clientWidth
  );
  const [popoverAnchor, setPopoverAnchor] = useState<SVGElement | null>(null);
  const [popoverNote, setPopoverNote] = useState<Note | null>(null);
  const music = props.music;
  const useSharpSpelling =
    (KEYS[music.keySignature] ?? []).length === 0 ||
    (KEYS[music.keySignature] ?? [])[0].includes('#');

  const barWidth = 250;
  const barHeight = 120;
  const extraHeightOffset = 20;

  const barsPerLine = Math.max(1, Math.floor((windowWidth - 12) / barWidth));
  const freeTime = music.bars.length === 0;
  const ticksPerLine = barsPerLine * music.beatsPerBar * DURATION_TICKS.QUARTER;
  const vexClef = music.clef === 'treble8va' ? 'treble' : music.clef;
  const displayPitchOffset = music.clef === 'treble8va' ? -12 : 0;
  const { barredNotes, markings, noteIndexMap, usedBarTypes, usedVoltas } =
    toStavenotes(
      music,
      barsPerLine,
      freeTime,
      ticksPerLine,
      vexClef,
      displayPitchOffset
    );

  // Build per-bar beg/end barline type overrides from the parsed bar types.
  const endBarTypes = new Map<number, number>();
  const begBarTypes = new Map<number, number>();
  // Map from bar index (the bar AFTER the current one) to volta type+label.
  // barIx N receives a volta bracket when bar N-1 has a volta annotation.
  const voltaBrackets = new Map<number, { vexType: number; label: string }>();
  if (!freeTime) {
    for (let i = 0; i < usedBarTypes.length; i++) {
      const type = usedBarTypes[i];
      if (type === 'end_repeat') {
        endBarTypes.set(i, Barline.type.REPEAT_END);
      } else if (type === 'begin_repeat') {
        begBarTypes.set(i + 1, Barline.type.REPEAT_BEGIN);
      } else if (type === 'begin_end_repeat') {
        endBarTypes.set(i, Barline.type.REPEAT_END);
        begBarTypes.set(i + 1, Barline.type.REPEAT_BEGIN);
      } else if (type === 'double') {
        endBarTypes.set(i, Barline.type.DOUBLE);
      } else if (type === 'end') {
        endBarTypes.set(i, Barline.type.END);
      }

      // Volta bracket: bar i ends with a volta annotation, so bar i+1 gets the bracket.
      const voltaNum = usedVoltas[i];
      if (voltaNum !== undefined) {
        const prevVolta = i > 0 ? usedVoltas[i - 1] : undefined;
        const nextVolta = usedVoltas[i + 1];
        let vexType: number;
        if (prevVolta === voltaNum && nextVolta === voltaNum) {
          vexType = Volta.type.MID;
        } else if (prevVolta === voltaNum) {
          vexType = Volta.type.END;
        } else if (nextVolta === voltaNum) {
          vexType = Volta.type.BEGIN;
        } else {
          vexType = Volta.type.BEGIN_END;
        }
        voltaBrackets.set(i + 1, { vexType, label: `${voltaNum}.` });
      }
    }
    // Handle |: at the very start (before any notes — afterNoteNum < 0, skipped by splitter).
    const firstBar = music.bars[0];
    if (
      firstBar &&
      (firstBar.afterNoteNum === undefined || firstBar.afterNoteNum < 0) &&
      (firstBar.type === 'begin_repeat' || firstBar.type === 'begin_end_repeat')
    ) {
      begBarTypes.set(0, Barline.type.REPEAT_BEGIN);
    }
  }

  useEffect(() => {
    if (!vexDiv.current) return;
    if (!renderer.current) {
      renderer.current = new Renderer(vexDiv.current, Renderer.Backends.SVG);
    }
    renderer.current.getContext().clear();
    const totalLines = freeTime
      ? barredNotes.length
      : Math.ceil(barredNotes.length / barsPerLine);
    renderer.current.resize(
      windowWidth,
      extraHeightOffset + totalLines * barHeight
    );
    const context = renderer.current.getContext();
    const formatter = new Formatter();

    const newNoteSvgs: SVGGElement[] = [];
    const newBarBounds: BarBound[] = [];
    type StaveInfo = { x: number; width: number; topY: number; lineIx: number };
    const staveInfoByBar: StaveInfo[] = [];

    if (freeTime) {
      // Free time: one full-width stave per line, no bar lines, no time signature.
      const fullStaveWidth = windowWidth - 30;
      for (const [lineIx, notes] of barredNotes.entries()) {
        const staveX = 15;
        const stave = new Stave(
          staveX,
          extraHeightOffset + barHeight * lineIx,
          fullStaveWidth
        );
        stave.addClef(
          vexClef,
          'default',
          music.clef === 'treble8va' ? '8va' : undefined
        );
        if (music.keySignature && music.keySignature !== 'C') {
          new KeySignature(music.keySignature).addToStave(stave);
        }
        stave.setContext(context).draw();
        staveInfoByBar.push({
          x: staveX,
          width: fullStaveWidth,
          topY: stave.getYForLine(0),
          lineIx: lineIx,
        });

        const voice = new Voice({
          numBeats: music.beatsPerBar,
          beatValue: music.beatValue,
        });
        voice.setMode(Voice.Mode.SOFT);
        voice.addTickables(notes);

        const clefOffset = 80;
        formatter
          .joinVoices([voice])
          .format([voice], fullStaveWidth - clefOffset);
        voice.setStave(stave).preFormat();

        drawNotesAndRecordBounds(
          notes,
          context,
          stave,
          staveX,
          fullStaveWidth,
          newNoteSvgs,
          newBarBounds
        );
      }
    } else {
      for (const [barIx, notes] of barredNotes.entries()) {
        // skip empty bars for now (this breaks vexflow)
        if (notes.length === 0) continue;
        const extraWidth = barIx % barsPerLine === 0 ? 15 : 0;
        const staveX = barWidth * (barIx % barsPerLine) + (15 - extraWidth);
        const staveWidth = barWidth + extraWidth;
        const stave = new Stave(
          staveX,
          extraHeightOffset + barHeight * Math.floor(barIx / barsPerLine),
          staveWidth
        );
        if (barIx % barsPerLine === 0) {
          stave.addClef(
            vexClef,
            'default',
            music.clef === 'treble8va' ? '8va' : undefined
          );
          if (music.keySignature && music.keySignature !== 'C') {
            new KeySignature(music.keySignature).addToStave(stave);
          }
        }
        if (barIx === 0)
          stave.addTimeSignature(`${music.beatsPerBar}/${music.beatValue}`);
        const begType = begBarTypes.get(barIx);
        if (begType !== undefined) stave.setBegBarType(begType);
        const endType = endBarTypes.get(barIx);
        if (endType !== undefined) stave.setEndBarType(endType);
        const volta = voltaBrackets.get(barIx);
        if (volta) stave.setVoltaType(volta.vexType, volta.label, -5);
        stave.setContext(context).draw();
        staveInfoByBar.push({
          x: staveX,
          width: staveWidth,
          topY: stave.getYForLine(0),
          lineIx: Math.floor(barIx / barsPerLine),
        });

        const voice = new Voice({
          numBeats: music.beatsPerBar,
          beatValue: music.beatValue,
        });
        // TODO: this is only needed so incomplete bars at the start/end don't break? could add in blank notes instead?
        voice.setMode(Voice.Mode.SOFT);
        voice.addTickables(notes);

        const offset = barIx % barsPerLine === 0 ? 80 : 20;
        formatter.joinVoices([voice]).format([voice], barWidth - offset);
        voice.setStave(stave).preFormat();

        drawNotesAndRecordBounds(
          notes,
          context,
          stave,
          staveX,
          staveWidth,
          newNoteSvgs,
          newBarBounds
        );
      }
    }
    noteSvgs.current = newNoteSvgs;
    barBounds.current = newBarBounds;
    noteIndexMapRef.current = noteIndexMap;
    // Build staveIdx → barIdx mapping
    const newNoteBarIdx: number[] = [];
    for (const [barIdx, barNotes] of barredNotes.entries()) {
      for (let i = 0; i < barNotes.length; i++) newNoteBarIdx.push(barIdx);
    }
    noteBarIdxRef.current = newNoteBarIdx;
    for (const marking of markings) {
      marking.setContext(context).draw();
    }

    // Draw breath marks as positioned SVG commas above the preceding barline.
    // For notes that open a new line, the breath mark moves to the end of the previous line.
    const svgEl = vexDiv.current?.querySelector('svg');
    if (svgEl) {
      const allNotesList = barredNotes.flat();
      const noteToBarIx = new Map<StaveNote, number>();
      for (const [barIx, barNotes] of barredNotes.entries()) {
        for (const n of barNotes) noteToBarIx.set(n, barIx);
      }
      // Map line index → last bar index on that line
      const lineLastBar = new Map<number, number>();
      for (let i = 0; i < staveInfoByBar.length; i++) {
        lineLastBar.set(staveInfoByBar[i].lineIx, i);
      }
      // Draw the breath marks
      for (const [noteIx, noteSvg] of newNoteSvgs.entries()) {
        const musicNoteIx = noteIndexMap[noteIx];
        if (!music.notes[musicNoteIx].decorations.includes('breath')) continue;

        const staveNote = allNotesList[noteIx];
        const barIx = noteToBarIx.get(staveNote) ?? 0;
        const isFirstInBar = barredNotes[barIx][0] === staveNote;
        const isFirstOnLine = freeTime || barIx % barsPerLine === 0;

        const bbox = noteSvg.getBBox();
        let breathX = bbox.x - 14;
        let breathY = staveInfoByBar[barIx].topY - 6;

        if (isFirstInBar && isFirstOnLine && barIx > 0) {
          // Move to end of the previous line
          const prevBarIx = lineLastBar.get(staveInfoByBar[barIx].lineIx - 1);
          if (prevBarIx !== undefined) {
            const prev = staveInfoByBar[prevBarIx];
            breathX = prev.x + prev.width - 4;
            breathY = prev.topY - 6;
          }
        }

        const text = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'text'
        );
        text.setAttribute('x', String(breathX));
        text.setAttribute('y', String(breathY));
        text.setAttribute('font-family', 'Georgia, serif');
        text.setAttribute('font-size', '20');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = ',';
        svgEl.appendChild(text);
      }
    }

    for (const [noteIx, noteSvg] of newNoteSvgs.entries()) {
      const noteHead = noteSvg.querySelector('.vf-notehead')?.children[0] as
        | SVGElement
        | undefined;
      if (!noteHead) continue;
      const musicNoteIx = noteIndexMap[noteIx];
      // Color played notes green
      if (musicNoteIx < props.colorNotes) {
        noteHead.style.fill = 'green';
      }
      // Attach click handlers to all note groups
      // Make the entire note group clickable (stem + notehead = bigger target)
      noteSvg.style.cursor = 'pointer';
      noteSvg.addEventListener('click', () => {
        setPopoverAnchor(noteHead);
        setPopoverNote(music.notes[musicNoteIx]);
      });
    }
  }, [props.music, windowWidth]);

  useLayoutEffect(() => {
    if (!vexDiv.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWindowWidth(vexDiv.current?.clientWidth);
    let debounceTimer: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver((entries) => {
      clearTimeout(debounceTimer);
      const contentWidth =
        entries[0]?.contentRect.width ?? vexDiv.current?.clientWidth;
      debounceTimer = setTimeout(() => setWindowWidth(contentWidth), 150);
    });
    observer.observe(vexDiv.current);
    return () => {
      clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const svgEl = vexDiv.current?.querySelector('svg');

    if (!props.cursor || !svgEl) {
      cursorLine.current?.remove();
      cursorLine.current = null;
      return;
    }

    const { noteIdx } = props.cursor;
    const floor = Math.floor(noteIdx);
    const frac = noteIdx - floor;

    // Find stave indices for the current and next music note indices.
    const nim = noteIndexMapRef.current;
    let staveIdx = 0;
    for (let i = 0; i < nim.length; i++) {
      if (nim[i] <= floor) staveIdx = i;
      else break;
    }
    const noteEl = noteSvgs.current[staveIdx];
    if (!noteEl) return;

    const getX = (si: number) => {
      const el = noteSvgs.current[si];
      if (!el) return null;
      const b = el.getBBox();
      return b.x + b.width / 2;
    };

    const barIx = noteBarIdxRef.current[staveIdx] ?? 0;
    const bounds = barBounds.current[barIx];
    if (!bounds) return;

    const x0 = getX(staveIdx) ?? 0;
    const nextX = getX(staveIdx + 1);
    const x1 = nextX !== null && nextX > x0 ? nextX : bounds.x2;
    const x = x0 + frac * (x1 - x0);

    if (!cursorLine.current) {
      const line = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line'
      );
      line.setAttribute('stroke', 'rgba(0, 120, 255, 0.5)');
      line.setAttribute('stroke-width', '4');
      line.setAttribute('pointer-events', 'none');
      svgEl.appendChild(line);
      cursorLine.current = line;
    }
    cursorLine.current.setAttribute('x1', String(x));
    cursorLine.current.setAttribute('x2', String(x));
    cursorLine.current.setAttribute('y1', String(bounds.y1));
    cursorLine.current.setAttribute('y2', String(bounds.y2));
  }, [props.cursor]);

  useEffect(() => {
    for (const [staveIdx, noteSvg] of noteSvgs.current.entries()) {
      const noteHead = noteSvg.querySelector('.vf-notehead')?.children[0] as
        | SVGElement
        | undefined;
      if (!noteHead) continue;
      const musicNoteIx = noteIndexMapRef.current[staveIdx];
      noteHead.style.fill = musicNoteIx < props.colorNotes ? 'green' : '';
    }
  }, [props.colorNotes]);

  const figureLabel = music.title
    ? t('sheetMusicFor', { title: music.title })
    : t('sheetMusic');

  return (
    <>
      <figure role="img" aria-label={figureLabel} style={{ margin: 0 }}>
        <div
          ref={vexDiv}
          className="vexflow-container"
          dir="ltr"
          aria-hidden="true"
        />
      </figure>
      <Popover
        open={Boolean(popoverAnchor)}
        anchorEl={popoverAnchor}
        onClose={() => {
          setPopoverAnchor(null);
          setPopoverNote(null);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Typography
          sx={{
            px: 1.5,
            pt: 1.5,
            pb: 0.5,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {popoverNote?.name(useSharpSpelling)}
        </Typography>
        {popoverNote && <FingeringDiagram note={popoverNote} />}
      </Popover>
    </>
  );
}
