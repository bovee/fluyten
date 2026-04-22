import { memo } from 'react';
import { type BarLayout, type PreambleBarLayout } from '../layout/types';
import { staffPositionToY } from '../layout/pitchLayout';
import { Glyph } from '../glyphs/Glyph';
import { NoteGroup } from './NoteGroup';
import { GraceNoteGroup } from './GraceNoteGroup';
import { Beam } from './Beam';
import { BarlineStart, BarlineEnd } from './Barline';

// Staff positions for key signature accidentals (treble clef, position 0 = middle line = B4)
// Sharps: F5, C5, G5, D5, A4, E5, B4 = staff positions +4, +1, +5, +2, -1, +3, 0
// Flats:  Bb4, Eb5, Ab4, Db5, Gb4, Cb5, Fb4 = 0, +3, -1, +2, -2, +1, -3
const SHARP_STAFF_POSITIONS_TREBLE = [4, 1, 5, 2, -1, 3, 0];
const FLAT_STAFF_POSITIONS_TREBLE = [0, 3, -1, 2, -2, 1, -3];
// Bass clef accidentals are shifted down by 2 staff positions
const SHARP_STAFF_POSITIONS_BASS = SHARP_STAFF_POSITIONS_TREBLE.map(
  (p) => p - 2
);
const FLAT_STAFF_POSITIONS_BASS = FLAT_STAFF_POSITIONS_TREBLE.map((p) => p - 2);

type Clef = 'treble' | 'treble8va' | 'bass' | 'bass8va' | 'alto';

interface BarProps {
  bar: BarLayout;
  staffTopY: number;
  /** Per-note fill color override. Index = musicNoteIndex. */
  noteFills?: Map<number, string>;
  /** Set of note indices that are wrong (renders red X). */
  wrongNotes?: ReadonlySet<number>;
  /** If the playback cursor is on a note in this bar, its musicNoteIndex. */
  cursorNoteIdx?: number;
  /** Color to use for the cursor note. */
  cursorColor?: string;
  onNoteClick?: (noteIdx: number, x: number, y: number) => void;
}

function clefGlyph(clef: Clef): string {
  if (clef === 'bass') return 'fClef';
  if (clef === 'bass8va') return 'fClef8va';
  if (clef === 'alto') return 'cClef';
  if (clef === 'treble8va') return 'gClef8va';
  return 'gClef';
}

function clefY(clef: Clef, staffTopY: number): number {
  // SMuFL anchor = text baseline = reference pitch line for each clef.
  // gClef: anchor on G4 = 2nd line from bottom = staff pos -2
  // fClef: anchor on F3 = 2nd line from top  = staff pos +2
  // cClef: anchor on center line             = staff pos 0
  if (clef === 'bass' || clef === 'bass8va')
    return staffPositionToY(2, staffTopY);
  if (clef === 'alto') return staffPositionToY(0, staffTopY);
  return staffPositionToY(-2, staffTopY); // treble and treble8va
}

function timeSigDigitGlyph(digit: number): string {
  return `timeSig${digit}`;
}

function buildTimeSigParts(
  timeSig: string
): { num: number; den: number } | null {
  const m = timeSig.match(/^(\d+)\/(\d+)$/);
  if (!m) return null;
  return { num: parseInt(m[1]), den: parseInt(m[2]) };
}

interface PreambleBarProps {
  item: PreambleBarLayout;
  staffTopY: number;
  clef: Clef;
}

export function PreambleBar({ item, staffTopY, clef }: PreambleBarProps) {
  const { x, preamble } = item;
  if (!preamble.showClef && !preamble.showTimeSig && !preamble.showKeySig)
    return null;

  const parts: React.ReactNode[] = [];

  // Clef
  if (preamble.showClef) {
    parts.push(
      <Glyph
        key="clef"
        name={clefGlyph(clef)}
        x={x + preamble.clefX}
        y={clefY(clef, staffTopY)}
      />
    );
  }

  // Key signature
  if (preamble.showKeySig && preamble.numKeyAccidentals > 0) {
    const isSharp = preamble.accidentalType === 'sharp';
    const staffPositions =
      clef === 'bass' || clef === 'bass8va'
        ? isSharp
          ? SHARP_STAFF_POSITIONS_BASS
          : FLAT_STAFF_POSITIONS_BASS
        : isSharp
          ? SHARP_STAFF_POSITIONS_TREBLE
          : FLAT_STAFF_POSITIONS_TREBLE;
    const glyphName = isSharp ? 'accidentalSharp' : 'accidentalFlat';

    for (let i = 0; i < preamble.numKeyAccidentals; i++) {
      const sp = staffPositions[i];
      const ky = staffPositionToY(sp, staffTopY);
      parts.push(
        <Glyph
          key={`ks${i}`}
          name={glyphName}
          x={x + preamble.keySigX + i * 10}
          y={ky}
        />
      );
    }
  }

  // Time signature
  if (preamble.showTimeSig) {
    const tx = x + preamble.timeSigX;
    if (preamble.timeSig === 'C') {
      parts.push(
        <Glyph
          key="tsCommon"
          name="timeSigCommon"
          x={tx}
          y={staffPositionToY(0, staffTopY)}
        />
      );
    } else if (preamble.timeSig === 'C|') {
      parts.push(
        <Glyph
          key="tsCut"
          name="timeSigCutCommon"
          x={tx}
          y={staffPositionToY(0, staffTopY)}
        />
      );
    } else {
      const ts = buildTimeSigParts(preamble.timeSig);
      if (ts) {
        parts.push(
          <Glyph
            key="tsNum"
            name={timeSigDigitGlyph(ts.num)}
            x={tx}
            y={staffPositionToY(2, staffTopY)}
          />,
          <Glyph
            key="tsDen"
            name={timeSigDigitGlyph(ts.den)}
            x={tx}
            y={staffPositionToY(-2, staffTopY)}
          />
        );
      }
    }
  }

  return <g>{parts}</g>;
}

