import { STAFF_SPACE } from '../layout/types';

interface StaffLinesProps {
  /** Absolute x of the left edge of the staff system. */
  x: number;
  /** Total width of the staff system (to the last barline). */
  width: number;
  /** Absolute y of the top staff line. */
  staffTopY: number;
}

/**
 * Renders the 5 horizontal staff lines spanning a full line of music.
 */
export function StaffLines({ x, width, staffTopY }: StaffLinesProps) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = staffTopY + i * STAFF_SPACE;
        return (
          <line
            key={i}
            x1={x}
            y1={y}
            x2={x + width}
            y2={y}
            stroke="black"
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
}
