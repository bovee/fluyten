import { staffPositionToY } from '../layout/pitchLayout';
import {
  GRACE_FONT_SIZE_RATIO,
  GRACE_STEM_LENGTH,
  STAFF_SPACE,
  type GraceNoteLayout,
} from '../layout/types';
import { Glyph } from '../glyphs/Glyph';

const GRACE_ACCIDENTAL_FONT_SIZE = 34; // slightly smaller than normal 40px accidentals
const GRACE_FLAG_FONT_SIZE = 28; // smaller than notehead to keep flags trim

interface GraceNoteGroupProps {
  graceNote: GraceNoteLayout;
  staffTopY: number;
  isBeamed?: boolean;
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
  isBeamed = false,
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
      transform={`scale(${GRACE_FONT_SIZE_RATIO}) translate(${x * (1 / GRACE_FONT_SIZE_RATIO - 1)}, ${noteheadY * (1 / GRACE_FONT_SIZE_RATIO - 1)})`}
    >
      {/* Accidental */}
      {staffPositions.map((s, i) => {
        const raw = accidentals[i];
        const acc = raw ? accidentalGlyph(raw) : null;
        if (!acc) return null;
        const ay = staffPositionToY(s, staffTopY);
        return (
          <Glyph
            key={i}
            name={acc}
            x={x - 14}
            y={ay}
            fill={fill}
            fontSize={GRACE_ACCIDENTAL_FONT_SIZE}
          />
        );
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

      {/* Flag (eighth-note flag, stem up) — omitted when beamed */}
      {!isBeamed && (
        <Glyph
          name="flag8thUp"
          x={stemX}
          y={stemY2}
          fill={fill}
          fontSize={GRACE_FLAG_FONT_SIZE}
        />
      )}

      {/* Slash (grace-slash) through stem */}
      {isSlash && (
        <line
          x1={stemX - 5}
          y1={stemY2 + 14}
          x2={stemX + 5}
          y2={stemY2 + 4}
          stroke={fill}
          strokeWidth={1.5}
        />
      )}
    </g>
  );
}
