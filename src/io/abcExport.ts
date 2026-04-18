import type { Music, Note } from '../music';
import {
  type Accidental,
  type BarLine,
  type BarLineType,
  type Decoration,
  type SpanDecorationType,
  Duration,
  KEYS,
  FIFTHS_TO_ACCIDENTALS,
  signatureAt,
} from '../music';

function defaultTupletWrittenExport(
  actual: number,
  isCompound: boolean
): number {
  if (actual === 2) return 3;
  if (actual === 3) return 2;
  if (actual === 4) return 3;
  if (actual === 6) return 2;
  if (actual === 8) return 3;
  return isCompound ? 3 : 2;
}

const DURATION_TO_L: Partial<Record<Duration, string>> = {
  [Duration.WHOLE]: '1/1',
  [Duration.HALF]: '1/2',
  [Duration.QUARTER]: '1/4',
  [Duration.EIGHTH]: '1/8',
  [Duration.SIXTEENTH]: '1/16',
  [Duration.THIRTY_SECOND]: '1/32',
};
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
  // For microtonal accidentals the stored pitch is fractional (e.g. 60.5 for
  // C half-sharp). Derive the integer base pitch by reversing the cent offset,
  // then use that for octave and pitch-class arithmetic.
  const microtonalOffset =
    accidental === 'd#'
      ? 0.5
      : accidental === '3d#'
        ? 1.5
        : accidental === 'db'
          ? -0.5
          : accidental === '3db'
            ? -1.5
            : 0;
  const basePitch = Math.round(midiPitch - microtonalOffset);

  const octave = Math.floor(
    (basePitch - PITCH_CONSTANTS.OCTAVE_OFFSET) /
      PITCH_CONSTANTS.SEMITONES_PER_OCTAVE
  );
  const pitchClass =
    (basePitch - PITCH_CONSTANTS.OCTAVE_OFFSET) %
    PITCH_CONSTANTS.SEMITONES_PER_OCTAVE;

  let accidentalPrefix = '';
  let letter: string;

  if (accidental === '##') {
    const basePitchClass = (pitchClass - 2 + 12) % 12;
    letter = PITCH_CLASS_TO_NOTE[basePitchClass] ?? 'C';
    accidentalPrefix = '^^';
  } else if (accidental === '#') {
    const basePitchClass = pitchClass - 1;
    letter = PITCH_CLASS_TO_NOTE[basePitchClass] ?? 'C';
    accidentalPrefix = '^';
  } else if (accidental === 'bb') {
    const basePitchClass = (pitchClass + 2) % 12;
    letter = PITCH_CLASS_TO_NOTE[basePitchClass] ?? 'C';
    accidentalPrefix = '__';
  } else if (accidental === 'b') {
    const basePitchClass = (pitchClass + 1) % 12;
    letter = PITCH_CLASS_TO_NOTE[basePitchClass] ?? 'C';
    accidentalPrefix = '_';
  } else if (accidental === 'n') {
    letter = PITCH_CLASS_TO_NOTE[pitchClass] ?? 'C';
    accidentalPrefix = '=';
  } else if (accidental === 'd#') {
    letter = PITCH_CLASS_TO_NOTE[pitchClass] ?? 'C';
    accidentalPrefix = '^/';
  } else if (accidental === '3d#') {
    letter = PITCH_CLASS_TO_NOTE[pitchClass] ?? 'C';
    accidentalPrefix = '^3/';
  } else if (accidental === 'db') {
    letter = PITCH_CLASS_TO_NOTE[pitchClass] ?? 'C';
    accidentalPrefix = '_/';
  } else if (accidental === '3db') {
    letter = PITCH_CLASS_TO_NOTE[pitchClass] ?? 'C';
    accidentalPrefix = '_3/';
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

// Duration expressed as thirty-seconds of a whole note (must match DURATION_SIXTEENTHS
// in abcImport.ts so that exported duration ratios round-trip correctly).
const NOTE_SIXTEENTHS: Partial<Record<Duration, number>> = {
  [Duration.WHOLE]: 32,
  [Duration.HALF]: 16,
  [Duration.QUARTER]: 8,
  [Duration.EIGHTH]: 4,
  [Duration.SIXTEENTH]: 2,
  [Duration.THIRTY_SECOND]: 1,
};

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function durationToAbc(
  duration: Duration,
  dots: number,
  defaultDuration: Duration
): string {
  const defaultSixteenths = NOTE_SIXTEENTHS[defaultDuration];
  const noteSixteenths = NOTE_SIXTEENTHS[duration];
  if (defaultSixteenths === undefined || noteSixteenths === undefined)
    return '';

  // Multiply note sixteenths by 2^dots / (2^dots - 1) * 2 to get the numerator.
  // Simplest: use sixteenths directly. 1 dot: multiply by 3/2; 2 dots: by 7/4.
  const dotMult = dots === 1 ? [3, 2] : dots === 2 ? [7, 4] : [1, 1];
  const num = noteSixteenths * dotMult[0] * 2;
  const den = defaultSixteenths * dotMult[1] * 2;
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
    lowermordent: '!lowermordent!',
    uppermordent: '!uppermordent!',
    upbow: '!upbow!',
    downbow: '!downbow!',
    staccato: '.',
    tenuto: '!tenuto!',
    trill: '!trill!',
    roll: '!roll!',
    coda: '!coda!',
    segno: '!segno!',
    fine: '!fine!',
    alcoda: '!alcoda!',
    'd.c.': '!D.C.!',
    'd.c.alfine': '!D.C.alfine!',
    'd.c.alcoda': '!D.C.alcoda!',
    'd.s.': '!D.S.!',
    'd.s.alfine': '!D.S.alfine!',
    'd.s.alcoda': '!D.S.alcoda!',
    turn: '!turn!',
    turnx: '!turnx!',
    invertedturn: '!invertedturn!',
    invertedturnx: '!invertedturnx!',
    slide: '!slide!',
    snap: '!snap!',
    lhpizz: '!+!',
    open: '!open!',
    tremolo1: '!/!',
    tremolo2: '!//!',
    tremolo3: '!///!',
    tremolo4: '!////!',
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
  for (const note of FIFTHS_TO_ACCIDENTALS[KEYS[keySignature] ?? 0] ?? []) {
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
  const barAfter: Map<number, BarLine> = new Map();
  for (const bar of music.bars) {
    if (bar.afterNoteNum !== undefined) {
      barAfter.set(bar.afterNoteNum, bar);
    }
  }

  // Build a map from note index to the signature that starts there (index > 0 only,
  // since index 0 is emitted as a header field).
  const sigAtNote: Map<number, (typeof music.signatures)[number]> = new Map();
  for (const sig of music.signatures.slice(1)) {
    sigAtNote.set(sig.atNoteIndex, sig);
  }

  // Build beam groups: set of note indices that are in a beam group
  // We track beam groups to know when to omit spaces
  const beamGroupOf: Map<number, number> = new Map(); // noteIx -> beamGroupId
  for (const [groupId, [beamStart, beamEnd]] of music.beams.entries()) {
    for (let i = beamStart; i <= beamEnd; i++) {
      beamGroupOf.set(i, groupId);
    }
  }

  // Build span decoration start/end lookup maps
  const SPAN_OPEN_MARKER: Record<SpanDecorationType, string> = {
    trill: '!trill(!',
    crescendo: '!crescendo(!',
    diminuendo: '!diminuendo(!',
  };
  const SPAN_CLOSE_MARKER: Record<SpanDecorationType, string> = {
    trill: '!trill)!',
    crescendo: '!crescendo)!',
    diminuendo: '!diminuendo)!',
  };
  const spanStartAt = new Map<number, SpanDecorationType[]>();
  const spanEndAt = new Map<number, SpanDecorationType[]>();
  for (const span of music.spanDecorations) {
    if (!spanStartAt.has(span.startNoteIndex))
      spanStartAt.set(span.startNoteIndex, []);
    spanStartAt.get(span.startNoteIndex)!.push(span.type);
    if (!spanEndAt.has(span.endNoteIndex)) spanEndAt.set(span.endNoteIndex, []);
    spanEndAt.get(span.endNoteIndex)!.push(span.type);
  }

  // Build curve groups: ties use `-` notation, slurs use `(...)`
  const tieAfterAt = new Set<number>();
  const slurStartAt = new Set<number>();
  const slurEndAt = new Set<number>();

  for (const [start, end] of music.curves) {
    const sNote = music.notes[start];
    const eNote = music.notes[end];
    const samePitch =
      sNote &&
      eNote &&
      sNote.pitches.length === eNote.pitches.length &&
      sNote.pitches.every((p, i) => p === eNote.pitches[i]);
    if (samePitch) {
      // Tie: add `-` after each note from start up to (not including) end
      for (let i = start; i < end; i++) tieAfterAt.add(i);
    } else {
      slurStartAt.add(start);
      slurEndAt.add(end);
    }
  }

  // Track current key adjustment and default duration so we can update them
  // when a mid-tune signature change is encountered.
  const curKeyAdjustment = { ...keyAdjustment };
  let curDefaultDuration = defaultDuration;

  const noteParts: string[] = [];
  for (let noteIx = 0; noteIx < music.notes.length; noteIx++) {
    const note = music.notes[noteIx];
    let part = '';

    // Inline field before this note if a new signature begins here.
    const sig = sigAtNote.get(noteIx);
    if (sig) {
      const prev = music.signatures
        .slice()
        .reverse()
        .find((s) => s.atNoteIndex < noteIx);
      if (
        sig.beatsPerBar !== prev?.beatsPerBar ||
        sig.beatValue !== prev?.beatValue
      ) {
        const mStr = sig.commonTime
          ? sig.beatValue === 2
            ? 'C|'
            : 'C'
          : `${sig.beatsPerBar}/${sig.beatValue}`;
        part += `[M:${mStr}]`;
      }
      if (sig.keySignature !== prev?.keySignature) {
        part += `[K:${sig.keySignature}]`;
        // Update key adjustment for subsequent notes.
        for (const k of Object.keys(curKeyAdjustment))
          delete curKeyAdjustment[k];
        for (const acc of FIFTHS_TO_ACCIDENTALS[KEYS[sig.keySignature] ?? 0] ??
          []) {
          curKeyAdjustment[acc[0]] = acc[1] === '#' ? 1 : -1;
        }
      }
      if (sig.tempo !== prev?.tempo && sig.tempo !== undefined) {
        const label = sig.tempoText ? `"${sig.tempoText}" ` : '';
        part += `[Q:${label}1/4=${sig.tempo}]`;
      }
      if (
        sig.defaultDuration !== prev?.defaultDuration &&
        sig.defaultDuration !== undefined
      ) {
        part += `[L:${DURATION_TO_L[sig.defaultDuration] ?? '1/8'}]`;
        curDefaultDuration = sig.defaultDuration;
      }
    }

    // Slur open
    if (slurStartAt.has(noteIx)) part += '(';

    // Span decoration end markers (e.g. !crescendo)!) before this note
    for (const type of spanEndAt.get(noteIx) ?? [])
      part += SPAN_CLOSE_MARKER[type];

    // Span decoration start markers (e.g. !crescendo(!) before this note
    for (const type of spanStartAt.get(noteIx) ?? [])
      part += SPAN_OPEN_MARKER[type];

    // Annotations
    const ANNOTATION_PREFIX: Record<string, string> = {
      above: '^',
      below: '_',
      left: '<',
      right: '>',
      auto: '@',
    };
    for (const ann of note.annotations) {
      part += `"${ANNOTATION_PREFIX[ann.placement]}${ann.text}"`;
    }

    // Tuplet prefix before first note of each group
    if (note.tuplet) {
      const prevNote = music.notes[noteIx - 1];
      const isFirstInGroup =
        !prevNote?.tuplet ||
        prevNote.tuplet.actual !== note.tuplet.actual ||
        prevNote.tuplet.written !== note.tuplet.written ||
        prevNote.tuplet.groupSize !== note.tuplet.groupSize;
      if (isFirstInGroup) {
        const { actual, written, groupSize } = note.tuplet;
        const sig = signatureAt(music, noteIx);
        const isCompound = sig.beatsPerBar % 3 === 0 && sig.beatsPerBar >= 6;
        const defaultWritten = defaultTupletWrittenExport(actual, isCompound);
        if (written === defaultWritten && groupSize === actual) {
          part += `(${actual}`;
        } else if (written === defaultWritten) {
          part += `(${actual}::${groupSize}`;
        } else if (groupSize === actual) {
          part += `(${actual}:${written}`;
        } else {
          part += `(${actual}:${written}:${groupSize}`;
        }
      }
    }

    // Decorations
    for (const decoration of note.decorations) {
      part += decorationToAbc(decoration);
    }

    // Pitch
    part += noteToAbcPitch(note, curKeyAdjustment);

    // Duration
    part += durationToAbc(note.duration, note.dots, curDefaultDuration);

    // Slur close (before tie, per ABC convention: `a)-`)
    if (slurEndAt.has(noteIx)) part += ')';

    // Tie
    if (tieAfterAt.has(noteIx)) part += '-';

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
    const bar = barAfter.get(noteIx);
    if (bar !== undefined) {
      let barStr = BAR_TYPE_TO_ABC[bar.type];
      if (bar.volta !== undefined) barStr += bar.volta;
      scoreTokens.push(' ' + barStr);
    }
  }

  return scoreTokens.join('');
}

function buildWLine(music: Music, verse: (string | undefined)[]): string {
  const tokens: string[] = [];
  for (let i = 0; i < music.notes.length; i++) {
    const note = music.notes[i];
    if (
      note.duration === Duration.GRACE ||
      note.duration === Duration.GRACE_SLASH
    ) {
      continue; // grace notes are skipped during alignment
    }
    tokens.push(verse[i] ?? '*');
  }

  // Trim trailing '*'s (no lyric at end of verse)
  while (tokens.length > 0 && tokens[tokens.length - 1] === '*') {
    tokens.pop();
  }
  if (tokens.length === 0) return '';

  // Join: no space before a token that follows a hyphen-ending syllable
  const parts: string[] = [tokens[0]];
  for (let i = 1; i < tokens.length; i++) {
    if (!tokens[i - 1].endsWith('-')) parts.push(' ');
    parts.push(tokens[i]);
  }
  return parts.join('');
}

export function toAbc(music: Music): string {
  const lines: string[] = [];

  if (music.title) lines.push(`T:${music.title}`);
  if (music.composer) lines.push(`C:${music.composer}`);
  const sig0 = music.signatures[0];
  const mStr0 = sig0.commonTime
    ? sig0.beatValue === 2
      ? 'C|'
      : 'C'
    : `${sig0.beatsPerBar}/${sig0.beatValue}`;
  lines.push(`M:${mStr0}`);
  if (sig0.tempo !== undefined) {
    const label = sig0.tempoText ? `"${sig0.tempoText}" ` : '';
    lines.push(`Q:${label}1/4=${sig0.tempo}`);
  }
  const defaultDuration = sig0.defaultDuration ?? Duration.EIGHTH;
  lines.push(`L:${DURATION_TO_L[defaultDuration] ?? '1/8'}`);
  const clefName =
    music.clef === 'treble8va'
      ? 'treble+8'
      : music.clef === 'bass8va'
        ? 'bass+8'
        : music.clef;
  lines.push(
    music.clef !== 'treble'
      ? `K:${sig0.keySignature} clef=${clefName}`
      : `K:${sig0.keySignature}`
  );

  lines.push(
    scoreToAbc(music, buildKeyAdjustment(sig0.keySignature), defaultDuration)
  );

  for (const verse of music.lyrics) {
    const wLine = buildWLine(music, verse);
    if (wLine) lines.push(`w:${wLine}`);
  }

  if (music.endLyrics) {
    for (const l of music.endLyrics.split('\n')) {
      lines.push(`W:${l}`);
    }
  }

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
    parts.push(notesToAbc(v.music, v.music.signatures[0].keySignature));
  }
  return parts.join('\n');
}
