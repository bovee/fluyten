import { useMemo } from 'react';
import type { LayoutResult } from '../layout/types';
import { STAFF_HEIGHT } from '../layout/types';

interface CursorProps {
  /** Fractional note index: floor = current note, fraction = interpolation to next. */
  noteIdx: number;
  layout: LayoutResult;
}

/** Build a flat map from musicNoteIndex → {x, lineY, barRight} for all notes in the layout. */
function buildNotePosMap(
  layout: LayoutResult
): Map<number, { x: number; lineY: number; barRight: number }> {
  const map = new Map<number, { x: number; lineY: number; barRight: number }>();
  for (const line of layout.lines) {
    for (const bar of line.bars) {
      const barRight = bar.x + bar.width;
      for (const note of bar.notes) {
        map.set(note.musicNoteIndex, { x: note.x, lineY: line.y, barRight });
      }
    }
  }
  return map;
}

export function Cursor({ noteIdx, layout }: CursorProps) {
  const posMap = useMemo(() => buildNotePosMap(layout), [layout]);

  const floor = Math.floor(noteIdx);
  const frac = noteIdx - floor;

  const posA = posMap.get(floor);
  if (!posA) return null;

  let x = posA.x;
  if (frac > 0) {
    const posB = posMap.get(floor + 1);
    if (posB && posB.lineY === posA.lineY) {
      x = posA.x + frac * (posB.x - posA.x);
    } else {
      // Next note is on a different line (or doesn't exist): advance toward bar's right edge.
      x = posA.x + frac * (posA.barRight - posA.x);
    }
  }

  const y1 = posA.lineY - 4;
  const y2 = posA.lineY + STAFF_HEIGHT + 4;

  return (
    <line
      x1={x}
      y1={y1}
      x2={x}
      y2={y2}
      stroke="rgba(0, 120, 255, 0.5)"
      strokeWidth={4}
      strokeLinecap="round"
      style={{ pointerEvents: 'none' }}
    />
  );
}
