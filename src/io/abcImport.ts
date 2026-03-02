import {
  type Accidental,
  type BarLineType,
  type Decoration,
  Duration,
  DurationModifier,
  KEYS,
  Music,
  Note,
} from '../music';
import { TIME_SIGNATURES } from '../constants';

// https://abcnotation.com/wiki/abc:standard:v2.1

export const BAR_MAPPINGS: { [key: string]: BarLineType } = {
  '|': 'standard' as BarLineType,
  '||': 'double' as BarLineType,
  '[|': 'begin' as BarLineType,
  '|]': 'end' as BarLineType,
  '|:': 'begin_repeat' as BarLineType,
  ':|': 'end_repeat' as BarLineType,
  '::': 'begin_end_repeat' as BarLineType,
};

// ---- Duration helpers -------------------------------------------------------

// Duration expressed as sixteenths of a whole note
const DURATION_SIXTEENTHS: Record<Duration, number> = {
  [Duration.WHOLE]: 16,
  [Duration.HALF]: 8,
  [Duration.QUARTER]: 4,
  [Duration.EIGHTH]: 2,
  [Duration.SIXTEENTH]: 1,
  [Duration.GRACE]: 0,
  [Duration.GRACE_SLASH]: 0,
};

// Maps sixteenth count → [Duration, DurationModifier]
const SIXTEENTHS_TO_DURATION = new Map<number, [Duration, DurationModifier]>([
  [1, [Duration.SIXTEENTH, DurationModifier.NONE]],
  [2, [Duration.EIGHTH, DurationModifier.NONE]],
  [3, [Duration.EIGHTH, DurationModifier.DOTTED]],
  [4, [Duration.QUARTER, DurationModifier.NONE]],
  [6, [Duration.QUARTER, DurationModifier.DOTTED]],
  [8, [Duration.HALF, DurationModifier.NONE]],
  [12, [Duration.HALF, DurationModifier.DOTTED]],
  [16, [Duration.WHOLE, DurationModifier.NONE]],
  [24, [Duration.WHOLE, DurationModifier.DOTTED]],
]);

function applyMultiplier(
  base: Duration,
  numer: number,
  denom: number
): [Duration, DurationModifier] {
  const sixteenths = (DURATION_SIXTEENTHS[base] * numer) / denom;
  const result = SIXTEENTHS_TO_DURATION.get(sixteenths);
  if (!result)
    throw new Error(`Invalid duration: ${numer}/${denom} of ${base}`);
  return result;
}

function parseLDuration(data: string): Duration {
  if (data === '1') return Duration.WHOLE;
  const parts = data.split('/').map((i) => parseInt(i, 10));
  if (parts.length !== 2) throw new Error(`Bad L: value in ABC: ${data}`);
  if (parts[0] !== 1)
    throw new Error(`L: value must have 1 as numerator in ABC: ${data}`);
  return (
    {
      16: Duration.SIXTEENTH,
      8: Duration.EIGHTH,
      4: Duration.QUARTER,
      2: Duration.HALF,
      1: Duration.WHOLE,
    }[parts[1]] || Duration.EIGHTH
  );
}

// ---- Tokenizer --------------------------------------------------------------

interface NoteGroups {
  text: string;
  decoration: string;
  accidental: string;
  note: string;
  duration: string;
}

type ScoreToken =
  | { type: 'note'; groups: NoteGroups }
  | { type: 'bar'; barType: BarLineType }
  | { type: 'grace_open' | 'grace_open_slash' | 'grace_close' }
  | { type: 'chord_open' | 'chord_close' }
  | { type: 'tuplet3' }
  | { type: 'slur_open' | 'slur_close' }
  | { type: 'tie' }
  | { type: 'beam_break' }
  | { type: 'beam_join' }
  | { type: 'broken_rhythm'; dir: '<' | '>' }
  | { type: 'inline_field' };

// Note sub-pattern (no ^ anchor; named groups survive the outer alternation
// because only one branch can match at a time)
const NOTE_PATTERN_SRC = [
  '(?<text>(?:"[^_<>@]?.*?"\\s?)*)',
  '(?<decoration>(?:[.~HLMOPSTuv]|![A-Za-z0-9()<>+.]+!\\s?)*)',
  '(?<accidental>[\\^=_]{0,2})',
  "(?<note>[A-Ga-gZXzx][,']*)",
  '(?<duration>\\d*(?:\\/\\/?)?\\d*)',
].join('');

