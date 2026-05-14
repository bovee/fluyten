import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import { type Note } from '../music';
import { useStore } from '../store';
import { NOTE_NAMES } from '../constants';
import { resolveInstrumentConfig } from '../instrument';
import {
  DIAGRAM_WIDTH,
  DIAGRAM_HEIGHT,
  WHISTLE_DIAGRAM_HEIGHT,
  FRONT_X,
  FRONT_Y,
  THUMB_X,
  THUMB_Y,
  CIRCLE_RADIUS,
  CIRCLE_SPACING,
  JOINT_GAP,
  BELL_RADIUS,
  BELL_ARC_RADIUS,
  BELL_Y,
  STROKE_WIDTH,
  Hole as HoleCircle,
  DoubleHole,
} from './figure';
import { Hole, lookupFingerings } from './recorder';
import { lookupWhistleFingerings } from './whistle';
import { PianoFingering } from './piano';

const EMPTY_DIAGRAM = (
  <svg
    aria-hidden="true"
    width={DIAGRAM_WIDTH}
    height={DIAGRAM_HEIGHT}
    style={{ display: 'block', margin: '0 auto' }}
  ></svg>
);

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
  const colors = { bgColor, dimColor };
  const uid = useId();

  if (!note) return EMPTY_DIAGRAM;
  const {
    instrumentType: storeType,
    fingeringSystem: storeSystem,
    customBasePitchStr,
    customHighNoteStr,
  } = useStore.getState();

  const instrumentType = forceGermanSoprano ? 'SOPRANO' : storeType;
  const system = forceGermanSoprano ? 'german' : storeSystem;

  if (system === 'piano') return <PianoFingering note={note} />;
  const config = resolveInstrumentConfig(
    instrumentType,
    customBasePitchStr,
    customHighNoteStr
  );
  if (!config) return EMPTY_DIAGRAM;

  const pitch = note.pitches[0] ?? 0;
  const offset = pitch - config.basePitch + 1;
  const hasTrill = note.decorations.includes('trill');

  const noteName =
    note.pitches.length > 0 ? NOTE_NAMES[note.pitches[0] % 12] : undefined;
  const label = noteName
    ? t('fingeringFor', { note: noteName })
    : t('sheetMusic');

  if (system === 'whistle') {
    const fingerings = lookupWhistleFingerings(offset, hasTrill);
    if (!fingerings) return EMPTY_DIAGRAM;
    const diagrams = fingerings.map((fingering, f) => (
      <svg
        key={f}
        aria-hidden="true"
        width={DIAGRAM_WIDTH}
        height={WHISTLE_DIAGRAM_HEIGHT}
        style={{
          display: 'block',
          margin: '0 auto',
          color: theme.palette.text.primary,
        }}
      >
        {fingering.slice(0, 6).map((hole, i) => (
          <HoleCircle
            key={i}
            hole={hole}
            cx={FRONT_X}
            cy={FRONT_Y + i * CIRCLE_SPACING}
            dim={f !== 0}
            colors={colors}
          />
        ))}
      </svg>
    ));
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

  const fingerings = lookupFingerings(offset, system, hasTrill);
  if (!fingerings) return EMPTY_DIAGRAM;

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
      <HoleCircle
        hole={fingering[0]}
        cx={THUMB_X}
        cy={THUMB_Y}
        dim={f !== 0}
        colors={colors}
      />
      {fingering
        .slice(1, 8)
        .map((hole, i) =>
          i >= 5 ? (
            <DoubleHole
              key={i}
              hole={hole}
              cy={FRONT_Y + i * CIRCLE_SPACING + (i >= 3 ? JOINT_GAP : 0)}
              dim={f !== 0}
              colors={colors}
            />
          ) : (
            <HoleCircle
              key={i}
              hole={hole}
              cx={FRONT_X}
              cy={FRONT_Y + i * CIRCLE_SPACING + (i >= 3 ? JOINT_GAP : 0)}
              dim={f !== 0}
              colors={colors}
            />
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
      {fingering[8] === Hole.Half && (
        <>
          <defs>
            <clipPath
              id={`bell-half-${uid}-${f}`}
              clipPathUnits="userSpaceOnUse"
            >
              <rect x={-1000} y={-1000} width={1000 + FRONT_X} height={2000} />
            </clipPath>
          </defs>
          <path
            d={`M ${FRONT_X - BELL_RADIUS} ${BELL_Y} A ${BELL_ARC_RADIUS} ${BELL_ARC_RADIUS} 0 0 1 ${FRONT_X + BELL_RADIUS} ${BELL_Y} Z`}
            fill={f !== 0 ? dimColor : 'currentColor'}
            clipPath={`url(#bell-half-${uid}-${f})`}
          />
        </>
      )}
    </svg>
  ));

  if (forceGermanSoprano) diagrams = diagrams.slice(0, 1);
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
