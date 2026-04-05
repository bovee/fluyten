import { staffPositionToY } from '../layout/pitchLayout';
import { STAFF_SPACE, type GraceNoteLayout } from '../layout/types';
import { Glyph } from '../glyphs/Glyph';

const GRACE_FONT_SIZE_RATIO = 0.65; // grace notes are ~65% of normal size
const GRACE_STEM_LENGTH = 20;

interface GraceNoteGroupProps {
  graceNote: GraceNoteLayout;
  staffTopY: number;
  fill?: string;
}

function accidentalGlyph(acc: string): string | null {
  if (acc === '##') return 'accidentalDoubleSharp';
  if (acc === '#') return 'accidentalSharp';
  if (acc === 'bb') return 'accidentalDoubleFlat';
  if (acc === 'b') return 'accidentalFlat';
  if (acc === '=') return 'accidentalNatural';
  return null;
}

export function GraceNoteGroup({
  graceNote,
  staffTopY,
  fill = 'black',
}: GraceNoteGroupProps) {
  const { x, staffPositions, isSlash, accidentals } = graceNote;
  const sp = staffPositions[0] ?? 0;

  // Grace noteheads use a smaller glyph size; we render at normal glyph size but
  // use a transform scale. Bravura doesn't have a built-in small notehead —
  // we use SVG transform to scale the group.
  const noteheadY = staffPositionToY(sp, staffTopY);
  // Stem goes up for grace notes (conventional)
  const stemX = x + 4;
  const stemY1 = noteheadY - STAFF_SPACE / 2;
  const stemY2 = stemY1 - GRACE_STEM_LENGTH;

  return (
    <g
      transform={`scale(${GRACE_FONT_SIZE_RATIO}) translate(${x * (1 - 1 / GRACE_FONT_SIZE_RATIO)}, ${noteheadY * (1 - 1 / GRACE_FONT_SIZE_RATIO)})`}
    >
      {/* Accidental */}
      {staffPositions.map((s, i) => {
        const raw = accidentals[i];
        const acc = raw ? accidentalGlyph(raw) : null;
        if (!acc) return null;
        const ay = staffPositionToY(s, staffTopY);
        return <Glyph key={i} name={acc} x={x - 10} y={ay} fill={fill} />;
      })}

      {/* Notehead */}
      <Glyph name="noteheadBlack" x={x - 5} y={noteheadY} fill={fill} />

      {/* Stem */}
      <line
        x1={stemX}
        y1={stemY1}
        x2={stemX}
        y2={stemY2}
        stroke={fill}
        strokeWidth={1.5}
      />

      {/* Slash (grace-slash) through stem */}
      {isSlash && (
        <line
          x1={stemX - 5}
          y1={stemY2 + 8}
          x2={stemX + 5}
          y2={stemY2 - 2}
          stroke={fill}
          strokeWidth={1.5}
        />
      )}
    </g>
  );
}