// Master tokenizer regex (sticky: advances through the string without slicing).
// Alternatives are ordered longest-match-first within each group.
const TOKEN_RE = new RegExp(
  [
    NOTE_PATTERN_SRC,
    // bars — longest first so "|:" isn't consumed as "|" + ":"
    '::',
    '\\|\\|',
    '\\[\\|',
    '\\|\\]',
    '\\|:',
    ':\\|',
    '\\|',
    // grace notes
    '\\{/',
    '\\{',
    '\\}',
    // inline fields like [K:C] — consume "[X:" so the "[" isn't mistaken for chord
    '\\[[A-Z]:',
    // chord brackets
    '\\[',
    '\\]',
    // tuplets — "(3" before "(" so the digit isn't lost
    '\\(3',
    // slurs / ties / broken rhythm
    '\\(',
    '\\)',
    '-',
    '[<>]',
    // beam control
    '`',
    ' +',
  ].join('|'),
  'y' // sticky: matches only at TOKEN_RE.lastIndex
);

function tokenize(score: string): ScoreToken[] {
  const tokens: ScoreToken[] = [];
  TOKEN_RE.lastIndex = 0;

  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(score)) !== null) {
    const raw = m[0];
    const g = m.groups!;

    if (g.note !== undefined) {
      tokens.push({ type: 'note', groups: g as unknown as NoteGroups });
      continue;
    }

    if (raw in BAR_MAPPINGS) {
      tokens.push({ type: 'bar', barType: BAR_MAPPINGS[raw] });
    } else if (raw === '{/') {
      tokens.push({ type: 'grace_open_slash' });
    } else if (raw === '{') {
      tokens.push({ type: 'grace_open' });
    } else if (raw === '}') {
      tokens.push({ type: 'grace_close' });
    } else if (raw[0] === '[' && raw.length > 1) {
      // matched "[X:" inline field
      tokens.push({ type: 'inline_field' });
    } else if (raw === '[') {
      tokens.push({ type: 'chord_open' });
    } else if (raw === ']') {
      tokens.push({ type: 'chord_close' });
    } else if (raw === '(3') {
      tokens.push({ type: 'tuplet3' });
    } else if (raw === '(') {
      tokens.push({ type: 'slur_open' });
    } else if (raw === ')') {
      tokens.push({ type: 'slur_close' });
    } else if (raw === '-') {
      tokens.push({ type: 'tie' });
    } else if (raw === '<' || raw === '>') {
      tokens.push({ type: 'broken_rhythm', dir: raw as '<' | '>' });
    } else if (raw === '`') {
      tokens.push({ type: 'beam_join' });
    } else if (raw[0] === ' ') {
      tokens.push({ type: 'beam_break' });
    }
    // any unrecognised character is silently skipped
  }

  return tokens;
}

// ---- Score parser -----------------------------------------------------------

interface ChordAccum {
  pitches: number[];
  accidentals: Accidental[];
  duration: Duration;
  durationModifier: DurationModifier;
  decorations: Decoration[];
}

