import { useTranslation } from 'react-i18next';
import { type Note } from './music';
import { useStore } from './store';
import { NOTE_NAMES } from './constants';

export const Hole = {
  Open: 0,
  Half: 1,
  Closed: 2,
  // Trill holes animate between two states
  TrilledClosedOpen: 3, // alternates: Closed ↔ Open
  TrilledHalfOpen: 4, // alternates: Half ↔ Open
  TrilledOpenClosed: 5, // alternates: Open ↔ Closed
  TrilledClosedHalf: 6, // alternates: Closed ↔ Half
} as const;

export type Hole = (typeof Hole)[keyof typeof Hole];

const FINGERINGS: { [offset: number]: Hole[][] } = {
  1: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
    ],
  ],
  2: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Half,
    ],
  ],
  3: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
    ],
  ],
  4: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Half,
      Hole.Open,
    ],
  ],
  5: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
    ],
  ],
  6: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
    ],
  ],
  7: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
    ],
  ],
  8: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  9: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Half,
      Hole.Open,
    ],
  ],
  10: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  11: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
    [
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  12: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
    [
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  13: [
    [
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  14: [
    [
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
    [
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  15: [
    [
      Hole.Open,
      Hole.Open,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  16: [
    [
      Hole.Open,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
    ],
  ],
  17: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
    ],
  ],
  18: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Open,
    ],
  ],
  19: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
    ],
  ],
  20: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  21: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  22: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  23: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
    ],
  ],
  24: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
    ],
  ],
  25: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
    ],
  ],
  26: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
    ],
  ],
  27: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Half,
    ],
  ],
};

const GERMAN_FINGERINGS: { [offset: number]: Hole[][] } = {
  6: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  7: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
    ],
  ],
  18: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Open,
      Hole.Open,
    ],
  ],
  19: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
    ],
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Half,
      Hole.Open,
    ],
  ],
  21: [
    [
      Hole.Half,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Open,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
    ],
  ],
};

// Fingerings for trilled notes. Use Hole.TrilledClosed, Hole.TrilledHalf,
// and Hole.TrilledOpen to mark holes that animate during the trill.
// Keys are pitch offsets identical to FINGERINGS.
// eslint-disable-next-line react-refresh/only-export-components
export const TRILLED_FINGERINGS: { [offset: number]: Hole[][] } = {
  1: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.TrilledClosed,
    ],
  ],
  2: [
    [
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Closed,
      Hole.Half,
    ],
  ],
};

const CIRCLE_RADIUS = 8;
const CIRCLE_SPACING = 22;
const STROKE_WIDTH = 1.5;
const FRONT_X = 30;
const FRONT_Y = CIRCLE_RADIUS + 2;
const THUMB_X = 12;
const THUMB_Y = FRONT_Y + CIRCLE_SPACING * 0.5;
const JOINT_GAP = 4;
const DIAGRAM_HEIGHT = CIRCLE_SPACING * 7 + CIRCLE_RADIUS * 2 + 4 + JOINT_GAP;
const DIAGRAM_WIDTH = FRONT_X + CIRCLE_RADIUS + 4;
const DOUBLE_SMALL_R = 4;
const DOUBLE_LARGE_R = 7;
const DOUBLE_LEFT_X = FRONT_X - 10;
const DOUBLE_RIGHT_X = FRONT_X + 3;
const EMPTY_DIAGRAM = (
  <svg
    width={DIAGRAM_WIDTH}
    height={DIAGRAM_HEIGHT}
    style={{ display: 'block', margin: '0 auto' }}
  ></svg>
);

const INSTRUMENT_BASE_PITCH: { [key: string]: number } = {
  SOPRANINO: 76,
  SOPRANO: 71,
  ALTO: 64,
  TENOR: 59,
  BASS: 40,
  ALL: 0,
};

// eslint-disable-next-line react-refresh/only-export-components
export function lookupFingerings(
  pitch: number,
  instrumentType: string,
  german: boolean,
  trill = false
): Hole[][] | undefined {
  const offset = pitch - (INSTRUMENT_BASE_PITCH[instrumentType] ?? 0);
  if (trill) return TRILLED_FINGERINGS[offset] || FINGERINGS[offset];
  if (german && offset in GERMAN_FINGERINGS) {
    return GERMAN_FINGERINGS[offset];
  }
  return FINGERINGS[offset];
}

