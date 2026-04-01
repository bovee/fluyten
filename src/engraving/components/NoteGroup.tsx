import { Duration } from '../../music';
import {
  staffPositionToY,
  staffPositionToY as spToY,
} from '../layout/pitchLayout';
import { STAFF_SPACE, type NoteLayout } from '../layout/types';
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
  return null;
}

function accidentalGlyph(acc: string): string | null {
  if (acc === '#') return 'accidentalSharp';
  if (acc === 'b') return 'accidentalFlat';
  if (acc === 'n') return 'accidentalNatural';
  return null;
}

const ACCIDENTAL_X_OFFSET = 15; // px to the left of notehead center per accidental
const SHARP_EXTRA_OFFSET = 2; // sharps need 2px more clearance than flats/naturals

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
    durationModifier,
    accidentals,
    isRest,
  } = note;

  const hasStem = !isRest && duration !== Duration.WHOLE;
  const hasFlag =
    hasStem &&
    !isBeamed &&
    (duration === Duration.EIGHTH || duration === Duration.SIXTEENTH);
  const isDotted = durationModifier === 'd';
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
              (acc === '#' ? SHARP_EXTRA_OFFSET : 0) -
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