function parseScore(
  tokens: ScoreToken[],
  music: Music,
  defaultDuration: Duration,
  keyAdjustment: { [n: string]: number }
): void {
  let noteType: 'grace' | 'grace_slash' | 'triplet' | 'chord' | null = null;
  let tupletCounter = 0;
  let startSlur: number | null = null;
  let chordAccum: ChordAccum | null = null;

  // Beam tracking: a beam group is a run of note tokens uninterrupted by beam_break.
  // beam_join (backtick) bridges a gap without closing the group.
  let beamStart = 0;
  let inBeam = false;

  function closeBeam() {
    if (inBeam && music.notes.length > beamStart + 1) {
      for (let i = beamStart; i < music.notes.length; i++) {
        const { duration } = music.notes[i];
        if (duration !== Duration.EIGHTH && duration !== Duration.SIXTEENTH)
          throw new Error(`Note ${i} has too long a duration to be beamed.`);
      }
      music.beams.push([beamStart, music.notes.length - 1]);
    }
    inBeam = false;
  }

  for (const token of tokens) {
    // Any token other than a note or beam-join terminates the current beam group.
    if (token.type !== 'note' && token.type !== 'beam_join') closeBeam();

    switch (token.type) {
      case 'note': {
        const { groups } = token;
        const abcDuration = groups.duration;

        let noteDuration: Duration;
        let noteDurationModifier: DurationModifier = DurationModifier.NONE;

        if (abcDuration === '//') {
          [noteDuration, noteDurationModifier] = applyMultiplier(
            defaultDuration,
            1,
            4
          );
        } else if (abcDuration && !abcDuration.includes('/')) {
          [noteDuration, noteDurationModifier] = applyMultiplier(
            defaultDuration,
            parseInt(abcDuration, 10),
            1
          );
        } else if (abcDuration) {
          const parts = abcDuration.split('/');
          if (parts.length !== 2)
            throw new Error(`Invalid duration: ${abcDuration}`);
          const [numer, denom] = parts;
          [noteDuration, noteDurationModifier] = applyMultiplier(
            defaultDuration,
            parseInt(numer, 10) || 1,
            parseInt(denom, 10) || 2
          );
        } else if (noteType === 'grace') {
          noteDuration = Duration.GRACE;
        } else if (noteType === 'grace_slash') {
          noteDuration = Duration.GRACE_SLASH;
        } else {
          noteDuration = defaultDuration;
        }

        if (noteType === 'triplet') {
          noteDurationModifier = DurationModifier.TRIPLET;
          if (--tupletCounter === 0) noteType = null;
        }

        const note = Note.fromAbc(
          groups.note,
          noteDuration,
          noteDurationModifier,
          keyAdjustment,
          groups.accidental,
          groups.decoration
        );

        if (noteType === 'chord' && chordAccum) {
          if (chordAccum.pitches.length === 0) {
            // First note in chord: its duration and decorations apply to the whole chord.
            chordAccum.duration = note.duration;
            chordAccum.durationModifier = note.durationModifier;
            chordAccum.decorations = note.decorations;
          }
          chordAccum.pitches.push(...note.pitches);
          chordAccum.accidentals.push(...note.accidentals);
        } else {
          if (!inBeam) {
            beamStart = music.notes.length;
            inBeam = true;
          }
          music.notes.push(note);
        }
        break;
      }

      case 'bar':
        music.bars.push({
          afterNoteNum: music.notes.length - 1,
          type: token.barType,
        });
        break;

      case 'grace_open':
        if (noteType !== null)
          throw new Error(`Unexpected { after note ${music.notes.length}`);
        noteType = 'grace';
        break;

      case 'grace_open_slash':
        if (noteType !== null)
          throw new Error(`Unexpected { after note ${music.notes.length}`);
        noteType = 'grace_slash';
        break;

      case 'grace_close':
        if (noteType !== 'grace' && noteType !== 'grace_slash')
          throw new Error(`Unexpected } after note ${music.notes.length}`);
        noteType = null;
        break;

      case 'chord_open':
        if (noteType !== null)
          throw new Error(`Unexpected [ after note ${music.notes.length}`);
        noteType = 'chord';
        chordAccum = {
          pitches: [],
          accidentals: [],
          duration: defaultDuration,
          durationModifier: DurationModifier.NONE,
          decorations: [],
        };
        break;

      case 'chord_close':
        if (chordAccum) {
          const chordNote = new Note(
            chordAccum.pitches,
            chordAccum.duration,
            chordAccum.decorations,
            chordAccum.accidentals,
            chordAccum.durationModifier
          );
          if (!inBeam) {
            beamStart = music.notes.length;
            inBeam = true;
          }
          music.notes.push(chordNote);
          chordAccum = null;
        }
        noteType = null;
        break;

      case 'tuplet3':
        noteType = 'triplet';
        tupletCounter = 3;
        break;

      case 'slur_open':
        if (startSlur !== null)
          throw new Error(`Unexpected ( after note ${music.notes.length}`);
        startSlur = music.notes.length;
        break;

      case 'slur_close':
        if (startSlur === null)
          throw new Error(`Unexpected ) after note ${music.notes.length}`);
        music.curves.push([startSlur, music.notes.length - 1]);
        startSlur = null;
        break;

      case 'tie':
        music.curves.push([music.notes.length - 1, music.notes.length]);
        break;

      case 'broken_rhythm':
        // TODO: need to handle broken rhythm e.g. a>b
        throw new Error(
          `Unimplement. Could not parse < or > after note ${music.notes.length}`
        );

      case 'inline_field':
        throw new Error(
          'Unimplemented. Mid-score information fields not supported yet.'
        );

      case 'beam_break':
      case 'beam_join':
        break; // beam state already managed above the switch
    }
  }
}

