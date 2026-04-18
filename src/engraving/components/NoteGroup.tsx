import React from 'react';
import {
  Duration,
  type Accidental,
  type Annotation,
  type Decoration,
} from '../../music';
import {
  staffPositionToY,
  staffPositionToY as spToY,
} from '../layout/pitchLayout';
import { STAFF_HEIGHT, STAFF_SPACE, type NoteLayout } from '../layout/types';
import { Glyph } from '../glyphs/Glyph';
import { DecorationGroup } from './Decoration';
import { LyricsSyllables } from './Lyrics';

interface NoteGroupProps {
  note: NoteLayout;
  staffTopY: number;
  fill?: string;
  isBeamed?: boolean;
  isWrong?: boolean;
  onClick?: (noteIdx: number, x: number, y: number) => void;
}

/** Ledger lines needed for a staff position outside the normal staff range. */
function ledgerLinePositions(staffPositions: number[]): number[] {
  const positions = new Set<number>();
  for (const sp of staffPositions) {
    if (sp > 4) {
      // Above staff: lines at +6, +8, ... up to sp (even values only)
      for (let p = 6; p <= sp; p += 2) positions.add(p);
    } else if (sp < -4) {
      // Below staff: lines at -6, -8, ... down to sp
      for (let p = -6; p >= sp; p -= 2) positions.add(p);
    }
  }
  return Array.from(positions);
}

function noteheadGlyph(duration: Duration): string | null {
  switch (duration) {
    case Duration.WHOLE:
      return 'noteheadWhole';
    case Duration.HALF:
      return 'noteheadHalf';
    case Duration.QUARTER:
    case Duration.EIGHTH:
    case Duration.SIXTEENTH:
    case Duration.THIRTY_SECOND:
      return 'noteheadBlack';
    default:
      return null;
  }
}

function restGlyph(duration: Duration): string | null {
  switch (duration) {
    case Duration.WHOLE:
      return 'restWhole';
    case Duration.HALF:
      return 'restHalf';
    case Duration.QUARTER:
      return 'restQuarter';
    case Duration.EIGHTH:
      return 'rest8th';
    case Duration.SIXTEENTH:
      return 'rest16th';
    case Duration.THIRTY_SECOND:
      return 'rest32nd';
    default:
      return null;
  }
}

function flagGlyph(
  duration: Duration,
  direction: 'up' | 'down'
): string | null {
  if (duration === Duration.EIGHTH)
    return direction === 'up' ? 'flag8thUp' : 'flag8thDown';
  if (duration === Duration.SIXTEENTH)
    return direction === 'up' ? 'flag16thUp' : 'flag16thDown';
  if (duration === Duration.THIRTY_SECOND)
    return direction === 'up' ? 'flag32ndUp' : 'flag32ndDown';
  return null;
}

function accidentalGlyph(acc: string): string | null {
  if (acc === '##') return 'accidentalDoubleSharp';
  if (acc === '#') return 'accidentalSharp';
  if (acc === 'd#') return 'accidentalQuarterToneSharp';
  if (acc === '3d#') return 'accidentalThreeQuarterTonesSharp';
  if (acc === 'bb') return 'accidentalDoubleFlat';
  if (acc === 'b') return 'accidentalFlat';
  if (acc === 'db') return 'accidentalQuarterToneFlat';
  if (acc === '3db') return 'accidentalThreeQuarterTonesFlat';
  if (acc === 'n') return 'accidentalNatural';
  return null;
}

const TREMOLO_GLYPHS: Partial<Record<Decoration, string>> = {
  tremolo1: 'tremolo1',
  tremolo2: 'tremolo2',
  tremolo3: 'tremolo3',
  tremolo4: 'tremolo4',
};

const ANNOTATION_FONT_SIZE = 12;
const ANNOTATION_LINE_HEIGHT = 14;
// Placement offsets relative to anchor points
const ABOVE_BASE_OFFSET = 18; // px above stemEndY (above stem tip)
const BELOW_BASE_OFFSET = STAFF_HEIGHT + 20; // px below staffTopY