const LYRIC_PX_PER_CHAR = 6;
const LYRIC_MIN_GAP = 4;

/**
 * Compute per-note per-verse x nudges so adjacent syllables don't overlap.
 * Notes stay fixed; only the text rendering shifts slightly left or right.
 * Returns nudges[noteIndex][verse].
 */
function computeLyricNudges(notes: BarLayout['notes']): number[][] {
  const numVerses =
    notes.length > 0 ? Math.max(...notes.map((n) => n.lyrics.length)) : 0;
  const nudges: number[][] = notes.map(() => Array(numVerses).fill(0));

  for (let v = 0; v < numVerses; v++) {
    // Simple left-to-right pass: push each syllable right if it overlaps the previous.
    let prevRight = -Infinity;
    const pendingRight: number[] = [];

    for (let i = 0; i < notes.length; i++) {
      const syl = notes[i].lyrics[v];
      if (!syl) {
        pendingRight.push(-Infinity);
        continue;
      }
      const halfW = (syl.length * LYRIC_PX_PER_CHAR) / 2;
      const noteX = notes[i].x;
      const desiredLeft = noteX - halfW;
      let nudge = 0;
      if (desiredLeft < prevRight + LYRIC_MIN_GAP) {
        nudge = prevRight + LYRIC_MIN_GAP - desiredLeft;
      }
      nudges[i][v] = nudge;
      prevRight = noteX + halfW + nudge;
      pendingRight.push(prevRight);
    }

    // Right-to-left pass: push syllables left if they overlap the next.
    let nextLeft = Infinity;
    for (let i = notes.length - 1; i >= 0; i--) {
      const syl = notes[i].lyrics[v];
      if (!syl) {
        nextLeft = Infinity;
        continue;
      }
      const halfW = (syl.length * LYRIC_PX_PER_CHAR) / 2;
      const noteX = notes[i].x;
      const currentRight = noteX + halfW + nudges[i][v];
      if (currentRight > nextLeft - LYRIC_MIN_GAP) {
        nudges[i][v] -= currentRight - (nextLeft - LYRIC_MIN_GAP);
      }
      nextLeft = noteX - halfW + nudges[i][v];
    }
  }

  return nudges;
}

// Set of note indices that are covered by a beam
function beamedNoteSet(bar: BarLayout): Set<number> {
  const beamed = new Set<number>();
  for (const beam of bar.beams) {
    for (const ni of beam.noteIndices) {
      beamed.add(ni);
    }
  }
  return beamed;
}

export const Bar = memo(function Bar({
  bar,
  staffTopY,
  noteFills,
  wrongNotes,
  cursorNoteIdx,
  cursorColor,
  onNoteClick,
}: BarProps) {
  const beamed = beamedNoteSet(bar);
  const lyricNudges = computeLyricNudges(bar.notes);

  // Collect breath mark positions: after the note they're marked on.
  // Last note in bar → over the barline at bar end.
  // Other notes → halfway between this note and the next note.
  const breathMarks: { x: number }[] = [];
  for (let i = 0; i < bar.notes.length; i++) {
    const note = bar.notes[i];
    if (note.decorations.includes('breath')) {
      const isLastInBar = i === bar.notes.length - 1;
      const bx = isLastInBar
        ? bar.x + bar.width
        : (note.x + bar.notes[i + 1].x) / 2;
      breathMarks.push({ x: bx });
    }
  }

  return (
    <g>
      <BarlineStart x={bar.x} staffTopY={staffTopY} type={bar.barlineStart} />

      {/* Barline at end of bar */}
      <BarlineEnd
        x={bar.x + bar.width}
        staffTopY={staffTopY}
        type={bar.barlineEnd}
      />

      {/* Breath marks */}
      {breathMarks.map((bm, i) => (
        <text
          key={`breath-${i}`}
          x={bm.x}
          y={staffTopY - 10}
          fontSize={32}
          fontWeight="bold"
          fontFamily="serif"
          textAnchor="middle"
          fill="currentColor"
        >
          ,
        </text>
      ))}

      {/* Notes, grace notes, beams */}
      {bar.notes.map((note, i) => {
        const fill =
          note.musicNoteIndex === cursorNoteIdx && cursorColor !== undefined
            ? cursorColor
            : (noteFills?.get(note.musicNoteIndex) ?? 'currentColor');
        return (
          <g key={note.musicNoteIndex}>
            {note.graceNotes.map((gn) => (
              <GraceNoteGroup
                key={gn.musicNoteIndex}
                graceNote={gn}
                staffTopY={staffTopY}
                fill={fill}
              />
            ))}
            <NoteGroup
              note={note}
              staffTopY={staffTopY}
              fill={fill}
              isBeamed={beamed.has(i)}
              isWrong={wrongNotes?.has(note.musicNoteIndex)}
              lyricNudges={lyricNudges[i]}
              onClick={onNoteClick}
            />
          </g>
        );
      })}

      {bar.beams.map((beam, i) => (
        <Beam key={i} beam={beam} notes={bar.notes} />
      ))}
    </g>
  );
});
