import type {
  TieLayout,
  TupletLayout,
  VoltaSegment,
  SpanDecorationLayout,
  GlissandoLayout,
} from '../layout/types';
import { Glyph } from '../glyphs/Glyph';

// ---------------------------------------------------------------------------
// Tie / Slur arc
// ---------------------------------------------------------------------------

interface TieProps {
  tie: TieLayout;
}

export function Tie({ tie }: TieProps) {
  const { startX, startY, endX, endY, curveDirection, isOpenEnd, isOpenStart } =
    tie;

  const cx1 = startX + (endX - startX) / 3;
  const cx2 = startX + (2 * (endX - startX)) / 3;
  const bulge = 12 * (curveDirection === 'above' ? -1 : 1);
  const cy1 = startY + bulge;
  const cy2 = endY + bulge;

  const d = `M ${startX} ${startY} C ${cx1} ${cy1} ${cx2} ${cy2} ${endX} ${endY}`;

  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap={isOpenStart || isOpenEnd ? 'square' : 'round'}
    />
  );
}

// ---------------------------------------------------------------------------
// Tuplet bracket
// ---------------------------------------------------------------------------

interface TupletBracketProps {
  tuplet: TupletLayout;
}

const BRACKET_HEIGHT = 6;

export function TupletBracket({ tuplet }: TupletBracketProps) {
  const { startX, endX, y, num, written, direction = 'above' } = tuplet;
  const midX = (startX + endX) / 2;
  const label = written !== undefined ? `${num}:${written}` : String(num);
  const halfGap = written !== undefined ? 14 : 8;
  const sign = direction === 'above' ? -1 : 1;
  const armEnd = y + sign * BRACKET_HEIGHT;
  const textY = direction === 'above' ? armEnd + 4 : armEnd - 2;

  return (
    <g>
      <line
        x1={startX}
        y1={y}
        x2={startX}
        y2={armEnd}
        stroke="currentColor"
        strokeWidth={1}
      />
      <line
        x1={startX}
        y1={armEnd}
        x2={midX - halfGap}
        y2={armEnd}
        stroke="currentColor"
        strokeWidth={1}
      />
      <line
        x1={midX + halfGap}
        y1={armEnd}
        x2={endX}
        y2={armEnd}
        stroke="currentColor"
        strokeWidth={1}
      />
      <line
        x1={endX}
        y1={y}
        x2={endX}
        y2={armEnd}
        stroke="currentColor"
        strokeWidth={1}
      />
      <text
        x={midX}
        y={textY}
        textAnchor="middle"
        fontSize={10}
        fontFamily="serif"
        fill="currentColor"
      >
        {label}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Volta bracket
// ---------------------------------------------------------------------------

interface VoltaBracketProps {
  volta: VoltaSegment;
  staffTopY: number;
}

const VOLTA_Y_OFFSET = -14; // above the top staff line
const VOLTA_HEIGHT = 12;

export function VoltaBracket({ volta, staffTopY }: VoltaBracketProps) {
  const { number, type, x, width } = volta;
  const y = staffTopY + VOLTA_Y_OFFSET;
  const showLeftArm = type === 'begin' || type === 'begin_end';
  const showRightArm = type === 'end' || type === 'begin_end';

  return (
    <g>
      {/* Top horizontal line */}
      <line
        x1={x}
        y1={y}
        x2={x + width}
        y2={y}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      {/* Left arm */}
      {showLeftArm && (
        <line
          x1={x}
          y1={y}
          x2={x}
          y2={y + VOLTA_HEIGHT}
          stroke="currentColor"
          strokeWidth={1.5}
        />
      )}
      {/* Right arm */}
      {showRightArm && (
        <line
          x1={x + width}
          y1={y}
          x2={x + width}
          y2={y + VOLTA_HEIGHT}
          stroke="currentColor"
          strokeWidth={1.5}
        />
      )}
      {/* Volta number */}
      {showLeftArm && (
        <text
          x={x + 4}
          y={y + 10}
          fontSize={10}
          fontFamily="serif"
          fill="currentColor"
        >
          {number}.
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Hairpin (crescendo / diminuendo)
// ---------------------------------------------------------------------------

interface HairpinProps {
  span: SpanDecorationLayout;
}

const HAIRPIN_SPREAD = 5; // half-height of open end in px

export function Hairpin({ span }: HairpinProps) {
  const { type, startX, endX, y, isOpenStart, isOpenEnd } = span;
  const isCrescendo = type === 'crescendo';

  // For a crescendo: point is at startX, open end at endX.
  // For a diminuendo: open end is at startX, point is at endX.
  // Cross-line open ends continue the opening shape.
  const leftSpread = isCrescendo
    ? isOpenStart
      ? HAIRPIN_SPREAD
      : 0
    : HAIRPIN_SPREAD;
  const rightSpread = isCrescendo
    ? HAIRPIN_SPREAD
    : isOpenEnd
      ? HAIRPIN_SPREAD
      : 0;

  return (
    <g>
      <line
        x1={startX}
        y1={y - leftSpread}
        x2={endX}
        y2={y - rightSpread}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="butt"
      />
      <line
        x1={startX}
        y1={y + leftSpread}
        x2={endX}
        y2={y + rightSpread}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="butt"
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Trill span (tr glyph + wavy extension line)
// ---------------------------------------------------------------------------

interface TrillSpanProps {
  span: SpanDecorationLayout;
}

const TRILL_GLYPH_WIDTH = 14; // approximate width of the ornamentTrill glyph
const WAVE_PERIOD = 8; // px per wave cycle
const WAVE_AMP = 2; // amplitude of the wavy line

/** Build an SVG path for a horizontal wavy line from x0 to x1 at height y. */
function wavyLinePath(x0: number, x1: number, y: number): string {
  if (x1 <= x0) return '';
  const periods = Math.max(1, Math.round((x1 - x0) / WAVE_PERIOD));
  const dx = (x1 - x0) / periods;
  let d = `M ${x0} ${y}`;
  for (let i = 0; i < periods; i++) {
    const px = x0 + i * dx;
    d += ` C ${px + dx * 0.25} ${y - WAVE_AMP} ${px + dx * 0.75} ${y + WAVE_AMP} ${px + dx} ${y}`;
  }
  return d;
}

export function TrillSpan({ span }: TrillSpanProps) {
  const { startX, endX, y, isOpenStart } = span;

  const glyphX = isOpenStart ? null : startX - 5;
  const waveStartX = isOpenStart ? startX : startX + TRILL_GLYPH_WIDTH;
  const wavePath = wavyLinePath(waveStartX, endX, y);

  return (
    <g>
      {glyphX !== null && <Glyph name="ornamentTrill" x={glyphX} y={y} />}
      {wavePath && (
        <path d={wavePath} fill="none" stroke="currentColor" strokeWidth={1} />
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Glissando (zigzag line between two noteheads)
// ---------------------------------------------------------------------------

interface GlissandoProps {
  glissando: GlissandoLayout;
}

const GLISS_TOOTH = 8; // px per zigzag tooth (horizontal)
const GLISS_AMP = 3; // half-height of each tooth (px)

function glissandoPath(x0: number, y0: number, x1: number, y1: number): string {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (dx <= 0) return '';
  const len = Math.sqrt(dx * dx + dy * dy);
  // Unit vector along the line and perpendicular to it
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy; // perpendicular x
  const py = ux; // perpendicular y

  const teeth = Math.max(1, Math.round(dx / GLISS_TOOTH));
  const step = 1 / teeth;
  let d = `M ${x0} ${y0}`;
  for (let i = 0; i < teeth; i++) {
    const t1 = (i + 0.5) * step;
    const t2 = (i + 1) * step;
    const sign = i % 2 === 0 ? 1 : -1;
    const mx = x0 + t1 * dx + sign * GLISS_AMP * px;
    const my = y0 + t1 * dy + sign * GLISS_AMP * py;
    const ex = x0 + t2 * dx;
    const ey = y0 + t2 * dy;
    d += ` L ${mx} ${my} L ${ex} ${ey}`;
  }
  return d;
}

export function Glissando({ glissando }: GlissandoProps) {
  const { startX, startY, endX, endY } = glissando;
  const d = glissandoPath(startX, startY, endX, endY);
  if (!d) return null;
  return (
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}