function renderAnnotations(
  annotations: Annotation[],
  x: number,
  noteY: number,
  stemEndY: number,
  staffTopY: number
) {
  if (annotations.length === 0) return null;

  // Group by placement; within each group the first listed goes closest to the note.
  const byPlacement = new Map<Annotation['placement'], Annotation[]>();
  for (const ann of annotations) {
    if (!byPlacement.has(ann.placement)) byPlacement.set(ann.placement, []);
    byPlacement.get(ann.placement)!.push(ann);
  }

  const elements: React.JSX.Element[] = [];

  for (const [placement, group] of byPlacement) {
    group.forEach((ann, i) => {
      let ax = x;
      let ay: number;
      let anchor: 'middle' | 'start' | 'end';

      switch (placement) {
        case 'above':
          // Stack upward: first annotation closest to stem tip.
          ay =
            Math.min(stemEndY, noteY) -
            ABOVE_BASE_OFFSET -
            i * ANNOTATION_LINE_HEIGHT;
          anchor = 'middle';
          break;
        case 'below':
          ay = staffTopY + BELOW_BASE_OFFSET + i * ANNOTATION_LINE_HEIGHT;
          anchor = 'middle';
          break;
        case 'left':
          ax = x - 12;
          ay = noteY + 4 - i * ANNOTATION_LINE_HEIGHT;
          anchor = 'end';
          break;
        case 'right':
          ax = x + 12;
          ay = noteY + 4 - i * ANNOTATION_LINE_HEIGHT;
          anchor = 'start';
          break;
        case 'auto':
        default:
          ay =
            Math.min(stemEndY, noteY) -
            ABOVE_BASE_OFFSET -
            i * ANNOTATION_LINE_HEIGHT;
          anchor = 'middle';
          break;
      }

      elements.push(
        <text
          key={`${placement}-${i}`}
          x={ax}
          y={ay}
          textAnchor={anchor}
          fontSize={ANNOTATION_FONT_SIZE}
          fontFamily="'EB Garamond', Georgia, serif"
          fontStyle="italic"
          fill="currentColor"
        >
          {ann.text}
        </text>
      );
    });
  }

  return <g>{elements}</g>;
}

// Base distance from notehead center to accidental anchor (left edge of glyph).
// Each entry is added on top of this base so the right edge of every accidental
// lands at the same position regardless of glyph width.
const ACCIDENTAL_X_OFFSET = 15;
const ACCIDENTAL_EXTRA: Partial<Record<NonNullable<Accidental>, number>> = {
  '#': 2,
  '##': 2,
  '3d#': 7,
  '3db': 9,
};

