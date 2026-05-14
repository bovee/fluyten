import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import { type Note } from '../music';
import { NOTE_NAMES } from '../constants';

const WHITE_WIDTH = 14;
const WHITE_HEIGHT = 60;
const BLACK_WIDTH = 9;
const BLACK_HEIGHT = 38;
const NUM_WHITE = 7;
const KEYBOARD_WIDTH = WHITE_WIDTH * NUM_WHITE;
const STROKE = 1;
const PAD_Y = 4;
const TOTAL_HEIGHT = WHITE_HEIGHT + PAD_Y * 2;

// White-key pitch classes in order (C,D,E,F,G,A,B) and their semitone offsets.
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
// Black key pitch classes and the index of the white key to their LEFT.
const BLACK_KEYS: { pc: number; leftWhite: number }[] = [
  { pc: 1, leftWhite: 0 }, // C#
  { pc: 3, leftWhite: 1 }, // D#
  { pc: 6, leftWhite: 3 }, // F#
  { pc: 8, leftWhite: 4 }, // G#
  { pc: 10, leftWhite: 5 }, // A#
];

function midiToNearestWhiteIndex(midi: number): number {
  const pc = ((midi % 12) + 12) % 12;
  const octaveBlock = Math.floor(midi / 12);
  const upMap = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
  return octaveBlock * 7 + upMap[pc];
}

function whiteIndexToMidi(whiteIndex: number): number {
  const octave = Math.floor(whiteIndex / 7);
  const slot = ((whiteIndex % 7) + 7) % 7;
  return octave * 12 + WHITE_PCS[slot];
}

function computePianoWindow(pitches: number[]): {
  startWhite: number;
  clippedLow: number;
  clippedHigh: number;
} {
  const mean = pitches.reduce((s, p) => s + p, 0) / Math.max(pitches.length, 1);
  const centerWhite = midiToNearestWhiteIndex(Math.round(mean));
  const startWhite = centerWhite - 3;
  const endWhite = startWhite + NUM_WHITE - 1;
  const startMidi = whiteIndexToMidi(startWhite);
  const endMidi = whiteIndexToMidi(endWhite) + 1; // include B as part of window
  let clippedLow = 0;
  let clippedHigh = 0;
  for (const p of pitches) {
    if (p < startMidi) clippedLow++;
    else if (p > endMidi) clippedHigh++;
  }
  return { startWhite, clippedLow, clippedHigh };
}

export function PianoFingering({ note }: { note: Note }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const paper = theme.palette.background.paper;
  const fg = theme.palette.text.primary;
  const muted = theme.palette.text.disabled;

  if (!note || note.pitches.length === 0) {
    return (
      <svg
        aria-hidden="true"
        width={KEYBOARD_WIDTH + 2}
        height={TOTAL_HEIGHT}
        style={{ display: 'block', margin: '0 auto' }}
      />
    );
  }

  const { startWhite, clippedLow, clippedHigh } = computePianoWindow(
    note.pitches
  );

  const selected = new Set(note.pitches);

  const noteName = NOTE_NAMES[note.pitches[0] % 12];
  const label = t('fingeringFor', { note: noteName });

  // White keys
  const whiteRects = [];
  const cLabels = [];
  for (let i = 0; i < NUM_WHITE; i++) {
    const wIdx = startWhite + i;
    const midi = whiteIndexToMidi(wIdx);
    const isSel = selected.has(midi);
    const x = i * WHITE_WIDTH;
    whiteRects.push(
      <rect
        key={`w-${i}`}
        x={x + 0.5}
        y={PAD_Y + 0.5}
        width={WHITE_WIDTH - 1}
        height={WHITE_HEIGHT - 1}
        fill={isSel ? primary : paper}
        stroke={fg}
        strokeWidth={STROKE}
      />
    );
    if (midi % 12 === 0) {
      const octave = Math.floor(midi / 12) - 1;
      cLabels.push(
        <text
          key={`c-${i}`}
          x={x + WHITE_WIDTH / 2}
          y={PAD_Y + WHITE_HEIGHT - 5}
          fontSize={8}
          textAnchor="middle"
          fill={isSel ? paper : muted}
          style={{ pointerEvents: 'none', fontFamily: 'sans-serif' }}
        >
          {octave}
        </text>
      );
    }
  }

  // Black keys
  const blackRects = [];
  for (let i = 0; i < NUM_WHITE; i++) {
    const wIdx = startWhite + i;
    const slot = ((wIdx % 7) + 7) % 7;
    const bk = BLACK_KEYS.find((b) => b.leftWhite === slot);
    if (!bk) continue;
    // Black key sits on the boundary between white i and i+1 (if there's a white i+1 in window).
    if (i + 1 >= NUM_WHITE) continue;
    const octave = Math.floor(wIdx / 7);
    const midi = octave * 12 + bk.pc;
    const isSel = selected.has(midi);
    const x = (i + 1) * WHITE_WIDTH - BLACK_WIDTH / 2;
    blackRects.push(
      <rect
        key={`b-${i}`}
        x={x}
        y={PAD_Y}
        width={BLACK_WIDTH}
        height={BLACK_HEIGHT}
        fill={isSel ? primary : fg}
        stroke={fg}
        strokeWidth={STROKE}
      />
    );
  }

  return (
    <svg
      role="img"
      aria-label={label}
      width={KEYBOARD_WIDTH + 2}
      height={TOTAL_HEIGHT}
      style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}
    >
      {whiteRects}
      {cLabels}
      {blackRects}
      {clippedLow > 0 && (
        <text
          x={-2}
          y={PAD_Y + WHITE_HEIGHT / 2 + 4}
          fontSize={12}
          textAnchor="end"
          fill={primary}
          style={{ fontFamily: 'sans-serif', fontWeight: 'bold' }}
        >
          +
        </text>
      )}
      {clippedHigh > 0 && (
        <text
          x={KEYBOARD_WIDTH + 4}
          y={PAD_Y + WHITE_HEIGHT / 2 + 4}
          fontSize={12}
          textAnchor="start"
          fill={primary}
          style={{ fontFamily: 'sans-serif', fontWeight: 'bold' }}
        >
          +
        </text>
      )}
    </svg>
  );
}
