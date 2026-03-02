import {
  type Accidental,
  type BarLineType,
  Duration,
  DurationModifier,
  type Decoration,
  Music,
  Note,
  KEYS,
} from '../music';
import { PITCH_CONSTANTS } from '../constants';

// https://abcnotation.com/wiki/abc:standard:v2.1

const BAR_TYPE_TO_ABC: { [key in BarLineType]: string } = {
  standard: '|',
  double: '||',
  begin: '[|',
  end: '|]',
  begin_repeat: '|:',
  end_repeat: ':|',
  begin_end_repeat: '::',
};

// Pitch class (0-11) to ABC note letter (assuming no accidental)
const PITCH_CLASS_TO_NOTE: { [key: number]: string } = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B',
};

function singlePitchToAbc(
  midiPitch: number,
  accidental: Accidental,
  keyAdjustment: { [n: string]: number }
): string {
  const octave = Math.floor(
    (midiPitch - PITCH_CONSTANTS.OCTAVE_OFFSET) /
      PITCH_CONSTANTS.SEMITONES_PER_OCTAVE
  );
  const pitchClass =
    (midiPitch - PITCH_CONSTANTS.OCTAVE_OFFSET) %
    PITCH_CONSTANTS.SEMITONES_PER_OCTAVE;

  let accidentalPrefix = '';
  let letter: string;

  if (accidental === '#') {
    const basePitchClass = pitchClass - 1;
    letter = PITCH_CLASS_TO_NOTE[basePitchClass] ?? 'C';
    accidentalPrefix = '^';
  } else if (accidental === 'b') {
    const basePitchClass = (pitchClass + 1) % 12;
    letter = PITCH_CLASS_TO_NOTE[basePitchClass] ?? 'C';
    accidentalPrefix = '_';
  } else if (accidental === 'n') {
    letter = PITCH_CLASS_TO_NOTE[pitchClass] ?? 'C';
    accidentalPrefix = '=';
  } else {
    letter = PITCH_CLASS_TO_NOTE[pitchClass] ?? 'C';
    // key adjustment already accounts for in-key notes — no prefix needed
    void (keyAdjustment[letter] ?? 0);
  }

  // Octave encoding:
  // octave 3 = uppercase, octave 4 = lowercase
  // octave 2 = uppercase + comma, etc.
  // octave 5 = lowercase + ', etc.
  let abcNote: string;
  if (octave <= 3) {
    abcNote = accidentalPrefix + letter.toUpperCase();
    abcNote += ','.repeat(3 - octave);
  } else {
    abcNote = accidentalPrefix + letter.toLowerCase();
    abcNote += "'".repeat(octave - 4);
  }

  return abcNote;
}

function noteToAbcPitch(
  note: Note,
  keyAdjustment: { [n: string]: number }
): string {
  if (note.pitches.length === 0) return 'z';
  if (note.pitches.length === 1) {
    return singlePitchToAbc(
      note.pitches[0],
      note.accidentals[0],
      keyAdjustment
    );
  }
  // Chord: wrap in [...]
  const inner = note.pitches
    .map((p, i) => singlePitchToAbc(p, note.accidentals[i], keyAdjustment))
    .join('');
  return `[${inner}]`;
}

function durationToAbc(duration: Duration, modifier: DurationModifier): string {
  // L:1/8 is the default note length, so EIGHTH = '' (omit)
  // All durations expressed relative to EIGHTH
  if (modifier === DurationModifier.DOTTED) {
    switch (duration) {
      case Duration.WHOLE:
        return '12'; // 8 * 1.5 = 12
      case Duration.HALF:
        return '6';
      case Duration.QUARTER:
        return '3';
      case Duration.EIGHTH:
        return '3/2';
      case Duration.SIXTEENTH:
        return '3/4';
      default:
        return '';
    }
  } else {
    switch (duration) {
      case Duration.WHOLE:
        return '8';
      case Duration.HALF:
        return '4';
      case Duration.QUARTER:
        return '2';
      case Duration.EIGHTH:
        return '';
      case Duration.SIXTEENTH:
        return '/2';
      default:
        return '';
    }
  }
}

