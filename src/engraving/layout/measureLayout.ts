import { Duration, type Note } from '../../music';
import {
  GRACE_NOTE_SPACING,
  MIN_NOTE_SPACING,
  type BarData,
  type BeamLayout,
  type GraceNoteLayout,
  type NoteLayout,
} from './types';

const ACCIDENTAL_EXTRA_SPACING = 15; // extra px reserved when a note has an accidental
import {
  pitchToStaffPosition,
  restStaffPosition,
  staffPositionToY,
  stemDirection,
  stemEndpoints,
  type Clef,
} from './pitchLayout';

interface BarBounds {
  noteAreaX: number;
  noteAreaWidth: number;
  staffTopY: number;
}

/**
 * Lay out all notes within a single bar, returning absolute SVG positions.
 *
 * Grace notes are attached to the following main note and positioned immediately
 * to its left. They consume no time and don't affect proportional spacing.
 */
export function layoutBar(
  bar: BarData,
  notes: Note[],
  bounds: BarBounds,
  clef: Clef,
  displayPitchOffset: number,
  lyrics: (string | undefined)[][]
): NoteLayout[] {
  const { noteAreaX, noteAreaWidth, staffTopY } = bounds;

  // Separate note indices into main notes and grace note groups.
  // Each mainGroup is { graceIndices, mainIndex }.
  const mainGroups = groupNotesWithGraces(bar.noteIndices, notes);

  if (mainGroups.length === 0) return [];

  // Compute proportional x positions for main notes.
  const totalTicks = mainGroups.reduce(
    (sum, g) => sum + notes[g.mainIndex].ticks(),
    0
  );

  const layouts: NoteLayout[] = [];
  let accTicks = 0;

  for (const group of mainGroups) {
    const note = notes[group.mainIndex];
    const ticks = note.ticks();

    // Proportional x: note at the start of its time slice.
    let x =
      noteAreaX +
      (totalTicks > 0 ? (accTicks / totalTicks) * noteAreaWidth : 0);

    // Reserve space for grace notes to the left.
    const graceCount = group.graceIndices.length;
    if (graceCount > 0) {
      x += graceCount * GRACE_NOTE_SPACING;
    }

    // Enforce minimum spacing from the previous main note.
    // Notes with accidentals need extra room to the left.
    const hasAccidental = note.accidentals.some((a) => a);
    const minSpacing =
      MIN_NOTE_SPACING + (hasAccidental ? ACCIDENTAL_EXTRA_SPACING : 0);
    if (layouts.length > 0) {
      const prevX = layouts[layouts.length - 1].x;
      if (x - prevX < minSpacing) {
        x = prevX + minSpacing;
      }
    }

    const isRest = note.pitches.length === 0;

    // Compute staff positions and Y coordinates.
    let staffPositions: number[];
    let noteY: number;

    if (isRest) {
      const restPos = restStaffPosition(note.duration);
      staffPositions = [restPos];
      noteY = staffPositionToY(restPos, staffTopY);
    } else {
      staffPositions = note.pitches.map((pitch, i) =>
        pitchToStaffPosition(
          pitch,
          note.accidentals[i],
          clef,
          displayPitchOffset
        )
      );
      // Reference Y: top notehead (stem down) or bottom notehead (stem up).
      const dir = stemDirection(staffPositions);
      noteY =
        dir === 'down'
          ? staffPositionToY(Math.max(...staffPositions), staffTopY)
          : staffPositionToY(Math.min(...staffPositions), staffTopY);
    }

    const dir = isRest ? 'up' : stemDirection(staffPositions);
    const { stemStartY, stemEndY } = isRest
      ? { stemStartY: noteY, stemEndY: noteY }
      : stemEndpoints(staffPositions, staffTopY, dir);

    // Lyrics for this note.
    const noteLyrics = lyrics.map((verse) => verse[group.mainIndex]);

    // Grace notes.
    const graceLayouts = layoutGraceNotes(
      group.graceIndices,
      notes,
      x,
      staffTopY,
      clef,
      displayPitchOffset
    );

    layouts.push({
      musicNoteIndex: group.mainIndex,
      x,
      y: noteY,
      staffPositions,
      stemDirection: dir,
      stemStartY,
      stemEndY,
      duration: note.duration,
      durationModifier: note.durationModifier,
      accidentals: note.accidentals,
      decorations: note.decorations,
      graceNotes: graceLayouts,
      lyrics: noteLyrics,
      isRest,
    });

    accTicks += ticks;
  }

  return layouts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NoteGroup {
  graceIndices: number[];
  mainIndex: number;
}

/** Group grace notes with the main note that follows them. */
function groupNotesWithGraces(
  noteIndices: number[],
  notes: Note[]
): NoteGroup[] {
  const groups: NoteGroup[] = [];
  let pendingGrace: number[] = [];

  for (const idx of noteIndices) {
    const note = notes[idx];
    if (
      note.duration === Duration.GRACE ||
      note.duration === Duration.GRACE_SLASH
    ) {
      pendingGrace.push(idx);
    } else {
      groups.push({ graceIndices: pendingGrace, mainIndex: idx });
      pendingGrace = [];
    }
  }

  // Grace notes at the very end of a bar (unusual but possible): attach as a
  // group with a synthetic "no main note" entry that we discard below.
  // For now we just drop trailing grace notes.

  return groups;
}

function layoutGraceNotes(
  graceIndices: number[],
  notes: Note[],
  parentX: number,
  staffTopY: number,
  clef: Clef,
  displayPitchOffset: number
): GraceNoteLayout[] {
  if (graceIndices.length === 0) return [];

  return graceIndices.map((idx, k) => {
    const note = notes[idx];
    // Position grace notes to the left of the parent, closest first.
    const x = parentX - (graceIndices.length - k) * GRACE_NOTE_SPACING;

    const staffPositions = note.pitches.map((pitch, i) =>
      pitchToStaffPosition(pitch, note.accidentals[i], clef, displayPitchOffset)
    );
    const sp = staffPositions[0] ?? 0;
    const y = staffPositionToY(sp, staffTopY);

    return {
      musicNoteIndex: idx,
      x,
      y,
      staffPositions,
      isSlash: note.duration === Duration.GRACE_SLASH,
      accidentals: note.accidentals,
    };
  });
}

/** Compute beam groups for notes within a single bar, using music.beams. */
export function computeBarBeams(
  barNoteLayouts: NoteLayout[],
  _barNoteIndices: number[],
  musicBeams: number[][]
): import('./types').BeamLayout[] {
  // Build a map from musicNoteIndex → position in barNoteLayouts
  const musicIdxToLayoutIdx = new Map<number, number>();
  for (const [layoutIdx, nl] of barNoteLayouts.entries()) {
    musicIdxToLayoutIdx.set(nl.musicNoteIndex, layoutIdx);
  }

  const beamLayouts: import('./types').BeamLayout[] = [];

  for (const [beamStart, beamEnd] of musicBeams) {
    const startLayoutIdx = musicIdxToLayoutIdx.get(beamStart);
    const endLayoutIdx = musicIdxToLayoutIdx.get(beamEnd);
    if (startLayoutIdx === undefined || endLayoutIdx === undefined) continue;
    // Both endpoints must be in this bar
    if (startLayoutIdx > endLayoutIdx) continue;

    const noteIndices: number[] = [];
    const stemEndYs: number[] = [];
    const stemXs: number[] = [];

    for (let li = startLayoutIdx; li <= endLayoutIdx; li++) {
      const nl = barNoteLayouts[li];
      if (!nl) continue;
      noteIndices.push(li);
      stemEndYs.push(nl.stemEndY);
      stemXs.push(nl.x);
    }

    if (noteIndices.length >= 2) {
      beamLayouts.push({ noteIndices, stemEndYs, stemXs });
    }
  }

  return beamLayouts;
}

/**
 * Unify stem direction for all notes within each beam group.
 *
 * Each beam's direction is decided by the average staff position of all notes
 * in the group (same rule as per-note, but applied to the whole group). The
 * stem endpoints are then recomputed so every note in the group has the same
 * direction and the stems reach the same consistent length.
 *
 * Returns a new NoteLayout array; the original is not mutated.
 */
export function unifyBeamStems(
  notes: NoteLayout[],
  beams: BeamLayout[],
  staffTopY: number
): NoteLayout[] {
  const result = notes.slice();

  for (const beam of beams) {
    // Collect all staff positions across the group
    const allPositions = beam.noteIndices.flatMap(
      (li) => result[li]?.staffPositions ?? []
    );
    if (allPositions.length === 0) continue;

    const avg = allPositions.reduce((s, p) => s + p, 0) / allPositions.length;
    const dir: 'up' | 'down' = avg > 0 ? 'down' : 'up';

    for (const li of beam.noteIndices) {
      const nl = result[li];
      if (!nl) continue;
      const { stemStartY, stemEndY } = stemEndpoints(
        nl.staffPositions,
        staffTopY,
        dir
      );
      // Also update the reference notehead Y to match the unified direction:
      // stem up → bottom notehead (min staff pos → max Y); stem down → top notehead (max staff pos → min Y)
      const noteY =
        dir === 'up'
          ? staffPositionToY(Math.min(...nl.staffPositions), staffTopY)
          : staffPositionToY(Math.max(...nl.staffPositions), staffTopY);
      result[li] = {
        ...nl,
        stemDirection: dir,
        stemStartY,
        stemEndY,
        y: noteY,
      };
    }
  }

  return result;
}
