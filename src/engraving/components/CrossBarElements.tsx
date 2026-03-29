import type { TieLayout, TupletLayout, VoltaSegment } from '../layout/types';

// ---------------------------------------------------------------------------
// Tie / Slur arc
// ---------------------------------------------------------------------------

interface TieProps {
  tie: TieLayout;
}

export function Tie({ tie }: TieProps) {
  const { startX, startY, endX, endY, curveDirection, isOpenEnd, isOpenStart } = tie;

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
      stroke="black"
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
  const { startX, endX, y, num } = tuplet;
  const midX = (startX + endX) / 2;

  return (
    <g>
      {/* Left arm */}
      <line x1={startX} y1={y} x2={startX} y2={y - BRACKET_HEIGHT} stroke="black" strokeWidth={1} />
      {/* Horizontal line, broken in the middle for the number */}
      <line x1={startX} y1={y - BRACKET_HEIGHT} x2={midX - 8} y2={y - BRACKET_HEIGHT} stroke="black" strokeWidth={1} />
      <line x1={midX + 8} y1={y - BRACKET_HEIGHT} x2={endX} y2={y - BRACKET_HEIGHT} stroke="black" strokeWidth={1} />
      {/* Right arm */}
      <line x1={endX} y1={y} x2={endX} y2={y - BRACKET_HEIGHT} stroke="black" strokeWidth={1} />
      {/* Number */}
      <text
        x={midX}
        y={y - BRACKET_HEIGHT + 4}
        textAnchor="middle"
        fontSize={10}
        fontFamily="serif"
        fill="black"
      >
        {num}
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
      <line x1={x} y1={y} x2={x + width} y2={y} stroke="black" strokeWidth={1.5} />
      {/* Left arm */}
      {showLeftArm && (
        <line x1={x} y1={y} x2={x} y2={y + VOLTA_HEIGHT} stroke="black" strokeWidth={1.5} />
      )}
      {/* Right arm */}
      {showRightArm && (
        <line x1={x + width} y1={y} x2={x + width} y2={y + VOLTA_HEIGHT} stroke="black" strokeWidth={1.5} />
      )}
      {/* Volta number */}
      {showLeftArm && (
        <text x={x + 4} y={y + 10} fontSize={10} fontFamily="serif" fill="black">
          {number}.
        </text>
      )}
    </g>
  );
}