export function NoteGroup({
  note,
  staffTopY,
  fill = 'currentColor',
  isBeamed = false,
  isWrong = false,
  onClick,
}: NoteGroupProps) {
  const {
    x,
    staffPositions,
    stemDirection,
    stemStartY,
    stemEndY,
    duration,
    dots,
    accidentals,
    isRest,
  } = note;

  const hasStem = !isRest && duration !== Duration.WHOLE;
  const hasFlag =
    hasStem &&
    !isBeamed &&
    (duration === Duration.EIGHTH ||
      duration === Duration.SIXTEENTH ||
      duration === Duration.THIRTY_SECOND);
  const isDotted = dots > 0;
  const stemX = stemDirection === 'up' ? x + 5 : x - 5;

  if (isRest) {
    const glyph = restGlyph(duration);
    // SMuFL glyph anchor = baseline = visual center. Whole rest hangs from pos +2, others at pos 0.
    const restY =
      duration === Duration.WHOLE
        ? staffPositionToY(2, staffTopY)
        : staffPositionToY(0, staffTopY);
    return (
      <g>
        {glyph && <Glyph name={glyph} x={x - 6} y={restY} fill={fill} />}
        {isDotted && (
          <circle
            cx={x + 12}
            cy={staffPositionToY(1, staffTopY)}
            r={2}
            fill={fill}
          />
        )}
      </g>
    );
  }

  const ledgerPositions = ledgerLinePositions(staffPositions);
  const nhGlyph = noteheadGlyph(duration);

  return (
    <g>
      {/* Ledger lines */}
      {ledgerPositions.map((lp) => {
        const ly = staffPositionToY(lp, staffTopY);
        return (
          <line
            key={lp}
            x1={x - 9}
            y1={ly}
            x2={x + 9}
            y2={ly}
            stroke={fill}
            strokeWidth={1.5}
          />
        );
      })}

      {/* Accidentals — stacked to the left, one per pitch */}
      {staffPositions.map((sp, i) => {
        const acc = accidentals[i];
        const accGlyph = acc ? accidentalGlyph(acc) : null;
        if (!accGlyph) return null;
        const ay = spToY(sp, staffTopY);
        return (
          <Glyph
            key={i}
            name={accGlyph}
            x={
              x -
              ACCIDENTAL_X_OFFSET -
              (acc ? (ACCIDENTAL_EXTRA[acc] ?? 0) : 0) -
              (staffPositions.length - 1 - i) * 8
            }
            y={ay}
            fill={fill}
          />
        );
      })}

      {/* Noteheads */}
      {staffPositions.map((sp, i) => {
        if (!nhGlyph) return null;
        const ny = spToY(sp, staffTopY);
        return <Glyph key={i} name={nhGlyph} x={x - 5} y={ny} fill={fill} />;
      })}

      {/* Stem */}
      {hasStem && (
        <line
          x1={stemX}
          y1={stemStartY}
          x2={stemX}
          y2={stemEndY}
          stroke={fill}
          strokeWidth={1.5}
        />
      )}

      {/* Tremolo slashes — SMuFL pre-stacked beam glyph */}
      {(() => {
        const tremoloDec = note.decorations.find(
          (d) => TREMOLO_GLYPHS[d] !== undefined
        );
        if (!tremoloDec) return null;
        const glyphName = TREMOLO_GLYPHS[tremoloDec]!;
        if (hasStem) {
          // Centered on the stem
          const stemMid = (stemStartY + stemEndY) / 2;
          return <Glyph name={glyphName} x={stemX} y={stemMid} fill={fill} />;
        } else {
          // Whole note: place below the notehead
          return (
            <Glyph name={glyphName} x={x + 3} y={note.y + 18} fill={fill} />
          );
        }
      })()}

      {/* Flag */}
      {hasFlag &&
        (() => {
          const fg = flagGlyph(duration, stemDirection);
          if (!fg) return null;
          // Flag baseline: for stem up, flag attaches at stem end; for stem down likewise.
          // Bravura flag glyphs are positioned at stem tip.
          const fy =
            stemEndY +
            (stemDirection === 'up' ? STAFF_SPACE / 2 : -STAFF_SPACE / 2);
          return <Glyph name={fg} x={stemX} y={fy} fill={fill} />;
        })()}

      {/* Augmentation dot */}
      {isDotted &&
        (() => {
          // Dot goes in the space to the right. If note is on a line, shift up half a space.
          const sp = staffPositions[0];
          const dotSp = sp % 2 === 0 ? sp + 1 : sp; // push to space if on a line
          const dy = spToY(dotSp, staffTopY);
          return <circle cx={x + 10} cy={dy} r={2} fill={fill} />;
        })()}

      {/* Decorations */}
      <DecorationGroup
        decorations={note.decorations}
        x={x}
        noteY={note.y}
        stemDirection={stemDirection}
        stemEndY={stemEndY}
        staffTopY={staffTopY}
      />

      {/* Lyrics */}
      <LyricsSyllables lyrics={note.lyrics} x={x} staffTopY={staffTopY} />

      {/* Annotations */}
      {renderAnnotations(note.annotations, x, note.y, stemEndY, staffTopY)}

      {/* Wrong-note X mark */}
      {isWrong && (
        <g stroke="#d32f2f" strokeWidth={2}>
          <line x1={x - 6} y1={note.y - 6} x2={x + 6} y2={note.y + 6} />
          <line x1={x + 6} y1={note.y - 6} x2={x - 6} y2={note.y + 6} />
        </g>
      )}

      {/* Transparent click target */}
      {onClick && (
        <rect
          x={x - 10}
          y={Math.min(stemEndY, note.y) - 4}
          width={20}
          height={Math.abs(stemEndY - note.y) + 8}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => onClick(note.musicNoteIndex, x, note.y)}
        />
      )}
    </g>
  );
}
