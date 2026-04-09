import type {
  TieLayout,
  TupletLayout,
  VoltaSegment,
  SpanDecorationLayout,
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
  const { startX, endX, y, num, written } = tuplet;
  const midX = (startX + endX) / 2;
  const label = written !== undefined ? `${num}:${written}` : String(num);
  // Wider gap when showing p:q
  const halfGap = written !== undefined ? 14 : 8;

  return (
    <g>
      {/* Left arm */}
      <line
        x1={startX}
        y1={y}
        x2={startX}
        y2={y - BRACKET_HEIGHT}
        stroke="currentColor"
        strokeWidth={1}
      />
      {/* Horizontal line, broken in the middle for the label */}
      <line
        x1={startX}
        y1={y - BRACKET_HEIGHT}
        x2={midX - halfGap}
        y2={y - BRACKET_HEIGHT}
        stroke="currentColor"
        strokeWidth={1}
      />
      <line
        x1={midX + halfGap}
        y1={y - BRACKET_HEIGHT}
        x2={endX}
        y2={y - BRACKET_HEIGHT}
        stroke="currentColor"
        strokeWidth={1}
      />
      {/* Right arm */}
      <line
        x1={endX}
        y1={y}
        x2={endX}
        y2={y - BRACKET_HEIGHT}
        stroke="currentColor"
        strokeWidth={1}
      />
      {/* Number (or p:q label) */}
      <text
        x={midX}
        y={y - BRACKET_HEIGHT + 4}
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