function decorationToAbc(decoration: Decoration): string {
  const map: { [key in Decoration]: string } = {
    accent: '!accent!',
    breath: '!breath!',
    fermata: '!fermata!',
    staccato: '.',
    tenuto: '!tenuto!',
    trill: '!trill!',
    pppp: '!pppp!',
    ppp: '!ppp!',
    pp: '!pp!',
    p: '!p!',
    mp: '!mp!',
    mf: '!mf!',
    f: '!f!',
    ff: '!ff!',
    fff: '!fff!',
    ffff: '!ffff!',
  };
  return map[decoration] ?? '';
}

export function toAbc(music: Music): string {
  const lines: string[] = [];

  if (music.title) lines.push(`T:${music.title}`);
  if (music.composer) lines.push(`C:${music.composer}`);
  lines.push(`M:${music.beatsPerBar}/${music.beatValue}`);
  lines.push('L:1/8');
  lines.push(
    music.clef !== 'treble'
      ? `K:${music.keySignature} clef=${music.clef}`
      : `K:${music.keySignature}`
  );

  // Build key adjustment map for export (to know which notes are in-key)
  const keyAdjustment: { [n: string]: number } = {};
  for (const note of KEYS[music.keySignature] ?? []) {
    keyAdjustment[note[0]] = note[1] === '#' ? 1 : -1;
  }

  // Build a sorted list of bar positions keyed by afterNoteNum
  const barAfter: Map<number, BarLineType> = new Map();
  for (const bar of music.bars) {
    if (bar.afterNoteNum !== undefined) {
      barAfter.set(bar.afterNoteNum, bar.type);
    }
  }

  // Build beam groups: set of note indices that are in a beam group
  // We track beam groups to know when to omit spaces
  const beamGroupOf: Map<number, number> = new Map(); // noteIx -> beamGroupId
  for (const [groupId, [beamStart, beamEnd]] of music.beams.entries()) {
    for (let i = beamStart; i <= beamEnd; i++) {
      beamGroupOf.set(i, groupId);
    }
  }

  // Build curve groups: set of slur start/end pairs
  const slurStartAt = new Set(music.curves.map(([s]) => s));
  const slurEndAt = new Set(music.curves.map(([, e]) => e));

  const noteParts: string[] = [];
  for (let noteIx = 0; noteIx < music.notes.length; noteIx++) {
    const note = music.notes[noteIx];
    let part = '';

    // Slur open
    if (slurStartAt.has(noteIx)) part += '(';

    // Decorations
    for (const decoration of note.decorations) {
      part += decorationToAbc(decoration);
    }

    // Pitch
    part += noteToAbcPitch(note, keyAdjustment);

    // Duration
    part += durationToAbc(note.duration, note.durationModifier);

    // Slur close
    if (slurEndAt.has(noteIx)) part += ')';

    noteParts.push(part);
  }

  // Now assemble with beams (no space between beam group members) and bar lines
  const scoreTokens: string[] = [];
  for (let noteIx = 0; noteIx < noteParts.length; noteIx++) {
    const groupId = beamGroupOf.get(noteIx);
    const prevGroupId = noteIx > 0 ? beamGroupOf.get(noteIx - 1) : undefined;

    // Add space before note unless it's in the same beam group as the previous note
    if (noteIx > 0 && groupId !== prevGroupId) {
      scoreTokens.push(' ');
    } else if (noteIx > 0 && groupId === undefined) {
      scoreTokens.push(' ');
    }

    scoreTokens.push(noteParts[noteIx]);

    // Bar line after this note
    const barType = barAfter.get(noteIx);
    if (barType !== undefined) {
      scoreTokens.push(' ' + BAR_TYPE_TO_ABC[barType]);
    }
  }

  lines.push(scoreTokens.join(''));

  return lines.join('\n');
}
