import { useId } from 'react';
import { Hole as HoleState } from './recorder';

export const CIRCLE_RADIUS = 8;
export const CIRCLE_SPACING = 22;
export const STROKE_WIDTH = 1.5;
export const FRONT_X = 30;
export const FRONT_Y = CIRCLE_RADIUS + 2;
export const THUMB_X = 12;
export const THUMB_Y = FRONT_Y + CIRCLE_SPACING * 0.5;
export const JOINT_GAP = 4;
export const DOUBLE_SMALL_R = 4;
export const DOUBLE_LARGE_R = 7;
export const BELL_RADIUS = CIRCLE_RADIUS;
export const BELL_ARC_RADIUS = BELL_RADIUS * 1.4;
export const LAST_HOLE_Y = FRONT_Y + 6 * CIRCLE_SPACING + JOINT_GAP;
export const BELL_Y = LAST_HOLE_Y + DOUBLE_LARGE_R + 8;
export const BELL_DEPTH =
  BELL_ARC_RADIUS - Math.sqrt(BELL_ARC_RADIUS ** 2 - BELL_RADIUS ** 2);
export const DIAGRAM_HEIGHT = BELL_Y + BELL_DEPTH + 4;
export const DIAGRAM_WIDTH = FRONT_X + CIRCLE_RADIUS + 4;
// Whistle has 6 holes with no thumb, double holes, or bell
export const WHISTLE_DIAGRAM_HEIGHT =
  FRONT_Y + 5 * CIRCLE_SPACING + CIRCLE_RADIUS + 6;
export const DOUBLE_LEFT_X = FRONT_X - 10;
export const DOUBLE_RIGHT_X = FRONT_X + 3;

const TRILL_STATES = new Set<HoleState>([
  HoleState.TrilledClosedOpen,
  HoleState.TrilledHalfOpen,
  HoleState.TrilledOpenClosed,
  HoleState.TrilledClosedHalf,
]);

export interface HoleColors {
  bgColor: string;
  dimColor: string;
}

function trillPair(hole: HoleState): [HoleState, HoleState] {
  if (hole === HoleState.TrilledClosedOpen)
    return [HoleState.Closed, HoleState.Open];
  if (hole === HoleState.TrilledHalfOpen)
    return [HoleState.Half, HoleState.Open];
  if (hole === HoleState.TrilledClosedHalf)
    return [HoleState.Closed, HoleState.Half];
  return [HoleState.Open, HoleState.Closed]; // TrilledOpenClosed
}

export function Hole({
  hole,
  cx,
  cy,
  dim,
  colors,
}: {
  hole: HoleState;
  cx: number;
  cy: number;
  dim: boolean;
  colors: HoleColors;
}) {
  const clipId = useId();
  if (TRILL_STATES.has(hole)) {
    const [stateA, stateB] = trillPair(hole);
    return (
      <>
        <g className="trill-primary">
          <Hole hole={stateA} cx={cx} cy={cy} dim={dim} colors={colors} />
        </g>
        <g className="trill-secondary">
          <Hole hole={stateB} cx={cx} cy={cy} dim={dim} colors={colors} />
        </g>
      </>
    );
  }
  const { bgColor, dimColor } = colors;
  if (hole === HoleState.Closed) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={CIRCLE_RADIUS}
        fill={dim ? dimColor : 'currentColor'}
        stroke={dim ? dimColor : 'currentColor'}
        strokeWidth={STROKE_WIDTH}
      />
    );
  }
  if (hole === HoleState.Half) {
    return (
      <g>
        <defs>
          <clipPath id={clipId}>
            <rect
              x={cx - CIRCLE_RADIUS}
              y={cy - CIRCLE_RADIUS}
              width={CIRCLE_RADIUS}
              height={CIRCLE_RADIUS * 2}
            />
          </clipPath>
        </defs>
        <circle
          cx={cx}
          cy={cy}
          r={CIRCLE_RADIUS}
          fill={bgColor}
          stroke={dim ? dimColor : 'currentColor'}
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          cx={cx}
          cy={cy}
          r={CIRCLE_RADIUS}
          fill={dim ? dimColor : 'currentColor'}
          clipPath={`url(#${clipId})`}
        />
      </g>
    );
  }
  // Open
  return (
    <circle
      cx={cx}
      cy={cy}
      r={CIRCLE_RADIUS}
      fill="white"
      stroke={dim ? 'grey' : 'black'}
      strokeWidth={STROKE_WIDTH}
    />
  );
}

export function DoubleHole({
  hole,
  cy,
  dim,
  colors,
}: {
  hole: HoleState;
  cy: number;
  dim: boolean;
  colors: HoleColors;
}) {
  if (TRILL_STATES.has(hole)) {
    const [stateA, stateB] = trillPair(hole);
    return (
      <>
        <g className="trill-primary">
          <DoubleHole hole={stateA} cy={cy} dim={dim} colors={colors} />
        </g>
        <g className="trill-secondary">
          <DoubleHole hole={stateB} cy={cy} dim={dim} colors={colors} />
        </g>
      </>
    );
  }
  const { bgColor, dimColor } = colors;
  const color = dim ? dimColor : 'currentColor';
  const leftFill =
    hole === HoleState.Closed || hole === HoleState.Half ? color : bgColor;
  const rightFill = hole === HoleState.Closed ? color : bgColor;
  return (
    <>
      <circle
        cx={DOUBLE_LEFT_X}
        cy={cy}
        r={DOUBLE_SMALL_R}
        fill={leftFill}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
      />
      <circle
        cx={DOUBLE_RIGHT_X}
        cy={cy}
        r={DOUBLE_LARGE_R}
        fill={rightFill}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
      />
    </>
  );
}
