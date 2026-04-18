import type { BeamLayout, NoteLayout } from '../layout/types';
import type { Duration } from '../../music';

interface BeamProps {
  beam: BeamLayout;
  notes: NoteLayout[];
  fill?: string;
}

const BEAM_THICKNESS = 5;
const BEAM_GAP = 3; // gap between multiple beams (for 16ths)
const STUB_WIDTH = 10; // width of a partial beam stub for an isolated shorter note

/** Returns the number of beams required for a given duration (0 = no beams). */
function beamCount(duration: Duration): number {
  switch (duration) {
    case '8':
      return 1;
    case '16':
      return 2;
    case '32':
      return 3;
    default:
      return 0;
  }
}

/**
 * Interpolates Y along the slanted main beam line at a given X.
 * Used to position secondary beams at the correct slant even when they're stubs.
 */
function beamYAt(
  x: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  if (x2 === x1) return y1;
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

/**
 * Renders a beam group as filled rectangles connecting note stems.
 * The primary beam spans all notes. Secondary beams (for 16th notes etc.) are
 * drawn only between notes that share that beam level; an isolated shorter note
 * gets a stub extending toward its neighbour.
 */
export function Beam({ beam, notes, fill = 'currentColor' }: BeamProps) {
  const { noteIndices, stemEndYs, stemXs } = beam;
  if (noteIndices.length < 2) return null;

  const x1 = stemXs[0];
  const x2 = stemXs[stemXs.length - 1];
  const y1 = stemEndYs[0];
  const y2 = stemEndYs[stemEndYs.length - 1];

  // Determine stem direction from first note
  const firstNote = notes[noteIndices[0]];
  const stemDir = firstNote?.stemDirection ?? 'up';

  // Stem-up: beam extends downward from stem tips (+thickness).
  // Stem-down: beam extends upward from stem tips (-thickness).
  const t = stemDir === 'up' ? BEAM_THICKNESS : -BEAM_THICKNESS;
  const gap =
    stemDir === 'up' ? BEAM_THICKNESS + BEAM_GAP : -(BEAM_THICKNESS + BEAM_GAP);

  const maxLevel = Math.max(
    ...noteIndices.map((ni) => beamCount(notes[ni]?.duration ?? '8'))
  );

  // Build secondary-beam segments (level 2+).
  // For each extra beam level, walk the group and emit full spans between
  // consecutive qualifying notes, or a stub for an isolated qualifying note.
  const extraBeams: React.ReactNode[] = [];

  for (let level = 2; level <= maxLevel; level++) {
    const levelGap = (level - 1) * gap;
    // Collect positions (within the noteIndices array) that qualify.
    const qualifies = noteIndices.map(
      (ni) => beamCount(notes[ni]?.duration ?? '8') >= level
    );

    let pos = 0;
    while (pos < noteIndices.length) {
      if (!qualifies[pos]) {
        pos++;
        continue;
      }
      // Find the end of this consecutive run.
      let runEnd = pos;
      while (runEnd + 1 < noteIndices.length && qualifies[runEnd + 1]) {
        runEnd++;
      }

      if (runEnd > pos) {
        // Full beam spanning this run.
        const bx1 = stemXs[pos];
        const bx2 = stemXs[runEnd];
        const by1 = beamYAt(bx1, x1, y1, x2, y2) + levelGap;
        const by2 = beamYAt(bx2, x1, y1, x2, y2) + levelGap;
        extraBeams.push(
          <BeamSlant
            key={`beam-${level}-${pos}`}
            x1={bx1}
            y1={by1}
            x2={bx2}
            y2={by2}
            thickness={t}
            fill={fill}
          />
        );
      } else {
        // Isolated note — draw a stub toward its neighbour.
        const bx = stemXs[pos];
        // Prefer a left-extending stub if there is a previous note, else extend right.
        const stubX1 = pos > 0 ? bx - STUB_WIDTH : bx;
        const stubX2 = pos > 0 ? bx : bx + STUB_WIDTH;
        const stubY1 = beamYAt(stubX1, x1, y1, x2, y2) + levelGap;
        const stubY2 = beamYAt(stubX2, x1, y1, x2, y2) + levelGap;
        extraBeams.push(
          <BeamSlant
            key={`beam-${level}-${pos}`}
            x1={stubX1}
            y1={stubY1}
            x2={stubX2}
            y2={stubY2}
            thickness={t}
            fill={fill}
          />
        );
      }

      pos = runEnd + 1;
    }
  }

  return (
    <g>
      <BeamSlant x1={x1} y1={y1} x2={x2} y2={y2} thickness={t} fill={fill} />
      {extraBeams}
    </g>
  );
}

interface BeamSlantProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Positive = beam extends downward, negative = upward. */
  thickness: number;
  fill: string;
}

function BeamSlant({ x1, y1, x2, y2, thickness, fill }: BeamSlantProps) {
  const points = [
    `${x1},${y1}`,
    `${x2},${y2}`,
    `${x2},${y2 + thickness}`,
    `${x1},${y1 + thickness}`,
  ].join(' ');
  return <polygon points={points} fill={fill} />;
}
