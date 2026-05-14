import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import type { Music, Note } from '../music';
import { FIFTHS_TO_ACCIDENTALS, KEYS } from '../music';
import { computeLayout, computeGrandStaffLayout } from './layout/layoutEngine';
import { BAR_HEIGHT, LEFT_MARGIN, STAFF_HEIGHT } from './layout/types';
import { GrandStaffBrace } from './components/GrandStaffBrace';
import { StaffLines } from './components/StaffLines';
import { Bar, PreambleBar } from './components/Bar';
import {
  Tie,
  TupletBracket,
  VoltaBracket,
  Hairpin,
  TrillSpan,
  Glissando,
} from './components/CrossBarElements';
import { TempoMark } from './components/TempoMark';
import { Cursor } from './components/Cursor';
import { FingeringDiagram } from '../FingeringDiagram';
import { NoteNameDisplay } from './NoteNameDisplay';
import { noteOctaveDots } from './noteNameUtils';
import { useStore } from '../store';
import { resolveInstrumentConfig, RECORDER_TYPES } from '../instrument';

type Clef = 'treble' | 'treble8va' | 'bass' | 'bass8va' | 'alto';

export interface ScoreProps {
  music: Music;
  /** Optional second voice; when set, both are rendered as a grand staff
   *  with shared bar boundaries and a brace. The primary `music` is rendered
   *  on the upper staff and receives the cursor / note-result coloring. */
  secondaryMusic?: Music;
  /** Container width in pixels (used for line breaking). */
  width: number;
  /** Per-note result map: note index → 'correct' | 'wrong' */
  noteResults?: ReadonlyMap<number, 'correct' | 'wrong'>;
  /** Per-note result map for the secondary (bass) voice when grand staff. */
  secondaryNoteResults?: ReadonlyMap<number, 'correct' | 'wrong'>;
  cursor?: number;
  autoScroll?: boolean;
  onNoteClick?: (noteIdx: number) => void;
}

const NOTE_COLORS = {
  correct: '#22c55e',
  wrong: '#ef4444',
} as const;

function buildNoteFills(
  results: ReadonlyMap<number, 'correct' | 'wrong'> | undefined,
  music: Music
): Map<number, string> {
  const map = new Map<number, string>();
  if (!results) return map;
  const isTieCurve = (s: number, e: number) => {
    if (e !== s + 1) return false;
    const a = music.notes[s];
    const b = music.notes[e];
    return (
      !!a &&
      !!b &&
      a.pitches.length > 0 &&
      a.pitches.length === b.pitches.length &&
      a.pitches.every((p, i) => p === b.pitches[i])
    );
  };
  for (const [idx, result] of results) {
    const color =
      result === 'correct' ? NOTE_COLORS.correct : NOTE_COLORS.wrong;
    map.set(idx, color);
    // Propagate color forward through any tie chain.
    let cur = idx;
    while (true) {
      const next = music.curves.find(
        ([s, e]) => s === cur && isTieCurve(s, e)
      )?.[1];
      if (next === undefined || map.has(next)) break;
      map.set(next, color);
      cur = next;
    }
  }
  return map;
}

function buildWrongSet(noteFills: Map<number, string>): Set<number> {
  const set = new Set<number>();
  for (const [idx, color] of noteFills) {
    if (color === NOTE_COLORS.wrong) set.add(idx);
  }
  return set;
}