// ---- Header parser ----------------------------------------------------------

interface HeaderParseResult {
  defaultDuration: Duration;
  keyAdjustment: { [n: string]: number };
  scoreText: string;
}

function parseHeaders(lines: string[], music: Music): HeaderParseResult {
  let defaultDuration: Duration = Duration.QUARTER;
  const keyAdjustment: { [n: string]: number } = {};
  const scoreLines: string[] = [];

  for (const line of lines) {
    if (line[1] === ':' && !line.startsWith('|:')) {
      const fieldData = line.slice(2).trim();
      if (!music.title && line.startsWith('T:')) music.title = fieldData;
      if (!music.composer && line.startsWith('C:')) music.composer = fieldData;
      if (line.startsWith('M:')) {
        if (fieldData === 'C') {
          music.beatsPerBar = TIME_SIGNATURES.COMMON_TIME.beatsPerBar;
          music.beatValue = TIME_SIGNATURES.COMMON_TIME.beatValue;
        } else if (fieldData === 'C|') {
          music.beatsPerBar = TIME_SIGNATURES.CUT_TIME.beatsPerBar;
          music.beatValue = TIME_SIGNATURES.CUT_TIME.beatValue;
        } else if (fieldData === '' || fieldData === 'none') {
          // Free time / no meter: leave beatsPerBar/beatValue at defaults,
          // bars will remain empty which triggers free time rendering.
        } else {
          const parts = fieldData.split('/');
          if (parts.length !== 2)
            throw new Error(`Can't understand meter: ${fieldData}`);
          music.beatsPerBar = parseInt(parts[0], 10);
          music.beatValue = parseInt(parts[1], 10);
        }
      } else if (line.startsWith('L:')) {
        defaultDuration = parseLDuration(fieldData);
      } else if (line.startsWith('K:')) {
        const clefMatch = fieldData.match(/\bclef=(\w+)/i);
        const keyPart = fieldData.replace(/\s*clef=\w+/i, '').trim();
        if (!(keyPart in KEYS)) throw new Error(`Can't parse key: ${keyPart}`);
        music.keySignature = keyPart;
        for (const note of KEYS[keyPart]) {
          keyAdjustment[note[0]] = note[1] === '#' ? 1 : -1;
        }
        if (clefMatch) {
          const clefName = clefMatch[1].toLowerCase();
          music.clef =
            clefName === 'bass'
              ? 'bass'
              : clefName === 'alto'
                ? 'alto'
                : 'treble';
        }
      }
      // other information fields are ignored
      continue;
    }
    if (line.startsWith('%%clef')) {
      const clefName = line.slice('%%clef'.length).trim().toLowerCase();
      music.clef =
        clefName === 'bass' ? 'bass' : clefName === 'alto' ? 'alto' : 'treble';
      continue;
    }
    // music line (with line-continuation support)
    if (line.endsWith('\\')) {
      scoreLines.push(line.slice(0, -1));
    } else {
      scoreLines.push(line);
    }
  }

  return { defaultDuration, keyAdjustment, scoreText: scoreLines.join('') };
}

// ---- Public API -------------------------------------------------------------

/**
 * Splits a multi-tune ABC file into individual tune texts.
 * Each tune begins with an `X:` reference number line.
 * If the text contains no `X:` lines it is returned as-is in a single-element array.
 */
export function splitTunes(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => (l.includes('%') ? l.slice(0, l.indexOf('%')) : l));
  const tunes: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^X:\s*\d+/.test(line) && current.length > 0) {
      tunes.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) {
    tunes.push(current.join('\n'));
  }
  return tunes.length > 0 ? tunes : [text];
}

export function fromAbc(text: string): Music {
  const music = new Music();
  const lines = text.split(/\r?\n/).map((l) => {
    if (l.startsWith('%%')) return l; // stylesheet directives: keep as-is
    const commentIdx = l.indexOf('%');
    return commentIdx === -1 ? l : l.slice(0, commentIdx);
  });
  const { defaultDuration, keyAdjustment, scoreText } = parseHeaders(
    lines,
    music
  );
  const tokens = tokenize(scoreText);
  parseScore(tokens, music, defaultDuration, keyAdjustment);
  return music;
}
