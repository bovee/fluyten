import { SMUFL } from './smufl';

// SMuFL defines 1 staff space = 0.25 em, so font-size = 4 * STAFF_SPACE renders
// glyphs at the correct physical size relative to the staff.
export const STAFF_SPACE = 10; // px
const FONT_SIZE = 4 * STAFF_SPACE;

export function Glyph({
  name,
  x,
  y,
  fill = 'currentColor',
  fontSize = FONT_SIZE,
}: {
  name: string;
  x: number;
  y: number;
  fill?: string;
  fontSize?: number;
}) {
  const char = SMUFL[name];
  if (!char) return null;
  return (
    <text
      x={x}
      y={y}
      fontFamily="Bravura, serif"
      fontSize={fontSize}
      fill={fill}
      style={{ userSelect: 'none' }}
    >
      {char}
    </text>
  );
}
