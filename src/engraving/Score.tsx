import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import type { Music, Note } from '../music';
import { FIFTHS_TO_ACCIDENTALS, KEYS } from '../music';
import { computeLayout } from './layout/layoutEngine';
import { LEFT_MARGIN } from './layout/types';
import { StaffLines } from './components/StaffLines';
import { Bar, PreambleBar } from './components/Bar';
import {
  Tie,
  TupletBracket,
  VoltaBracket,
} from './components/CrossBarElements';
import { TempoMark } from './components/TempoMark';
import { Cursor } from './components/Cursor';
import { FingeringDiagram } from '../FingeringDiagram';

type Clef = 'treble' | 'treble8va' | 'bass' | 'alto';

export interface ScoreProps {
  music: Music;
  /** Container width in pixels (used for line breaking). */
  width: number;
  /** Per-note result map: note index → 'correct' | 'wrong' */
  noteResults?: ReadonlyMap<number, 'correct' | 'wrong'>;
  cursor?: { noteIdx: number };
  autoScroll?: boolean;
  onNoteClick?: (noteIdx: number) => void;
}

const NOTE_COLORS = {
  correct: '#22c55e',
  wrong: '#ef4444',
} as const;

export function Score({
  music,
  width,
  noteResults,
  cursor,
  autoScroll = true,
  onNoteClick: onNoteClickProp,
}: ScoreProps) {
  const theme = useTheme();
  const layout = useMemo(() => computeLayout(music, width), [music, width]);
  const clef = music.clef as Clef;
  const sig0 = music.signatures[0];
  const tempoText = sig0?.tempoText;
  const tempo = sig0?.tempo;

  // Sharp spelling: use sharps unless the key has flats
  const useSharpSpelling = useMemo(() => {
    const accs =
      FIFTHS_TO_ACCIDENTALS[KEYS[sig0?.keySignature ?? 'C'] ?? 0] ?? [];
    return accs.length === 0 || accs[0].includes('#');
  }, [sig0]);

  // Per-note fill color map
  const noteFills = useMemo(() => {
    const map = new Map<number, string>();
    if (noteResults) {
      for (const [idx, result] of noteResults) {
        map.set(
          idx,
          result === 'correct' ? NOTE_COLORS.correct : NOTE_COLORS.wrong
        );
      }
    }
    if (cursor !== undefined && cursor.noteIdx >= 0) {
      map.set(Math.floor(cursor.noteIdx), theme.palette.primary.main);
    }
    return map;
  }, [noteResults, cursor, theme.palette.primary.main]);

  // Wrong-note set for X marks
  const wrongNotes = useMemo(() => {
    const set = new Set<number>();
    if (noteResults) {
      for (const [idx, result] of noteResults) {
        if (result === 'wrong') set.add(idx);
      }
    }
    return set;
  }, [noteResults]);

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
    if (!autoScroll || cursor === undefined || cursor.noteIdx < 0) {
      prevLineIdxRef.current = -1;
      return;
    }
    const targetNoteIdx = Math.floor(cursor.noteIdx);
    let lineIdx = -1;
    outer: for (let i = 0; i < layout.lines.length; i++) {
      for (const bar of layout.lines[i].bars) {
        for (const note of bar.notes) {
          if (note.musicNoteIndex === targetNoteIdx) {
            lineIdx = i;
            break outer;
          }
        }
      }
    }
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
  }, [autoScroll, cursor, layout, svgEl]);

  const handleNoteClick = (noteIdx: number, x: number, y: number) => {
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
  };

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

          // If the next line's first bar starts with a breath mark on its first note,
          // render it here at the end of this line.
          const nextLineFirstNote =
            layout.lines[lineIdx + 1]?.bars[0]?.notes[0];
          const hasTrailingBreath =
            nextLineFirstNote?.decorations.includes('breath') ?? false;

          return (
            <g key={lineIdx}>
              {hasTrailingBreath && (
                <text
                  x={staffRight}
                  y={staffTopY - 10}
                  fontSize={32}
                  fontWeight="bold"
                  fontFamily="serif"
                  textAnchor="middle"
                  fill="currentColor"
                >
                  ,
                </text>
              )}

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
                  clef={clef}
                  noteFills={noteFills}
                  wrongNotes={wrongNotes}
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
            </g>
          );
        })}

        {/* Playback/recording cursor */}
        {cursor !== undefined && cursor.noteIdx >= 0 && (
          <Cursor noteIdx={cursor.noteIdx} layout={layout} />
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
          {popoverNote?.name(useSharpSpelling)}
        </Typography>
        {popoverNote && <FingeringDiagram note={popoverNote} />}
      </Popover>
    </>
  );
}
