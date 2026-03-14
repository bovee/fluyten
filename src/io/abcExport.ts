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
import { voicesFromAbc } from './abcImport';

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

export function singlePitchToAbc(
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
    const naturalLetter = PITCH_CLASS_TO_NOTE[pitchClass];
    if (naturalLetter !== undefined) {
      // Natural note — key adjustment already accounts for in-key sharps/flats
      letter = naturalLetter;
    } else {
      // Non-natural pitch class: check if it's an in-key accidental
      const sharpLetter = PITCH_CLASS_TO_NOTE[pitchClass - 1];
      const flatLetter = PITCH_CLASS_TO_NOTE[(pitchClass + 1) % 12];
      if (sharpLetter && keyAdjustment[sharpLetter] === 1) {
        // In-key sharp — write without prefix (key signature covers it)
        letter = sharpLetter;
      } else if (flatLetter && keyAdjustment[flatLetter] === -1) {
        // In-key flat — write without prefix
        letter = flatLetter;
      } else {
        // Not in key — write as explicit sharp
        letter = sharpLetter ?? flatLetter ?? 'C';
        accidentalPrefix = '^';
      }
    }
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

// Duration expressed as sixteenths of a whole note
const NOTE_SIXTEENTHS: Partial<Record<Duration, number>> = {
  [Duration.WHOLE]: 16,
  [Duration.HALF]: 8,
  [Duration.QUARTER]: 4,
  [Duration.EIGHTH]: 2,
  [Duration.SIXTEENTH]: 1,
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function durationToAbc(
  duration: Duration,
  modifier: DurationModifier,
  defaultDuration: Duration
): string {
  const defaultSixteenths = NOTE_SIXTEENTHS[defaultDuration];
  const noteSixteenths = NOTE_SIXTEENTHS[duration];
  if (defaultSixteenths === undefined || noteSixteenths === undefined) return '';

  // dotted = multiply by 3/2
  const num = modifier === DurationModifier.DOTTED ? noteSixteenths * 3 : noteSixteenths * 2;
  const den = modifier === DurationModifier.DOTTED ? defaultSixteenths * 2 : defaultSixteenths * 2;
  const g = gcd(num, den);
  const rNum = num / g;
  const rDen = den / g;

  if (rNum === 1 && rDen === 1) return '';
  if (rDen === 1) return String(rNum);
  if (rNum === 1) return '/' + String(rDen);
  return rNum + '/' + rDen;
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

function buildKeyAdjustment(keySignature: string): { [n: string]: number } {
  const keyAdjustment: { [n: string]: number } = {};
  for (const note of KEYS[keySignature] ?? []) {
    keyAdjustment[note[0]] = note[1] === '#' ? 1 : -1;
  }
  return keyAdjustment;
}

function scoreToAbc(
  music: Music,
  keyAdjustment: { [n: string]: number },
  defaultDuration: Duration = Duration.EIGHTH
): string {
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
    part += durationToAbc(note.duration, note.durationModifier, defaultDuration);

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

  return scoreTokens.join('');
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

  lines.push(scoreToAbc(music, buildKeyAdjustment(music.keySignature)));

  return lines.join('\n');
}

/**
 * Export just the score (notes, bar lines, beams) of a Music object to ABC
 * text, without any header lines. Useful for round-tripping a fragment.
 */
export function notesToAbc(
  music: Music,
  keySignature: string,
  defaultDuration: Duration = Duration.EIGHTH
): string {
  return scoreToAbc(music, buildKeyAdjustment(keySignature), defaultDuration);
}

/**
 * Parse an ABC tune, reflow bar lines for all voices, and re-export as ABC.
 * Notes that cross bar boundaries are split into tied pairs; consecutive
 * same-pitch tied notes that combine into a standard duration are merged back.
 */
export function reflowAbc(abc: string): string {
  const voices = voicesFromAbc(abc);

  // Single voice: full round-trip via toAbc (preserves all headers).
  if (voices.length === 1) {
    voices[0].music.reflow();
    return toAbc(voices[0].music);
  }

  // Multi-voice: reflow each voice, then reconstruct with V: separators.
  for (const v of voices) v.music.reflow();

  // Extract global header lines (everything before the first score line).
  const lines = abc.split(/\r?\n/);
  const globalHeaders: string[] = [];
  for (const line of lines) {
    const isScoreLine =
      line.trim() !== '' &&
      !(line.length >= 2 && line[1] === ':') &&
      !line.startsWith('%%');
    if (isScoreLine) break;
    globalHeaders.push(line);
  }

  const parts: string[] = [...globalHeaders];
  for (const v of voices) {
    parts.push(`V:${v.id}`);
    parts.push(notesToAbc(v.music, v.music.keySignature));
  }
  return parts.join('\n');
}
