import { STAFF_HEIGHT, STAFF_SPACE } from '../layout/types';
import type { BarlineEndType, BarlineStartType } from '../layout/types';

const THIN = 1.5;
const THICK = 4;
const DOT_RADIUS = 2;
const DOT_GAP = 3.5; // gap between dots and thin line

// Dots appear in spaces 2 and 3 from bottom (staff positions -1 and +1)
const DOT_Y_OFFSETS = [
  STAFF_HEIGHT / 2 - STAFF_SPACE / 2,  // space above middle = staff pos +1
  STAFF_HEIGHT / 2 + STAFF_SPACE / 2,  // space below middle = staff pos -1
];

interface BarlineProps {
  x: number;
  staffTopY: number;
}

/** Single barline drawn at the left edge of a bar (for begin-repeat). */
export function BarlineStart({ x, staffTopY, type }: BarlineProps & { type: BarlineStartType }) {
  if (type === 'none') return null;
  // begin_repeat: thick | thin | dots
  const y1 = staffTopY;
  const y2 = staffTopY + STAFF_HEIGHT;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="black" strokeWidth={THICK} />
      <line x1={x + THICK + 1} y1={y1} x2={x + THICK + 1} y2={y2} stroke="black" strokeWidth={THIN} />
      {DOT_Y_OFFSETS.map((dy, i) => (
        <circle
          key={i}
          cx={x + THICK + 1 + DOT_GAP}
          cy={staffTopY + dy}
          r={DOT_RADIUS}
          fill="black"
        />
      ))}
    </g>
  );
}

/** Barline drawn at the right edge of a bar. */
export function BarlineEnd({ x, staffTopY, type }: BarlineProps & { type: BarlineEndType }) {
  const y1 = staffTopY;
  const y2 = staffTopY + STAFF_HEIGHT;

  switch (type) {
    case 'standard':
      return <line x1={x} y1={y1} x2={x} y2={y2} stroke="black" strokeWidth={THIN} />;

    case 'double':
      return (
        <g>
          <line x1={x - 3} y1={y1} x2={x - 3} y2={y2} stroke="black" strokeWidth={THIN} />
          <line x1={x} y1={y1} x2={x} y2={y2} stroke="black" strokeWidth={THIN} />
        </g>
      );

    case 'end':
      return (
        <g>
          <line x1={x - THICK - 1} y1={y1} x2={x - THICK - 1} y2={y2} stroke="black" strokeWidth={THIN} />
          <line x1={x} y1={y1} x2={x} y2={y2} stroke="black" strokeWidth={THICK} />
        </g>
      );

    case 'end_repeat':
      // dots | thin | thick
      return (
        <g>
          {DOT_Y_OFFSETS.map((dy, i) => (
            <circle
              key={i}
              cx={x - THICK - 1 - DOT_GAP}
              cy={staffTopY + dy}
              r={DOT_RADIUS}
              fill="black"
            />
          ))}
          <line x1={x - THICK - 1} y1={y1} x2={x - THICK - 1} y2={y2} stroke="black" strokeWidth={THIN} />
          <line x1={x} y1={y1} x2={x} y2={y2} stroke="black" strokeWidth={THICK} />
        </g>
      );

    case 'begin_end_repeat':
      // dots | thin | thick | thin | dots
      return (
        <g>
          {DOT_Y_OFFSETS.map((dy, i) => (
            <circle key={`l${i}`} cx={x - THICK - 2 - DOT_GAP * 2} cy={staffTopY + dy} r={DOT_RADIUS} fill="black" />
          ))}
          <line x1={x - THICK - 2} y1={y1} x2={x - THICK - 2} y2={y2} stroke="black" strokeWidth={THIN} />
          <line x1={x - THICK / 2} y1={y1} x2={x - THICK / 2} y2={y2} stroke="black" strokeWidth={THICK} />
          <line x1={x + THICK / 2 + 1} y1={y1} x2={x + THICK / 2 + 1} y2={y2} stroke="black" strokeWidth={THIN} />
          {DOT_Y_OFFSETS.map((dy, i) => (
            <circle key={`r${i}`} cx={x + THICK / 2 + 1 + DOT_GAP} cy={staffTopY + dy} r={DOT_RADIUS} fill="black" />
          ))}
        </g>
      );
  }
}