export function FingeringDiagram({
  note,
  forceGermanSoprano,
}: {
  note: Note;
  forceGermanSoprano?: boolean;
}) {
  const { t } = useTranslation();

  if (!note) return EMPTY_DIAGRAM;
  const { instrumentType: storeType, isGerman: storeGerman } =
    useStore.getState();
  const instrumentType = forceGermanSoprano ? 'SOPRANO' : storeType;
  const isGerman = forceGermanSoprano ? true : storeGerman;
  const hasTrill = note.decorations.includes('trill');
  const fingerings = lookupFingerings(
    note.pitches[0] ?? 0,
    instrumentType,
    isGerman,
    hasTrill
  );
  if (!fingerings) return EMPTY_DIAGRAM;

  const TRILL_HOLES = new Set([
    Hole.TrilledClosedOpen,
    Hole.TrilledHalfOpen,
    Hole.TrilledOpenClosed,
    Hole.TrilledClosedHalf,
  ]);

  function trillStates(
    hole: Hole
  ): [
    Hole.Open | Hole.Half | Hole.Closed,
    Hole.Open | Hole.Half | Hole.Closed,
  ] {
    if (hole === Hole.TrilledClosedOpen) return [Hole.Closed, Hole.Open];
    if (hole === Hole.TrilledHalfOpen) return [Hole.Half, Hole.Open];
    if (hole === Hole.TrilledClosedHalf) return [Hole.Closed, Hole.Half];
    return [Hole.Open, Hole.Closed]; // TrilledOpen
  }

  function renderTrillHole(
    hole: Hole,
    cx: number,
    cy: number,
    key: string,
    dim: boolean
  ) {
    const [stateA, stateB] = trillStates(hole);
    return (
      <g key={key}>
        <g className="trill-primary">
          {renderHole(stateA, cx, cy, `${key}-a`, dim)}
        </g>
        <g className="trill-secondary">
          {renderHole(stateB, cx, cy, `${key}-b`, dim)}
        </g>
      </g>
    );
  }

  function renderTrillDoubleHole(
    hole: Hole,
    cy: number,
    key: string,
    dim: boolean
  ) {
    const [stateA, stateB] = trillStates(hole);
    return (
      <g key={key}>
        <g className="trill-primary">
          {renderDoubleHole(stateA, cy, `${key}-a`, dim)}
        </g>
        <g className="trill-secondary">
          {renderDoubleHole(stateB, cy, `${key}-b`, dim)}
        </g>
      </g>
    );
  }

  function renderHole(
    hole: Hole,
    cx: number,
    cy: number,
    key: string,
    dim: boolean
  ) {
    if (TRILL_HOLES.has(hole)) return renderTrillHole(hole, cx, cy, key, dim);
    if (hole === Hole.Closed) {
      return (
        <circle
          key={key}
          cx={cx}
          cy={cy}
          r={CIRCLE_RADIUS}
          fill={dim ? 'grey' : 'black'}
          stroke={dim ? 'grey' : 'black'}
          strokeWidth={STROKE_WIDTH}
        />
      );
    }
    if (hole === Hole.Half) {
      const clipId = `half-${key}`;
      return (
        <g key={key}>
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
            fill="white"
            stroke={dim ? 'grey' : 'black'}
            strokeWidth={STROKE_WIDTH}
          />
          <circle
            cx={cx}
            cy={cy}
            r={CIRCLE_RADIUS}
            fill={dim ? 'grey' : 'black'}
            clipPath={`url(#${clipId})`}
          />
        </g>
      );
    }
    return (
      <circle
        key={key}
        cx={cx}
        cy={cy}
        r={CIRCLE_RADIUS}
        fill="white"
        stroke={dim ? 'grey' : 'black'}
        strokeWidth={STROKE_WIDTH}
      />
    );
  }

  function renderDoubleHole(hole: Hole, cy: number, key: string, dim: boolean) {
    if (TRILL_HOLES.has(hole)) return renderTrillDoubleHole(hole, cy, key, dim);
    const color = dim ? 'grey' : 'black';
    const leftFill =
      hole === Hole.Closed || hole === Hole.Half ? color : 'white';
    const rightFill = hole === Hole.Closed ? color : 'white';
    return (
      <g key={key}>
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
      </g>
    );
  }

  let diagrams = fingerings.map((fingering, f) => (
    <svg
      key={f}
      aria-hidden="true"
      width={DIAGRAM_WIDTH}
      height={DIAGRAM_HEIGHT}
      style={{ display: 'block', margin: '0 auto' }}
    >
      {renderHole(fingering[0], THUMB_X, THUMB_Y, 'thumb', f !== 0)}
      {fingering
        .slice(1, 8)
        .map((hole, i) =>
          i >= 5
            ? renderDoubleHole(
                hole,
                FRONT_Y + i * CIRCLE_SPACING + (i >= 3 ? JOINT_GAP : 0),
                `front-${i}`,
                f !== 0
              )
            : renderHole(
                hole,
                FRONT_X,
                FRONT_Y + i * CIRCLE_SPACING + (i >= 3 ? JOINT_GAP : 0),
                `front-${i}`,
                f !== 0
              )
        )}
      <line
        x1={FRONT_X - CIRCLE_RADIUS - 2}
        x2={FRONT_X + CIRCLE_RADIUS + 2}
        y1={FRONT_Y + 2.5 * CIRCLE_SPACING + JOINT_GAP / 2}
        y2={FRONT_Y + 2.5 * CIRCLE_SPACING + JOINT_GAP / 2}
        stroke={f !== 0 ? 'grey' : 'black'}
        strokeWidth={1}
      />
    </svg>
  ));

  if (forceGermanSoprano) diagrams = diagrams.slice(0, 1);
  const noteName =
    note.pitches.length > 0 ? NOTE_NAMES[note.pitches[0] % 12] : undefined;
  const label = noteName
    ? t('fingeringFor', { note: noteName })
    : t('sheetMusic');
  return (
    <div
      role="img"
      aria-label={label}
      style={{ display: 'flex', flexDirection: 'row' }}
    >
      {diagrams}
    </div>
  );
}
