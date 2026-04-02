import { type BarLayout, type PreambleBarLayout } from '../layout/types';
import { staffPositionToY } from '../layout/pitchLayout';
import { Glyph } from '../glyphs/Glyph';
import { NoteGroup } from './NoteGroup';
import { GraceNoteGroup } from './GraceNoteGroup';
import { Beam } from './Beam';
import { BarlineStart, BarlineEnd } from './Barline';

// Staff positions for key signature accidentals (treble clef)
// Sharps: F5, C5, G5, D5, A4, E5, B4 = staff positions +5, +2, +6, +3, 0, +4, +1
// Flats:  Bb4, Eb5, Ab4, Db5, Gb4, Cb5, Fb4 = -1, +3, -2, +2, -3, +1, -4
const SHARP_STAFF_POSITIONS_TREBLE = [5, 2, 6, 3, 0, 4, 1];
const FLAT_STAFF_POSITIONS_TREBLE = [-1, 3, -2, 2, -3, 1, -4];
// Bass clef accidentals are shifted down by 2 staff positions
const SHARP_STAFF_POSITIONS_BASS = SHARP_STAFF_POSITIONS_TREBLE.map(
  (p) => p - 2
);
const FLAT_STAFF_POSITIONS_BASS = FLAT_STAFF_POSITIONS_TREBLE.map((p) => p - 2);

type Clef = 'treble' | 'treble8va' | 'bass' | 'bass8va' | 'alto';

interface BarProps {
  bar: BarLayout;
  staffTopY: number;
  clef: Clef;
  /** Per-note fill color override. Index = musicNoteIndex. */
  noteFills?: Map<number, string>;
  /** Set of note indices that are wrong (renders red X). */
  wrongNotes?: ReadonlySet<number>;
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

export function Bar({
  bar,
  staffTopY,
  noteFills,
  wrongNotes,
  onNoteClick,
}: BarProps) {
  const beamed = beamedNoteSet(bar);

  // Collect breath mark positions: before the note they're marked on.
  // First note in bar, bar not first on line → just left of the opening barline.
  // First note in bar, bar IS first on line → just left of the first note
  //   (the previous bar is on a different line so we can't put it there).
  // Other notes → halfway between the previous note and this one.
  const breathMarks: { x: number }[] = [];
  for (let i = 0; i < bar.notes.length; i++) {
    const note = bar.notes[i];
    if (note.decorations.includes('breath')) {
      let bx: number;
      if (i === 0) {
        if (bar.isFirstOnLine) continue; // rendered at end of previous line by Score
        bx = bar.x;
      } else {
        bx = (bar.notes[i - 1].x + note.x) / 2;
      }
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

      {/* Breath marks — rendered before the note they're attached to */}
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
        const fill = noteFills?.get(note.musicNoteIndex) ?? 'currentColor';
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
}
