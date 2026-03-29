import type { BeamLayout, NoteLayout } from '../layout/types';

interface BeamProps {
  beam: BeamLayout;
  notes: NoteLayout[];
  fill?: string;
}

const BEAM_THICKNESS = 5;
const BEAM_GAP = 3; // gap between multiple beams (for 16ths)

/**
 * Renders a beam group as one or two filled rectangles connecting note stems.
 * The beam is drawn as a slanted parallelogram between the first and last stem tips.
 */
export function Beam({ beam, notes, fill = 'black' }: BeamProps) {
  const { noteIndices, stemEndYs, stemXs } = beam;
  if (noteIndices.length < 2) return null;

  const x1 = stemXs[0];
  const x2 = stemXs[stemXs.length - 1];
  const y1 = stemEndYs[0];
  const y2 = stemEndYs[stemEndYs.length - 1];

  // Determine stem direction from first note
  const firstNote = notes[noteIndices[0]];
  const stemDir = firstNote?.stemDirection ?? 'up';

  // Check if any note needs a second beam (16th or shorter)
  const hasSecondBeam = noteIndices.some((ni) => {
    const n = notes[ni];
    return n?.duration === '16';
  });

  // Stem-up: beam extends downward from stem tips (+thickness).
  // Stem-down: beam extends upward from stem tips (-thickness).
  const t = stemDir === 'up' ? BEAM_THICKNESS : -BEAM_THICKNESS;
  const gap = stemDir === 'up' ? BEAM_THICKNESS + BEAM_GAP : -(BEAM_THICKNESS + BEAM_GAP);

  return (
    <g>
      <BeamSlant x1={x1} y1={y1} x2={x2} y2={y2} thickness={t} fill={fill} />
      {hasSecondBeam && (
        <BeamSlant
          x1={x1} y1={y1 + gap}
          x2={x2} y2={y2 + gap}
          thickness={t}
          fill={fill}
        />
      )}
    </g>
  );
}

interface BeamSlantProps {
  x1: number; y1: number;
  x2: number; y2: number;
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