export const Score = memo(function Score({
  music,
  secondaryMusic,
  width,
  noteResults,
  secondaryNoteResults,
  cursor,
  autoScroll = true,
  onNoteClick: onNoteClickProp,
}: ScoreProps) {
  const theme = useTheme();
  const instrumentType = useStore((s) => s.instrumentType);
  const customBasePitchStr = useStore((s) => s.customBasePitchStr);
  const customHighNoteStr = useStore((s) => s.customHighNoteStr);
  const instrumentConfig =
    resolveInstrumentConfig(
      instrumentType,
      customBasePitchStr,
      customHighNoteStr
    ) ?? RECORDER_TYPES.SOPRANO;
  const { layout, bassLayout } = useMemo(() => {
    if (secondaryMusic) {
      const gs = computeGrandStaffLayout(music, secondaryMusic, width);
      return { layout: gs.treble, bassLayout: gs.bass };
    }
    return {
      layout: computeLayout(music, width),
      bassLayout: undefined as ReturnType<typeof computeLayout> | undefined,
    };
  }, [music, secondaryMusic, width]);
  const clef = music.clef as Clef;
  const bassClef = secondaryMusic?.clef as Clef | undefined;
  const sig0 = music.signatures[0];
  const tempoText = sig0?.tempoText;
  const tempo = sig0?.tempo;

  // Sharp spelling: use sharps unless the key has flats
  const useSharpSpelling = useMemo(() => {
    const accs =
      FIFTHS_TO_ACCIDENTALS[KEYS[sig0?.keySignature ?? 'C'] ?? 0] ?? [];
    return accs.length === 0 || accs[0].includes('#');
  }, [sig0]);

  // Per-note fill color map (note results only — cursor is handled separately
  // via cursorNoteIdx so Bar can be memoized and skips re-renders each rAF tick)
  const noteFills = useMemo(
    () => buildNoteFills(noteResults, music),
    [noteResults, music]
  );
  const bassNoteFills = useMemo(
    () =>
      secondaryMusic
        ? buildNoteFills(secondaryNoteResults, secondaryMusic)
        : new Map<number, string>(),
    [secondaryNoteResults, secondaryMusic]
  );

  // Wrong-note set for X marks (includes tie continuations via noteFills)
  const wrongNotes = useMemo(() => buildWrongSet(noteFills), [noteFills]);
  const bassWrongNotes = useMemo(
    () => buildWrongSet(bassNoteFills),
    [bassNoteFills]
  );

  // Lookups: musicNoteIndex → barIndex / lineIndex (rebuilt only when the
  // layout changes, so the per-frame cursor path stays O(1)).
  const { noteToBar, noteToLine } = useMemo(() => {
    const bar = new Map<number, number>();
    const line = new Map<number, number>();
    for (let i = 0; i < layout.lines.length; i++) {
      for (const b of layout.lines[i].bars) {
        for (const note of b.notes) {
          bar.set(note.musicNoteIndex, b.barIndex);
          line.set(note.musicNoteIndex, i);
        }
      }
    }
    return { noteToBar: bar, noteToLine: line };
  }, [layout]);

  const cursorNoteIdx =
    cursor !== undefined && cursor >= 0 ? Math.floor(cursor) : undefined;
  const cursorBarIndex =
    cursorNoteIdx !== undefined ? noteToBar.get(cursorNoteIdx) : undefined;

  // Popover state: screen coordinates set at click time
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [popoverNote, setPopoverNote] = useState<Note | null>(null);
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);

  // Auto-scroll: keep the current staff line visible during playback/practice
  const prevLineIdxRef = useRef<number>(-1);
  useEffect(() => {
    if (!autoScroll || cursor === undefined || cursor < 0) {
      prevLineIdxRef.current = -1;
      return;
    }
    const targetNoteIdx = Math.floor(cursor);
    const lineIdx = noteToLine.get(targetNoteIdx) ?? -1;
    if (lineIdx === -1 || lineIdx === prevLineIdxRef.current) return;
    prevLineIdxRef.current = lineIdx;
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    const scaleY = svgRect.height / layout.height;

    const toDocY = (svgY: number) =>
      window.scrollY + svgRect.top + svgY * scaleY;

    // Anchor = top of the line after next, or the score bottom if we're near
    // the end. Placing this at the viewport bottom means current + one lookahead
    // line are both fully visible.
    const anchorIdx = lineIdx + 2;
    const docAnchorTop =
      anchorIdx < layout.lines.length
        ? toDocY(layout.lines[anchorIdx].y)
        : toDocY(layout.height);

    window.scrollTo({
      top: docAnchorTop - window.innerHeight,
      behavior: 'smooth',
    });
  }, [autoScroll, cursor, layout, noteToLine, svgEl]);

  const handleNoteClick = useCallback(
    (noteIdx: number, x: number, y: number) => {
      const note = music.notes[noteIdx];
      if (!note) return;
      if (onNoteClickProp) {
        onNoteClickProp(noteIdx);
        return;
      }
      // Convert SVG user-space coords to screen coords
      if (svgEl) {
        const rect = svgEl.getBoundingClientRect();
        const scaleX = rect.width / layout.width;
        const scaleY = rect.height / layout.height;
        setPopoverPos({
          left: rect.left + x * scaleX,
          top: rect.top + y * scaleY,
        });
      }
      setPopoverNote(note);
    },
    [music.notes, onNoteClickProp, svgEl, layout]
  );

  // Bass-staff clicks open the fingering popover for the bass voice's note.
  // The y-coord arrives in primary-layout space; we add the same vertical
  // offset that the bass `<g transform>` applies so the popover lands on the
  // visible (shifted) notehead.
  const handleBassNoteClick = useCallback(
    (noteIdx: number, x: number, y: number) => {
      if (!secondaryMusic) return;
      const note = secondaryMusic.notes[noteIdx];
      if (!note) return;
      if (svgEl) {
        const rect = svgEl.getBoundingClientRect();
        const scaleX = rect.width / layout.width;
        const scaleY = rect.height / layout.height;
        setPopoverPos({
          left: rect.left + x * scaleX,
          top: rect.top + (y + BAR_HEIGHT) * scaleY,
        });
      }
      setPopoverNote(note);
    },
    [secondaryMusic, svgEl, layout]
  );

  return (
    <>
      <svg
        ref={setSvgEl}
        role="img"
        aria-label={music.title || 'Sheet music'}
        width={layout.width}
        height={layout.height}
        style={{
          display: 'block',
          direction: 'ltr',
          color: theme.palette.text.primary,
        }}
      >
        {layout.lines.map((line, lineIdx) => {
          const staffTopY = line.y;
          const lastBar = line.bars[line.bars.length - 1];
          const staffRight = lastBar ? lastBar.x + lastBar.width : LEFT_MARGIN;
          const bassLine = bassLayout?.lines[lineIdx];
          const bassShiftY = BAR_HEIGHT;

          return (
            <g key={lineIdx}>
              {lineIdx === 0 && line.bars[0] && (
                <TempoMark
                  tempoText={tempoText}
                  tempo={tempo}
                  x={line.bars[0].x}
                  staffTopY={staffTopY}
                />
              )}

              <StaffLines
                x={LEFT_MARGIN}
                width={staffRight - LEFT_MARGIN}
                staffTopY={staffTopY}
              />

              {line.preambleBars.map((item, i) => (
                <PreambleBar
                  key={`pre-${i}`}
                  item={item}
                  staffTopY={staffTopY}
                  clef={clef}
                />
              ))}

              {line.bars.map((bar) => (
                <Bar
                  key={bar.barIndex}
                  bar={bar}
                  staffTopY={staffTopY}
                  noteFills={noteFills}
                  wrongNotes={wrongNotes}
                  cursorNoteIdx={
                    bar.barIndex === cursorBarIndex ? cursorNoteIdx : undefined
                  }
                  cursorColor={theme.palette.primary.main}
                  onNoteClick={handleNoteClick}
                />
              ))}

              {line.bars
                .filter((bar) => bar.volta !== undefined)
                .map((bar) => (
                  <VoltaBracket
                    key={`volta-${bar.barIndex}`}
                    volta={bar.volta!}
                    staffTopY={staffTopY}
                  />
                ))}

              {line.ties.map((tie, i) => (
                <Tie key={i} tie={tie} />
              ))}

              {line.tuplets.map((tuplet, i) => (
                <TupletBracket key={i} tuplet={tuplet} />
              ))}

              {line.spanDecorations.map((span, i) =>
                span.type === 'trill' ? (
                  <TrillSpan key={i} span={span} />
                ) : (
                  <Hairpin key={i} span={span} />
                )
              )}

              {line.glissandos.map((g, i) => (
                <Glissando key={i} glissando={g} />
              ))}

              {bassLine && bassClef && (
                <>
                  <GrandStaffBrace
                    topY={staffTopY}
                    bottomY={staffTopY + bassShiftY + STAFF_HEIGHT}
                    x={LEFT_MARGIN - 2}
                  />
                  <g transform={`translate(0, ${bassShiftY})`}>
                    <StaffLines
                      x={LEFT_MARGIN}
                      width={staffRight - LEFT_MARGIN}
                      staffTopY={staffTopY}
                    />
                    {bassLine.preambleBars.map((item, i) => (
                      <PreambleBar
                        key={`bass-pre-${i}`}
                        item={item}
                        staffTopY={staffTopY}
                        clef={bassClef}
                      />
                    ))}
                    {bassLine.bars.map((bar) => (
                      <Bar
                        key={`bass-${bar.barIndex}`}
                        bar={bar}
                        staffTopY={staffTopY}
                        noteFills={bassNoteFills}
                        wrongNotes={bassWrongNotes}
                        onNoteClick={handleBassNoteClick}
                      />
                    ))}
                    {bassLine.ties.map((tie, i) => (
                      <Tie key={`bass-tie-${i}`} tie={tie} />
                    ))}
                    {bassLine.tuplets.map((tuplet, i) => (
                      <TupletBracket key={`bass-tup-${i}`} tuplet={tuplet} />
                    ))}
                    {bassLine.spanDecorations.map((span, i) =>
                      span.type === 'trill' ? (
                        <TrillSpan key={`bass-sd-${i}`} span={span} />
                      ) : (
                        <Hairpin key={`bass-sd-${i}`} span={span} />
                      )
                    )}
                    {bassLine.glissandos.map((g, i) => (
                      <Glissando key={`bass-g-${i}`} glissando={g} />
                    ))}
                  </g>
                </>
              )}
            </g>
          );
        })}

        {/* Playback/recording cursor */}
        {cursor !== undefined && cursor >= 0 && (
          <Cursor
            noteIdx={cursor}
            layout={layout}
            extraBottom={bassLayout ? BAR_HEIGHT : 0}
          />
        )}
      </svg>

      <Popover
        open={Boolean(popoverPos && popoverNote)}
        anchorReference="anchorPosition"
        anchorPosition={popoverPos ?? { top: 0, left: 0 }}
        onClose={() => {
          setPopoverPos(null);
          setPopoverNote(null);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        aria-label={
          popoverNote
            ? `Fingering for ${popoverNote.name(useSharpSpelling)}`
            : undefined
        }
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
          {popoverNote && (
            <NoteNameDisplay
              name={popoverNote.name(useSharpSpelling)}
              dots={noteOctaveDots(
                popoverNote.pitches[0],
                instrumentConfig.basePitch
              )}
              fontSize="1rem"
            />
          )}
        </Typography>
        {popoverNote && <FingeringDiagram note={popoverNote} />}
      </Popover>
    </>
  );
});
