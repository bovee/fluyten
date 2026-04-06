import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import { type Note } from './music';
import { useStore } from './store';
import { NOTE_NAMES } from './constants';
import { RECORDER_TYPES, type RecorderType } from './instrument';

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

// Fingering strings: each character is one hole (thumb first).
function parseFingerings(raw: { [offset: number]: string[] }): {
  [offset: number]: Hole[][];
} {
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [
      k,
      v.map((s) =>
        s.split('').map((c) => {
          switch (c) {
            case 'O':
              return Hole.Open;
            case 'H':
              return Hole.Half;
            case 'C':
              return Hole.Closed;
            case 'T':
              return Hole.TrilledClosedOpen;
            case 'U':
              return Hole.TrilledOpenClosed;
            case 'V':
              return Hole.TrilledClosedHalf;
            case 'W':
              return Hole.TrilledHalfOpen;
            default:
              throw new Error(`Unknown hole character: ${c}`);
          }
        })
      ),
    ])
  );
}

const FINGERINGS: { [offset: number]: Hole[][] } = parseFingerings({
  1: ['CCCCCCCC'], // C
  2: ['CCCCCCCH'],
  3: ['CCCCCCCO'],
  4: ['CCCCCCHO'],
  5: ['CCCCCCOO'], // E
  6: ['CCCCCOCC'],
  7: ['CCCCOCCO'],
  8: ['CCCCOOOO'], // G
  9: ['CCCOCCHO'],
  10: ['CCCOOOOO'],
  11: ['CCOCCOOO', 'COCCCOOO'],
  12: ['CCOOOOOO', 'COCCOOOO'], // B
  13: ['COCOOOOO'],
  14: ['OCCOOOOO', 'COOOOOOO'],
  15: ['OOCOOOOO'], // D
  16: ['OOCCCCCO', 'HCCCCCOO'],
  17: ['HCCCCCOO'],
  18: ['HCCCCOCO'], // F
  19: ['HCCCOCOO'],
  20: ['HCCCOOOO'],
  21: ['HCCOCOOO'],
  22: ['HCCOOOOO'], // A
  23: ['HCCOCCCO'],
  24: ['HCCOCCOO'],
  25: ['HCOOCCOO'], // C
  26: ['HCOCCOCCC'],
  27: ['HCOCCOCH'],
});

const GERMAN_FINGERINGS: { [offset: number]: Hole[][] } = parseFingerings({
  6: ['CCCCCOOO'],
  7: ['CCCCOCCC'],
  18: ['HCCCCOOO'],
  19: ['HCCCOCOC', 'HCCCOCHO'],
  21: ['HCCCOCCC'],
});

// Fingerings for trilled notes. Use T/U/V/W characters to mark holes that
// animate during the trill. Keys are pitch offsets identical to FINGERINGS.
 
export const TRILLED_FINGERINGS: { [offset: number]: Hole[][] } =
  parseFingerings({
    5: ['CCCCCVOO'], // E
    11: ['CTOCCOOO'],
    12: ['COCTOOOO', 'CTOOOOOO'], // B
    15: ['OCCCCTCC'], // D
    17: ['HCCCCVOO'],
  });

const CIRCLE_RADIUS = 8;
const CIRCLE_SPACING = 22;
const STROKE_WIDTH = 1.5;
const FRONT_X = 30;
const FRONT_Y = CIRCLE_RADIUS + 2;
const THUMB_X = 12;
const THUMB_Y = FRONT_Y + CIRCLE_SPACING * 0.5;
const JOINT_GAP = 4;
const DOUBLE_SMALL_R = 4;
const DOUBLE_LARGE_R = 7;
const BELL_RADIUS = CIRCLE_RADIUS;
const BELL_ARC_RADIUS = BELL_RADIUS * 1.4;
const LAST_HOLE_Y = FRONT_Y + 6 * CIRCLE_SPACING + JOINT_GAP;
const BELL_Y = LAST_HOLE_Y + DOUBLE_LARGE_R + 8;
const BELL_DEPTH =
  BELL_ARC_RADIUS - Math.sqrt(BELL_ARC_RADIUS ** 2 - BELL_RADIUS ** 2);
const DIAGRAM_HEIGHT = BELL_Y + BELL_DEPTH + 4;
const DIAGRAM_WIDTH = FRONT_X + CIRCLE_RADIUS + 4;
const DOUBLE_LEFT_X = FRONT_X - 10;
const DOUBLE_RIGHT_X = FRONT_X + 3;
const EMPTY_DIAGRAM = (
  <svg
    aria-hidden="true"
    width={DIAGRAM_WIDTH}
    height={DIAGRAM_HEIGHT}
    style={{ display: 'block', margin: '0 auto' }}
  ></svg>
);

// eslint-disable-next-line react-refresh/only-export-components
export function lookupFingerings(
  pitch: number,
  instrumentType: string,
  german: boolean,
  trill = false
): Hole[][] | undefined {
  const offset =
    pitch - (RECORDER_TYPES[instrumentType as RecorderType]?.basePitch ?? 0);
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
  const theme = useTheme();
  const bgColor = theme.palette.background.paper;
  const dimColor = theme.palette.text.disabled;

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

  const TRILL_HOLES = new Set<Hole>([
    Hole.TrilledClosedOpen,
    Hole.TrilledHalfOpen,
    Hole.TrilledOpenClosed,
    Hole.TrilledClosedHalf,
  ]);

  function trillStates(hole: Hole): [Hole, Hole] {
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
          fill={dim ? dimColor : 'currentColor'}
          stroke={dim ? dimColor : 'currentColor'}
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
    const color = dim ? dimColor : 'currentColor';
    const leftFill =
      hole === Hole.Closed || hole === Hole.Half ? color : bgColor;
    const rightFill = hole === Hole.Closed ? color : bgColor;
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
      style={{
        display: 'block',
        margin: '0 auto',
        color: theme.palette.text.primary,
      }}
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
        stroke={f !== 0 ? dimColor : 'currentColor'}
        strokeWidth={1}
      />
      <path
        d={`M ${FRONT_X - BELL_RADIUS} ${BELL_Y} A ${BELL_ARC_RADIUS} ${BELL_ARC_RADIUS} 0 0 1 ${FRONT_X + BELL_RADIUS} ${BELL_Y}`}
        fill="none"
        stroke={f !== 0 ? dimColor : 'currentColor'}
        strokeWidth={STROKE_WIDTH}
      />
      {fingering[8] === Hole.Closed && (
        <path
          d={`M ${FRONT_X - BELL_RADIUS} ${BELL_Y} A ${BELL_ARC_RADIUS} ${BELL_ARC_RADIUS} 0 0 1 ${FRONT_X + BELL_RADIUS} ${BELL_Y} Z`}
          fill={f !== 0 ? dimColor : 'currentColor'}
        />
      )}
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
