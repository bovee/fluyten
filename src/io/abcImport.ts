import {
  type Accidental,
  type BarLineType,
  type Decoration,
  type Signature,
  type SpanDecorationType,
  type Tuplet,
  Duration,
  KEYS,
  FIFTHS_TO_ACCIDENTALS,
  Music,
  Note,
  signatureAt,
} from '../music';
import { PITCH_CONSTANTS, TIME_SIGNATURES } from '../constants';

// Mapping of two-character ABC mnemonics (after \) to their Unicode equivalents.
// See https://abcnotation.com/wiki/abc:standard:v2.1#supported_accents_ligatures
const ABC_MNEMONICS: Record<string, string> = {
  // Grave
  '`A': '\u00C0',
  '`a': '\u00E0',
  '`E': '\u00C8',
  '`e': '\u00E8',
  '`I': '\u00CC',
  '`i': '\u00EC',
  '`O': '\u00D2',
  '`o': '\u00F2',
  '`U': '\u00D9',
  '`u': '\u00F9',
  // Acute
  "'A": '\u00C1',
  "'a": '\u00E1',
  "'E": '\u00C9',
  "'e": '\u00E9',
  "'I": '\u00CD',
  "'i": '\u00ED',
  "'O": '\u00D3',
  "'o": '\u00F3',
  "'U": '\u00DA',
  "'u": '\u00FA',
  "'Y": '\u00DD',
  "'y": '\u00FD',
  // Circumflex
  '^A': '\u00C2',
  '^a': '\u00E2',
  '^E': '\u00CA',
  '^e': '\u00EA',
  '^I': '\u00CE',
  '^i': '\u00EE',
  '^O': '\u00D4',
  '^o': '\u00F4',
  '^U': '\u00DB',
  '^u': '\u00FB',
  '^Y': '\u0176',
  '^y': '\u0177',
  // Tilde
  '~A': '\u00C3',
  '~a': '\u00E3',
  '~N': '\u00D1',
  '~n': '\u00F1',
  '~O': '\u00D5',
  '~o': '\u00F5',
  // Umlaut/diaeresis
  '"A': '\u00C4',
  '"a': '\u00E4',
  '"E': '\u00CB',
  '"e': '\u00EB',
  '"I': '\u00CF',
  '"i': '\u00EF',
  '"O': '\u00D6',
  '"o': '\u00F6',
  '"U': '\u00DC',
  '"u': '\u00FC',
  '"Y': '\u0178',
  '"y': '\u00FF',
  // Cedilla
  cC: '\u00C7',
  cc: '\u00E7',
  // Ring
  AA: '\u00C5',
  aa: '\u00E5',
  // Stroke
  '/O': '\u00D8',
  '/o': '\u00F8',
  // Breve
  uA: '\u0102',
  ua: '\u0103',
  uE: '\u0114',
  ue: '\u0115',
  // Caron
  vS: '\u0160',
  vs: '\u0161',
  vZ: '\u017D',
  vz: '\u017E',
  // Double acute
  HO: '\u0150',
  Ho: '\u0151',
  HU: '\u0170',
  Hu: '\u0171',
  // Ligatures and special characters
  AE: '\u00C6',
  ae: '\u00E6',
  OE: '\u0152',
  oe: '\u0153',
  ss: '\u00DF',
  DH: '\u00D0',
  dh: '\u00F0',
  TH: '\u00DE',
  th: '\u00FE',
};

/** Strip an ABC comment from a line, treating \% as an escaped percent sign
 *  that does NOT start a comment. Lines starting with %% are kept as-is. */
function stripComment(line: string): string {
  if (line.startsWith('%%')) return line;
  // Match a run of (escaped-char | non-%\) up to the first bare %.
  const m = line.match(/^((?:\\[\s\S]|[^%\\])*)%/);
  return m ? m[1] : line;
}

function expandMnemonics(text: string): string {
  return text.replace(
    /\\(u[0-9A-Fa-f]{8}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|U[0-9A-Fa-f]{4}|\\|%|&|[\s\S]{2})/g,
    (match, code: string) => {
      if (code === '\\') return '\\';
      if (code === '%') return '%';
      if (code === '&') return '&';
      if (/^[uU][0-9A-Fa-f]{4,8}$/.test(code))
        return String.fromCodePoint(parseInt(code.slice(1), 16));
      return ABC_MNEMONICS[code] ?? match;
    }
  );
}

const CLEF_NAME_MAP: Record<string, Music['clef']> = {
  bass: 'bass',
  'bass+8': 'bass8va',
  alto: 'alto',
  'treble+8': 'treble8va',
  treble: 'treble',
};

function parseClefName(name: string): Music['clef'] {
  return CLEF_NAME_MAP[name.toLowerCase()] ?? 'treble';
}

export function defaultClefForInstrument(basePitch: number): Music['clef'] {
  if (basePitch >= 72) return 'treble8va';
  if (basePitch >= 60) return 'treble';
  if (basePitch >= 48) return 'bass8va';
  return 'bass';
}

// https://abcnotation.com/wiki/abc:standard:v2.1

/** Normalize an ABC key field (after stripping clef/middle) to the canonical
 *  form used in KEYS, e.g. "G Mix", "G Mixolydian", "gmix" → "GMix". */
function normalizeKeySignature(raw: string): string {
  // Match: optional accidental (b/#), optional "m"/"min"/"maj" or mode name
  const m = raw.match(
    /^([A-Ga-g])(#|b)?\s*(maj(?:or)?|ion(?:ian)?|mix(?:olydian)?|m(?:in(?:or)?)?|aeo(?:lian)?|dor(?:ian)?|phr(?:ygian)?|lyd(?:ian)?|loc(?:rian)?)?$/i
  );
  if (!m) return raw;
  const root = m[1].toUpperCase() + (m[2] ?? '');
  const modeSuffix = (m[3] ?? '').toLowerCase();
  if (
    !modeSuffix ||
    modeSuffix.startsWith('maj') ||
    modeSuffix.startsWith('ion')
  )
    return root;
  if (modeSuffix.startsWith('mix')) return root + 'Mix';
  if (modeSuffix.startsWith('m') || modeSuffix.startsWith('aeo'))
    return root + 'm';
  if (modeSuffix.startsWith('dor')) return root + 'Dor';
  if (modeSuffix.startsWith('phr')) return root + 'Phr';
  if (modeSuffix.startsWith('lyd')) return root + 'Lyd';
  if (modeSuffix.startsWith('loc')) return root + 'Loc';
  return raw;
}

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

// Duration expressed as thirty-seconds of a whole note (2× finer than sixteenths
// so that dotted-sixteenth = 3 thirty-seconds resolves to an integer map key).
const DURATION_SIXTEENTHS: Record<Duration, number> = {
  [Duration.WHOLE]: 32,
  [Duration.HALF]: 16,
  [Duration.QUARTER]: 8,
  [Duration.EIGHTH]: 4,
  [Duration.SIXTEENTH]: 2,
  [Duration.THIRTY_SECOND]: 1,
  [Duration.GRACE]: 0,
  [Duration.GRACE_SLASH]: 0,
};

// Maps thirty-second count → [Duration, dots]
const SIXTEENTHS_TO_DURATION = new Map<number, [Duration, number]>([
  [1, [Duration.THIRTY_SECOND, 0]],
  [2, [Duration.SIXTEENTH, 0]],
  [3, [Duration.SIXTEENTH, 1]],
  [4, [Duration.EIGHTH, 0]],
  [6, [Duration.EIGHTH, 1]],
  [8, [Duration.QUARTER, 0]],
  [12, [Duration.QUARTER, 1]],
  [16, [Duration.HALF, 0]],
  [24, [Duration.HALF, 1]],
  [32, [Duration.WHOLE, 0]],
  [48, [Duration.WHOLE, 1]],
]);

/** Split a duration (in sixteenth-note units) into the fewest standard
 *  [Duration, dots] pairs, largest first. Used to expand durations that
 *  exceed a dotted whole note (e.g. z8 with L:1/4). */
function splitSixteenths(sixteenths: number): [Duration, number][] {
  const direct = SIXTEENTHS_TO_DURATION.get(sixteenths);
  if (direct) return [direct];
  // Prefer non-dotted durations first so that e.g. 64 sixteenths → whole+whole
  // rather than dotted-whole+half, which aligns better with bar boundaries.
  const ORDERED: [number, Duration, number][] = [
    [32, Duration.WHOLE, 0],
    [48, Duration.WHOLE, 1],
    [16, Duration.HALF, 0],
    [24, Duration.HALF, 1],
    [8, Duration.QUARTER, 0],
    [12, Duration.QUARTER, 1],
    [4, Duration.EIGHTH, 0],
    [6, Duration.EIGHTH, 1],
    [2, Duration.SIXTEENTH, 0],
    [3, Duration.SIXTEENTH, 1],
    [1, Duration.THIRTY_SECOND, 0],
  ];
  const result: [Duration, number][] = [];
  let rem = sixteenths;
  while (rem >= 1) {
    let placed = false;
    for (const [s, dur, mod] of ORDERED) {
      if (s <= rem) {
        result.push([dur, mod]);
        rem -= s;
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
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
      32: Duration.THIRTY_SECOND,
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
  | { type: 'volta'; number: number }
  | { type: 'grace_open' | 'grace_open_slash' | 'grace_close' }
  | { type: 'chord_open' }
  | { type: 'chord_close'; duration: string }
  | { type: 'tuplet'; actual: number; written: number; groupSize: number }
  | { type: 'slur_open' | 'slur_close' }
  | { type: 'tie' }
  | { type: 'beam_break' }
  | { type: 'beam_join' }
  | { type: 'broken_rhythm'; dir: '<' | '>' }
  | { type: 'inline_field'; field: string; value: string };

// Note sub-pattern (no ^ anchor; named groups survive the outer alternation
// because only one branch can match at a time)
const NOTE_PATTERN_SRC = [
  '(?<text>(?:"[^"]*"\\s?)*)',
  '(?<decoration>(?:[.~HLMOPSTuv]|![A-Za-z0-9()<>+./]+!\\s?)*)',
  '(?<accidental>[\\^_]3/2?|[\\^_]1/2|[\\^_]/|[\\^=_]{0,2})',
  "(?<note>[A-Ga-gZXzx][,']*)",
  '(?<duration>\\d*(?:\\/\\/?)?\\d*)',
].join('');

// Master tokenizer regex (sticky: advances through the string without slicing).
// Alternatives are ordered longest-match-first within each group.
const TOKEN_RE = new RegExp(
  [
    NOTE_PATTERN_SRC,
    // bars — longest first so "|:" isn't consumed as "|" + ":"
    // Volta variants (e.g. :|2, |1) must precede their non-volta counterparts
    '::',
    '\\|\\|',
    '\\[\\|',
    '\\|\\]',
    '\\|:',
    ':\\|\\d', // :|1, :|2 — end repeat with volta number
    ':\\|',
    '\\|\\d', // |1, |2 — standard bar with volta number
    '\\|',
    // grace notes
    '\\{/',
    '\\{',
    '\\}',
    // inline fields like [K:C] — match the full [X:value] content
    '\\[[A-Z]:[^\\]]*\\]',
    // volta bracket [1, [2 — must precede chord bracket "["
    '\\[\\d',
    // chord brackets
    '\\[',
    '\\](?<chordDur>\\d*(?:\\/\\/?)?\\d*)',
    // tuplets — "(p:q:r", "(p:q", "(p:" or plain "(p" — before "(" so digit isn't lost
    '\\(\\d(?::\\d*(?::\\d+)?)?',
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

export function tokenize(score: string): ScoreToken[] {
  const tokens: ScoreToken[] = [];
  TOKEN_RE.lastIndex = 0;

  let m: RegExpExecArray | null;
  while (TOKEN_RE.lastIndex < score.length) {
    const pos = TOKEN_RE.lastIndex;
    m = TOKEN_RE.exec(score);
    if (m === null) {
      TOKEN_RE.lastIndex = pos + 1;
      continue;
    }
    const raw = m[0];
    const g = m.groups!;

    if (g.note !== undefined) {
      tokens.push({ type: 'note', groups: g as unknown as NoteGroups });
      continue;
    }

    if (raw in BAR_MAPPINGS) {
      tokens.push({ type: 'bar', barType: BAR_MAPPINGS[raw] });
    } else if (/^:\|\d$/.test(raw)) {
      // :|1, :|2 — end repeat bar followed by volta number
      tokens.push({ type: 'bar', barType: 'end_repeat' });
      tokens.push({ type: 'volta', number: parseInt(raw[2], 10) });
    } else if (/^\|\d$/.test(raw)) {
      // |1, |2 — standard bar followed by volta number
      tokens.push({ type: 'bar', barType: 'standard' });
      tokens.push({ type: 'volta', number: parseInt(raw[1], 10) });
    } else if (/^\[\d$/.test(raw)) {
      // [1, [2 — volta bracket without an explicit preceding bar
      tokens.push({ type: 'bar', barType: 'standard' });
      tokens.push({ type: 'volta', number: parseInt(raw[1], 10) });
    } else if (raw === '{/') {
      tokens.push({ type: 'grace_open_slash' });
    } else if (raw === '{') {
      tokens.push({ type: 'grace_open' });
    } else if (raw === '}') {
      tokens.push({ type: 'grace_close' });
    } else if (
      raw[0] === '[' &&
      raw[1] !== undefined &&
      raw[1] !== '[' &&
      raw[2] === ':'
    ) {
      // matched "[X:value]" inline field
      tokens.push({
        type: 'inline_field',
        field: raw[1],
        value: raw.slice(3, -1).trim(),
      });
    } else if (raw === '[') {
      tokens.push({ type: 'chord_open' });
    } else if (raw[0] === ']') {
      tokens.push({ type: 'chord_close', duration: g.chordDur ?? '' });
    } else if (/^\(\d/.test(raw)) {
      // Tuplet: (p), (p:q), (p:q:r), (p::r) — isCompound determined later in parseScore
      // Store raw string; isCompound context not available here, so defer resolution.
      const parts = raw.slice(1).split(':');
      const actual = parseInt(parts[0], 10);
      // q and r are resolved in parseScore where time signature is known.
      // Store -1 as sentinel for "use default".
      const writtenRaw =
        parts.length > 1 && parts[1] !== '' ? parseInt(parts[1], 10) : -1;
      const groupSizeRaw =
        parts.length > 2 && parts[2] !== '' ? parseInt(parts[2], 10) : -1;
      tokens.push({
        type: 'tuplet',
        actual,
        written: writtenRaw,
        groupSize: groupSizeRaw,
      });
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

// ---- Broken rhythm helper ---------------------------------------------------

// `>` dots the left note and halves the right; `<` is the reverse.
function applyBrokenRhythm(
  duration: Duration,
  dots: number,
  dir: 'dot' | 'halve'
): [Duration, number] {
  let sixteenths = DURATION_SIXTEENTHS[duration];
  if (dots === 1) sixteenths = (sixteenths * 3) / 2;
  sixteenths = dir === 'dot' ? (sixteenths * 3) / 2 : sixteenths / 2;
  const result = SIXTEENTHS_TO_DURATION.get(sixteenths);
  if (!result)
    throw new Error(
      `Broken rhythm produces an unsupported duration (${sixteenths} sixteenths)`
    );
  return result;
}

// ---- Duration parser --------------------------------------------------------

/** Parse an ABC duration string (e.g. "", "2", "/2", "//", "3/2") into one or
 *  more [Duration, dots] pairs relative to `defaultDuration`.
 *  Returns null if the string is empty (caller should use defaultDuration).
 *  Returns multiple pairs when the total duration exceeds a dotted whole note
 *  (e.g. z8 with L:1/4 → two whole-note pairs). */
function parseAbcDuration(
  abcDuration: string,
  defaultDuration: Duration
): [Duration, number][] | null {
  if (!abcDuration) return null;
  let sixteenths: number;
  if (abcDuration === '//') {
    sixteenths = (DURATION_SIXTEENTHS[defaultDuration] * 1) / 4;
  } else if (!abcDuration.includes('/')) {
    sixteenths =
      DURATION_SIXTEENTHS[defaultDuration] * parseInt(abcDuration, 10);
  } else {
    const parts = abcDuration.split('/');
    if (parts.length !== 2) throw new Error(`Invalid duration: ${abcDuration}`);
    const [numer, denom] = parts;
    sixteenths =
      (DURATION_SIXTEENTHS[defaultDuration] * (parseInt(numer, 10) || 1)) /
      (parseInt(denom, 10) || 2);
  }
  const single = SIXTEENTHS_TO_DURATION.get(sixteenths);
  if (single) return [single];
  const split = splitSixteenths(sixteenths);
  if (split.length > 0) return split;
  throw new Error(`Invalid duration: ${abcDuration} of ${defaultDuration}`);
}

// ---- Score parser -----------------------------------------------------------

/** Default "written" count (q) for a tuplet of `actual` notes (p).
 *  Per ABC standard: 2→3, 3→2, 4→3, 6→2, 8→3; 5/7/9 depend on compound time. */
function defaultTupletWritten(actual: number, isCompound: boolean): number {
  if (actual === 2) return 3;
  if (actual === 3) return 2;
  if (actual === 4) return 3;
  if (actual === 6) return 2;
  if (actual === 8) return 3;
  // 5, 7, 9: compound time → 3, simple time → 2
  return isCompound ? 3 : 2;
}

interface ChordAccum {
  pitches: number[];
  accidentals: Accidental[];
  duration: Duration;
  dots: number;
  decorations: Decoration[];
}

export function parseScore(
  tokens: ScoreToken[],
  music: Music,
  defaultDuration: Duration,
  keyAdjustment: { [n: string]: number },
  isFreeTime = false
): void {
  // Local mutable copies so inline fields can update them mid-score.
  let curDefaultDuration = defaultDuration;
  const curKeyAdjustment: { [n: string]: number } = { ...keyAdjustment };
  const barAccidentals: { [n: string]: number } = {};
  let noteType: 'grace' | 'grace_slash' | 'tuplet' | 'chord' | null = null;
  let tupletCounter = 0;
  let pendingTuplet: Tuplet | null = null;
  let startSlur: number | null = null;
  let chordAccum: ChordAccum | null = null;
  let pendingBrokenRhythm: 'dot' | 'halve' | null = null;
  const openSpans = new Map<SpanDecorationType, number>();

  // Maps ABC span decoration markers to their type and whether they open or close.
  const SPAN_MARKERS: Record<
    string,
    { type: SpanDecorationType; open: boolean }
  > = {
    '!trill(!': { type: 'trill', open: true },
    '!trill)!': { type: 'trill', open: false },
    '!crescendo(!': { type: 'crescendo', open: true },
    '!crescendo)!': { type: 'crescendo', open: false },
    '!<(!': { type: 'crescendo', open: true },
    '!<)!': { type: 'crescendo', open: false },
    '!diminuendo(!': { type: 'diminuendo', open: true },
    '!diminuendo)!': { type: 'diminuendo', open: false },
    '!>(!': { type: 'diminuendo', open: true },
    '!>)!': { type: 'diminuendo', open: false },
  };

  // Beam tracking: a beam group is a run of note tokens uninterrupted by beam_break.
  // beam_join (backtick) bridges a gap without closing the group.
  let beamStart = 0;
  let inBeam = false;

  function closeBeam() {
    if (inBeam && music.notes.length > beamStart + 1) {
      const allBeamable = Array.from(
        { length: music.notes.length - beamStart },
        (_, i) => music.notes[beamStart + i].duration
      ).every(
        (d) =>
          d === Duration.EIGHTH ||
          d === Duration.SIXTEENTH ||
          d === Duration.THIRTY_SECOND
      );
      if (allBeamable) {
        music.beams.push([beamStart, music.notes.length - 1]);
      }
    }
    inBeam = false;
  }

  for (const token of tokens) {
    // Any token other than a note, beam-join, slur marker, or broken-rhythm operator
    // terminates the current beam group.
    // Slur open/close and broken_rhythm are transparent to beaming: notes can be beamed
    // across slur boundaries and across `>` / `<` operators (spaces already emit beam_break).
    if (
      token.type !== 'note' &&
      token.type !== 'beam_join' &&
      token.type !== 'slur_open' &&
      token.type !== 'slur_close' &&
      token.type !== 'broken_rhythm'
    )
      closeBeam();

    switch (token.type) {
      case 'note': {
        const { groups } = token;
        const abcDuration = groups.duration;

        // Z (uppercase) = multimeasure rest: Zn means n full bars of rest.
        if (groups.note === 'Z' && !isFreeTime) {
          closeBeam();
          const barCount = abcDuration ? parseInt(abcDuration, 10) || 1 : 1;
          // Compute one bar's duration in thirtyseconds (each unit = SIXTEENTH/2 = 128 ticks)
          const sig = music.signatures[0];
          const barThirtyseconds = (sig.beatsPerBar * 32) / sig.beatValue;
          const barDurations = splitSixteenths(barThirtyseconds);
          for (let b = 0; b < barCount; b++) {
            for (const [dur, mod] of barDurations) {
              music.notes.push(new Note(undefined, dur, [], [], mod));
            }
            if (b < barCount - 1) {
              music.bars.push({
                afterNoteNum: music.notes.length - 1,
                type: 'standard',
              });
            }
          }
          break;
        }

        let noteDuration: Duration;
        let noteDots = 0;

        const parsedDur = parseAbcDuration(abcDuration, curDefaultDuration);
        const parsedDurs = parsedDur ?? null;
        if (parsedDurs && parsedDurs.length > 0) {
          [noteDuration, noteDots] = parsedDurs[0];
        } else if (noteType === 'grace') {
          noteDuration = Duration.GRACE;
        } else if (noteType === 'grace_slash') {
          noteDuration = Duration.GRACE_SLASH;
        } else {
          noteDuration = curDefaultDuration;
        }

        if (pendingBrokenRhythm !== null) {
          if (
            noteDuration !== Duration.GRACE &&
            noteDuration !== Duration.GRACE_SLASH &&
            noteType !== 'tuplet'
          ) {
            [noteDuration, noteDots] = applyBrokenRhythm(
              noteDuration,
              noteDots,
              pendingBrokenRhythm
            );
          }
          pendingBrokenRhythm = null;
        }

        const note = Note.fromAbc(
          groups.note,
          noteDuration,
          noteDots,
          curKeyAdjustment,
          groups.accidental,
          groups.decoration,
          groups.text ?? '',
          barAccidentals
        );

        if (noteType === 'tuplet' && pendingTuplet) {
          note.tuplet = { ...pendingTuplet };
          if (--tupletCounter === 0) {
            noteType = null;
            pendingTuplet = null;
          }
        }
        if (groups.accidental) {
          const n = groups.note;
          if (groups.accidental === '^^') barAccidentals[n] = 2;
          else if (groups.accidental === '^') barAccidentals[n] = 1;
          else if (groups.accidental === '__') barAccidentals[n] = -2;
          else if (groups.accidental === '_') barAccidentals[n] = -1;
          else if (groups.accidental === '=') barAccidentals[n] = 0;
          // Microtonal accidentals are not propagated within the bar;
          // each note must carry its own explicit microtonal marking.
        }

        if (noteType === 'chord' && chordAccum) {
          if (chordAccum.pitches.length === 0) {
            // First note in chord: its duration and decorations apply to the whole chord.
            chordAccum.duration = note.duration;
            chordAccum.dots = note.dots;
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
          // Process span decoration markers (e.g. !crescendo(!, !trill)!)
          for (const marker of groups.decoration.matchAll(/!\S+!/g)) {
            const span = SPAN_MARKERS[marker[0]];
            if (!span) continue;
            const noteIdx = music.notes.length - 1;
            if (span.open) {
              openSpans.set(span.type, noteIdx);
            } else {
              const startIdx = openSpans.get(span.type);
              if (startIdx !== undefined) {
                music.spanDecorations.push({
                  type: span.type,
                  startNoteIndex: startIdx,
                  endNoteIndex: noteIdx,
                });
                openSpans.delete(span.type);
              }
            }
          }
          // If the duration was split (e.g. z8 with L:1/4), emit extra notes
          if (parsedDurs && parsedDurs.length > 1) {
            for (const [dur, d] of parsedDurs.slice(1)) {
              music.notes.push(
                new Note(
                  note.pitches,
                  dur,
                  note.decorations,
                  note.accidentals,
                  d
                )
              );
            }
          }
        }
        break;
      }

      case 'bar':
        for (const k of Object.keys(barAccidentals)) delete barAccidentals[k];
        if (!isFreeTime) {
          music.bars.push({
            afterNoteNum: music.notes.length - 1,
            type: token.barType,
          });
        }
        break;

      case 'volta': {
        // Attach the volta number to the most recently pushed bar line.
        const lastBar = music.bars[music.bars.length - 1];
        if (lastBar) lastBar.volta = token.number;
        break;
      }

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
          duration: curDefaultDuration,
          dots: 0,
          decorations: [],
        };
        break;

      case 'chord_close':
        if (chordAccum) {
          // Duration after ']' overrides the duration taken from the first note inside
          const trailingDur = parseAbcDuration(
            token.duration,
            curDefaultDuration
          );
          if (trailingDur && trailingDur.length > 0) {
            [chordAccum.duration, chordAccum.dots] = trailingDur[0];
          }
          const chordNote = new Note(
            chordAccum.pitches,
            chordAccum.duration,
            chordAccum.decorations,
            chordAccum.accidentals,
            chordAccum.dots
          );
          if (noteType === 'tuplet' && pendingTuplet) {
            chordNote.tuplet = { ...pendingTuplet };
            if (--tupletCounter === 0) {
              noteType = null;
              pendingTuplet = null;
            }
          }
          if (!inBeam) {
            beamStart = music.notes.length;
            inBeam = true;
          }
          music.notes.push(chordNote);
          if (trailingDur && trailingDur.length > 1) {
            for (const [dur, d] of trailingDur.slice(1)) {
              music.notes.push(
                new Note(
                  chordAccum.pitches,
                  dur,
                  chordAccum.decorations,
                  chordAccum.accidentals,
                  d
                )
              );
            }
          }
          chordAccum = null;
        }
        if (noteType !== 'tuplet') noteType = null;
        break;

      case 'tuplet': {
        // Resolve sentinel values (-1) using time signature context.
        const sig = signatureAt(music, music.notes.length);
        const isCompound = sig.beatsPerBar % 3 === 0 && sig.beatsPerBar >= 6;
        const written =
          token.written !== -1
            ? token.written
            : defaultTupletWritten(token.actual, isCompound);
        const groupSize =
          token.groupSize !== -1 ? token.groupSize : token.actual;
        noteType = 'tuplet';
        pendingTuplet = { actual: token.actual, written, groupSize };
        tupletCounter = groupSize;
        break;
      }

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

      case 'broken_rhythm': {
        const lastNote = music.notes[music.notes.length - 1];
        if (!lastNote)
          throw new Error(
            `Broken rhythm '${token.dir}' with no preceding note`
          );
        const [lastDir, nextDir] =
          token.dir === '>'
            ? (['dot', 'halve'] as const)
            : (['halve', 'dot'] as const);
        [lastNote.duration, lastNote.dots] = applyBrokenRhythm(
          lastNote.duration,
          lastNote.dots,
          lastDir
        );
        pendingBrokenRhythm = nextDir;
        break;
      }

      case 'inline_field': {
        const noteIndex = music.notes.length;
        const prev = signatureAt(music, noteIndex);
        const next: Signature = { ...prev, atNoteIndex: noteIndex };
        if (token.field === 'M') {
          if (token.value === 'C') {
            next.beatsPerBar = TIME_SIGNATURES.COMMON_TIME.beatsPerBar;
            next.beatValue = TIME_SIGNATURES.COMMON_TIME.beatValue;
            next.commonTime = true;
          } else if (token.value === 'C|') {
            next.beatsPerBar = TIME_SIGNATURES.CUT_TIME.beatsPerBar;
            next.beatValue = TIME_SIGNATURES.CUT_TIME.beatValue;
            next.commonTime = true;
          } else {
            const parts = token.value.split('/');
            if (parts.length === 2) {
              const bpb = parseInt(parts[0], 10);
              const bv = parseInt(parts[1], 10);
              if (!isNaN(bpb) && !isNaN(bv)) {
                next.beatsPerBar = bpb;
                next.beatValue = bv;
                next.commonTime = false;
              }
            }
          }
        } else if (token.field === 'L') {
          next.defaultDuration = parseLDuration(token.value);
          curDefaultDuration = next.defaultDuration;
        } else if (token.field === 'Q') {
          const labelMatch = token.value.match(/^"([^"]*)"/);
          if (labelMatch) next.tempoText = labelMatch[1];
          const tempoMatch = token.value.match(/(?:[\d/]+=)?(\d+)\s*$/);
          if (tempoMatch) {
            const bpm = parseInt(tempoMatch[1], 10);
            if (!isNaN(bpm)) next.tempo = bpm;
          }
        } else if (token.field === 'K') {
          const rawKey = token.value
            .replace(/\s*clef=[\w+]+/i, '')
            .replace(/\s*middle=[A-Ga-g][,']*/i, '')
            .trim();
          const keyPart = normalizeKeySignature(rawKey);
          if (keyPart in KEYS) {
            next.keySignature = keyPart;
            // Rebuild the key adjustment map for subsequent notes.
            for (const k of Object.keys(curKeyAdjustment))
              delete curKeyAdjustment[k];
            for (const note of FIFTHS_TO_ACCIDENTALS[KEYS[keyPart] ?? 0] ??
              []) {
              curKeyAdjustment[note[0]] = note[1] === '#' ? 1 : -1;
            }
          }
        }
        // Only push a new signature if something actually changed.
        if (
          next.keySignature !== prev.keySignature ||
          next.beatsPerBar !== prev.beatsPerBar ||
          next.beatValue !== prev.beatValue ||
          next.tempo !== prev.tempo ||
          next.defaultDuration !== prev.defaultDuration
        ) {
          music.signatures.push(next);
        }
        break;
      }

      case 'beam_break':
      case 'beam_join':
        break; // beam state already managed above the switch
    }
  }
  closeBeam();
}

// ---- Header parser ----------------------------------------------------------

// Semitone offsets within an octave for each letter name
const LETTER_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Parse an ABC note name (e.g. "B", "D,", "c", "c'") to a MIDI pitch.
 * Returns undefined if the note string is not valid.
 */
function parseMidNote(note: string): number | undefined {
  if (!note) return undefined;
  const letter = note[0];
  const suffix = note.slice(1);
  const upper = letter.toUpperCase();
  const semitone = LETTER_SEMITONES[upper];
  if (semitone === undefined) return undefined;
  let octave = letter === upper ? 3 : 4; // uppercase = octave 3, lowercase = octave 4
  for (const ch of suffix) {
    if (ch === ',') octave--;
    else if (ch === "'") octave++;
  }
  return PITCH_CONSTANTS.OCTAVE_OFFSET + octave * 12 + semitone;
}

// Default MIDI pitch of the middle line for each clef type.
// treble middle line = B4 (MIDI 71); bass = D3 (MIDI 50); alto = A4 (MIDI 69).
// treble+8 and bass+8 share their base clef default (the extra octave is handled separately).
const DEFAULT_CLEF_MIDDLE: Record<string, number> = {
  treble: parseMidNote('B') ?? 71, // B4
  'treble+8': parseMidNote('B') ?? 71, // B4
  bass: parseMidNote('D,') ?? 50, // D3
  'bass+8': parseMidNote('D,') ?? 50, // D3
  alto: parseMidNote('A') ?? 69, // A4
};

export interface HeaderParseResult {
  defaultDuration: Duration;
  keyAdjustment: { [n: string]: number };
  scoreText: string;
  isFreeTime: boolean;
  pitchShift: number;
}

export function parseHeaders(
  lines: string[],
  music: Music,
  defaultClef: Music['clef'] = 'treble',
  defaultMiddle?: string
): HeaderParseResult {
  let defaultDuration: Duration = Duration.QUARTER;
  const keyAdjustment: { [n: string]: number } = {};
  const scoreLines: string[] = [];
  let isFreeTime = false;
  let pitchShift = 0;
  let explicitMiddle = false;
  music.clef = defaultClef;

  for (const line of lines) {
    if (line[1] === ':' && !line.startsWith('|:')) {
      const fieldData = line.slice(2).trim();
      if (!music.title && line.startsWith('T:'))
        music.title = expandMnemonics(fieldData);
      if (!music.composer && line.startsWith('C:'))
        music.composer = expandMnemonics(fieldData);
      if (line.startsWith('M:')) {
        if (fieldData === 'C') {
          music.signatures[0].beatsPerBar =
            TIME_SIGNATURES.COMMON_TIME.beatsPerBar;
          music.signatures[0].beatValue = TIME_SIGNATURES.COMMON_TIME.beatValue;
          music.signatures[0].commonTime = true;
        } else if (fieldData === 'C|') {
          music.signatures[0].beatsPerBar =
            TIME_SIGNATURES.CUT_TIME.beatsPerBar;
          music.signatures[0].beatValue = TIME_SIGNATURES.CUT_TIME.beatValue;
          music.signatures[0].commonTime = true;
        } else if (fieldData === '' || fieldData === 'none') {
          // Free time / no meter: leave beatsPerBar/beatValue at defaults,
          // bars will remain empty which triggers free time rendering.
          isFreeTime = true;
        } else {
          const parts = fieldData.split('/');
          if (parts.length !== 2)
            throw new Error(`Can't understand meter: ${fieldData}`);
          music.signatures[0].beatsPerBar = parseInt(parts[0], 10);
          music.signatures[0].beatValue = parseInt(parts[1], 10);
          if (
            isNaN(music.signatures[0].beatsPerBar) ||
            isNaN(music.signatures[0].beatValue)
          )
            throw new Error(`Can't understand meter: ${fieldData}`);
        }
      } else if (line.startsWith('L:')) {
        defaultDuration = parseLDuration(fieldData);
        music.signatures[0].defaultDuration = defaultDuration;
      } else if (line.startsWith('Q:')) {
        // Q: ["<label>"] [<note-length>=]<bpm>
        // e.g. Q:"Allegro" 1/4=120  or  Q:120  or  Q:"Andante"
        const qText = fieldData.trim();
        const labelMatch = qText.match(/^"([^"]*)"/);
        if (labelMatch && !music.signatures[0].tempoText)
          music.signatures[0].tempoText = labelMatch[1];
        const tempoMatch = qText.match(/(?:[\d/]+=)?(\d+)\s*$/);
        if (tempoMatch && !music.signatures[0].tempo) {
          const bpm = parseInt(tempoMatch[1], 10);
          if (!isNaN(bpm)) music.signatures[0].tempo = bpm;
        }
      } else if (line.startsWith('K:')) {
        const clefMatch = fieldData.match(/\bclef=([\w+]+)/i);
        const middleMatch = fieldData.match(/\bmiddle=([A-Ga-g][,'']*)/);
        const rawKey = fieldData
          .replace(/\s*clef=[\w+]+/i, '')
          .replace(/\s*middle=[A-Ga-g][,']*/i, '')
          .trim();
        const keyPart = normalizeKeySignature(rawKey);
        if (!(keyPart in KEYS)) throw new Error(`Can't parse key: ${rawKey}`);
        music.signatures[0].keySignature = keyPart;
        for (const note of FIFTHS_TO_ACCIDENTALS[KEYS[keyPart] ?? 0] ?? []) {
          keyAdjustment[note[0]] = note[1] === '#' ? 1 : -1;
        }
        if (clefMatch) {
          music.clef = parseClefName(clefMatch[1]);
        }
        if (middleMatch) {
          explicitMiddle = true;
          const clefKey =
            music.clef === 'treble8va'
              ? 'treble+8'
              : music.clef === 'bass8va'
                ? 'bass+8'
                : music.clef;
          const defaultMidi =
            DEFAULT_CLEF_MIDDLE[clefKey] ?? DEFAULT_CLEF_MIDDLE.treble;
          const specifiedMidi = parseMidNote(middleMatch[1]);
          if (specifiedMidi !== undefined) {
            pitchShift = defaultMidi - specifiedMidi;
          }
        }
      }
      // other information fields are ignored
      continue;
    }
    if (line.startsWith('%%clef')) {
      music.clef = parseClefName(line.slice('%%clef'.length).trim());
      continue;
    }
    // music line (with line-continuation support)
    if (line.endsWith('\\')) {
      scoreLines.push(line.slice(0, -1));
    } else {
      scoreLines.push(line);
    }
  }

  if (!explicitMiddle && defaultMiddle !== undefined) {
    const clefKey =
      music.clef === 'treble8va'
        ? 'treble+8'
        : music.clef === 'bass8va'
          ? 'bass+8'
          : music.clef;
    const defaultMidi =
      DEFAULT_CLEF_MIDDLE[clefKey] ?? DEFAULT_CLEF_MIDDLE.treble;
    const specifiedMidi = parseMidNote(defaultMiddle);
    if (specifiedMidi !== undefined) {
      pitchShift = defaultMidi - specifiedMidi;
    }
  }

  return {
    defaultDuration,
    keyAdjustment,
    scoreText: scoreLines.join(''),
    isFreeTime,
    pitchShift,
  };
}

// ---- Public API -------------------------------------------------------------

export interface VoiceInfo {
  id: string;
  name: string;
  music: Music;
}

/**
 * Parses an ABC tune that may contain multiple voices (V: fields).
 * Returns one VoiceInfo per voice, each holding its own Music object.
 * If no V: fields are present, returns a single-element array from fromAbc().
 */
export function voicesFromAbc(
  text: string,
  defaultClef: Music['clef'] = 'treble',
  defaultMiddle?: string
): VoiceInfo[] {
  // Strip comments (same preprocessing as fromAbc)
  const lines = text.split(/\r?\n/).map((l) => {
    return stripComment(l);
  });

  // Quick check: does this ABC use voices at all?
  if (!lines.some((l) => /^V:\s*\S/.test(l))) {
    return [
      { id: '1', name: '', music: fromAbc(text, defaultClef, defaultMiddle) },
    ];
  }

  // Collect voice definitions from V: lines (first occurrence per id wins)
  const voiceDefs = new Map<
    string,
    {
      name: string;
      clef?: 'treble' | 'bass' | 'alto' | 'treble8va' | 'bass8va';
      middle?: string;
    }
  >();
  for (const line of lines) {
    if (!line.startsWith('V:')) continue;
    const rest = line.slice(2).trim();
    const idMatch = rest.match(/^(\S+)/);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (voiceDefs.has(id)) continue;
    const nameMatch = rest.match(/(?:name|nm)="([^"]+)"|(?:name|nm)=(\S+)/i);
    const clefMatch = rest.match(/clef=([\w+]+)/i);
    const middleMatch = rest.match(/\bmiddle=([A-Ga-g][,'']*)/);
    const name = nameMatch ? (nameMatch[1] ?? nameMatch[2]) : id;
    let clef: 'treble' | 'bass' | 'alto' | 'treble8va' | 'bass8va' | undefined;
    if (clefMatch) {
      clef = parseClefName(clefMatch[1]);
    }
    const middle = middleMatch ? middleMatch[1] : undefined;
    voiceDefs.set(id, { name, clef, middle });
  }

  const firstVoiceId = voiceDefs.keys().next().value as string;

  // Collect global header lines and split score text per voice
  const globalHeaderLines: string[] = [];
  const voiceSegments = new Map<string, string[]>();
  for (const id of voiceDefs.keys()) voiceSegments.set(id, []);

  let currentVoiceId = firstVoiceId;

  for (const line of lines) {
    // Field line: second character is ':' and not starting with '|:'
    if (line.length >= 2 && line[1] === ':' && !line.startsWith('|:')) {
      if (line.startsWith('V:')) {
        const rest = line.slice(2).trim();
        const idMatch = rest.match(/^(\S+)/);
        if (idMatch && voiceDefs.has(idMatch[1])) {
          currentVoiceId = idMatch[1];
        }
      } else if (line.startsWith('w:') || line.startsWith('W:')) {
        // Lyrics lines belong to the current voice, not the global header
        voiceSegments.get(currentVoiceId)?.push(line);
      } else {
        globalHeaderLines.push(line);
      }
      continue;
    }
    if (line.startsWith('%%')) {
      globalHeaderLines.push(line);
      continue;
    }
    if (line.trim() === '') continue;

    // Score line: split by [V:id] inline markers
    const inlineVoiceRe = /\[V:([^\]]+)\]/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = inlineVoiceRe.exec(line)) !== null) {
      const segment = line.slice(lastIdx, match.index);
      if (segment.trim()) voiceSegments.get(currentVoiceId)?.push(segment);
      const newId = match[1].trim();
      if (voiceDefs.has(newId)) currentVoiceId = newId;
      lastIdx = inlineVoiceRe.lastIndex;
    }
    const remaining = line.slice(lastIdx);
    if (remaining.trim()) voiceSegments.get(currentVoiceId)?.push(remaining);
  }

  // Build Music for each voice
  const result: VoiceInfo[] = [];
  for (const [id, { name, clef, middle }] of voiceDefs) {
    const segments = voiceSegments.get(id) ?? [];
    if (segments.length === 0) continue;
    const voiceAbc = [...globalHeaderLines, segments.join('\n')].join('\n');
    try {
      const music = fromAbc(
        voiceAbc,
        clef ?? defaultClef,
        middle ?? defaultMiddle
      );
      if (clef) music.clef = clef;
      result.push({ id, name, music });
    } catch {
      // skip voices that fail to parse
    }
  }

  return result.length > 0
    ? result
    : [{ id: '1', name: '', music: fromAbc(text) }];
}

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

// ---- Lyrics helpers ---------------------------------------------------------

interface LyricSection {
  scoreLines: string[];
  verseLyrics: string[]; // verseLyrics[v] = raw text of verse v+1 w: line
}

/**
 * Splits pre-processed (comment-stripped) lines into sections, each grouping
 * music score lines with the consecutive w: lines that follow them.
 * W: lines and other header lines are returned separately.
 */
function buildSections(lines: string[]): {
  sections: LyricSection[];
  headerLines: string[];
  endLyricLines: string[];
} {
  const sections: LyricSection[] = [];
  const headerLines: string[] = [];
  const endLyricLines: string[] = [];

  let currentScoreLines: string[] = [];
  let inWBlock = false;

  for (const line of lines) {
    if (line.startsWith('w:')) {
      // Start or continue a w: block for the current section
      if (!inWBlock && currentScoreLines.length > 0) {
        sections.push({ scoreLines: currentScoreLines, verseLyrics: [] });
        currentScoreLines = [];
      }
      inWBlock = true;
      const verseText = line.slice(2);
      const target = sections.length > 0 ? sections[sections.length - 1] : null;
      if (target) target.verseLyrics.push(verseText);
    } else if (line.startsWith('W:')) {
      endLyricLines.push(line.slice(2));
      inWBlock = false;
    } else {
      const isHeaderOrDirective =
        line.startsWith('%%') ||
        line.trim() === '' ||
        (line.length >= 2 && line[1] === ':' && !line.startsWith('|:'));
      if (isHeaderOrDirective) {
        headerLines.push(line);
        inWBlock = false;
      } else {
        // Score line — start a new section if we just left a w: block
        if (inWBlock) inWBlock = false;
        const scoreLine = line.endsWith('\\') ? line.slice(0, -1) : line;
        currentScoreLines.push(scoreLine);
      }
    }
  }

  // Flush any remaining score lines as a final section
  if (currentScoreLines.length > 0) {
    sections.push({ scoreLines: currentScoreLines, verseLyrics: [] });
  }

  return { sections, headerLines, endLyricLines };
}

type LyricToken =
  | { type: 'syllable'; text: string }
  | { type: 'hold' }
  | { type: 'skip' }
  | { type: 'bar' };

/** Tokenize a single whitespace-delimited lyric word into lyric tokens.
 *  Handles: hyphens (syllable breaks), \- (literal hyphen, no break),
 *  ~ (space in display, no break), trailing _ (holds). */
function tokenizeLyricWord(word: string): LyricToken[] {
  const tokens: LyricToken[] = [];

  // Split on hyphens that are not preceded by a backslash.
  const parts = word.split(/(?<!\\)-/);

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    const isLast = i === parts.length - 1;

    // Strip trailing underscores — each is a hold token for the next note.
    let holdCount = 0;
    while (part.endsWith('_')) {
      holdCount++;
      part = part.slice(0, -1);
    }

    // ~ → space in display; \- → literal hyphen.
    const display = part.replace(/~/g, ' ').replace(/\\-/g, '-');

    if (display) {
      // Add a trailing hyphen connector when this part is not the final split.
      tokens.push({ type: 'syllable', text: isLast ? display : display + '-' });
    } else if (!isLast) {
      // Empty part at a non-final position: double-hyphen or leading hyphen —
      // the standard treats this as a separate hyphen syllable.
      tokens.push({ type: 'syllable', text: '-' });
    }
    // Empty display AND last part: trailing hyphen already on previous syllable.

    for (let h = 0; h < holdCount; h++) tokens.push({ type: 'hold' });
  }

  return tokens;
}

function parseLyricTokens(text: string): LyricToken[] {
  const tokens: LyricToken[] = [];
  const words = expandMnemonics(text.trim()).split(/\s+/);
  for (const word of words) {
    if (!word) continue;
    if (word === '*') {
      tokens.push({ type: 'skip' });
    } else if (
      word === '|' ||
      word === '||' ||
      word === '|:' ||
      word === ':|' ||
      word === '::'
    ) {
      tokens.push({ type: 'bar' });
    } else {
      // Handles _, __, time__, hel-lo, \-, of~the~day, and combinations.
      tokens.push(...tokenizeLyricWord(word));
    }
  }
  return tokens;
}

function assignLyricsToNotes(
  music: Music,
  tokens: LyricToken[],
  verse: number,
  noteStart: number,
  noteEnd: number
): void {
  // Ensure the verse row exists
  while (music.lyrics.length <= verse) {
    music.lyrics.push(new Array(music.notes.length).fill(undefined));
  }
  // Ensure all rows have the right length (notes may have been added)
  for (const row of music.lyrics) {
    while (row.length < music.notes.length) row.push(undefined);
  }

  let noteIdx = noteStart;
  let tokenIdx = 0;

  // Advance past grace notes and rests — the standard says syllables are not
  // aligned on grace notes, rests, or spacers.
  function skipNonLyricNotes() {
    while (
      noteIdx <= noteEnd &&
      (music.notes[noteIdx]?.duration === Duration.GRACE ||
        music.notes[noteIdx]?.duration === Duration.GRACE_SLASH ||
        (music.notes[noteIdx]?.pitches.length ?? 1) === 0)
    ) {
      noteIdx++;
    }
  }

  skipNonLyricNotes();

  while (tokenIdx < tokens.length && noteIdx <= noteEnd) {
    const token = tokens[tokenIdx++];
    if (token.type === 'syllable') {
      music.lyrics[verse][noteIdx] = token.text;
      noteIdx++;
      skipNonLyricNotes();
    } else if (token.type === 'skip' || token.type === 'hold') {
      noteIdx++;
      skipNonLyricNotes();
    } else if (token.type === 'bar') {
      // Find the barline that ends the bar containing the last assigned note.
      // Per the ABC spec: if there are fewer syllables than notes in the bar,
      // advance to the next bar; if syllables already filled the bar, ignore |.
      const lastAssigned = noteIdx - 1;
      const barline = music.bars.find(
        (bar) =>
          bar.afterNoteNum !== undefined && bar.afterNoteNum >= lastAssigned
      );
      if (barline !== undefined && noteIdx <= barline.afterNoteNum!) {
        noteIdx = barline.afterNoteNum! + 1;
        skipNonLyricNotes();
      }
      // else: already past this barline — | is ignored per spec
    }
  }
}

export function fromAbc(
  text: string,
  defaultClef: Music['clef'] = 'treble',
  defaultMiddle?: string
): Music {
  const music = new Music();
  const lines = text.split(/\r?\n/).map(stripComment);

  const { sections, headerLines, endLyricLines } = buildSections(lines);

  const { defaultDuration, keyAdjustment, isFreeTime, pitchShift } =
    parseHeaders(headerLines, music, defaultClef, defaultMiddle);

  // Parse each section's score lines, tracking the note range produced
  const sectionNoteRanges: [number, number][] = [];
  for (const section of sections) {
    const noteStart = music.notes.length;
    const tokens = tokenize(section.scoreLines.join(''));
    parseScore(tokens, music, defaultDuration, keyAdjustment, isFreeTime);
    sectionNoteRanges.push([noteStart, music.notes.length - 1]);
  }

  // Assign lyrics verse by verse across all sections
  const maxVerses = Math.max(...sections.map((s) => s.verseLyrics.length), 0);
  for (let verse = 0; verse < maxVerses; verse++) {
    for (let si = 0; si < sections.length; si++) {
      const verseText = sections[si].verseLyrics[verse];
      if (!verseText) continue;
      const [noteStart, noteEnd] = sectionNoteRanges[si];
      const lyricTokens = parseLyricTokens(verseText);
      assignLyricsToNotes(music, lyricTokens, verse, noteStart, noteEnd);
    }
  }

  if (endLyricLines.length > 0) {
    music.endLyrics = expandMnemonics(endLyricLines.join('\n'));
  }

  const totalShift =
    pitchShift +
    (music.clef === 'treble8va' || music.clef === 'bass8va' ? 12 : 0);
  if (totalShift !== 0) {
    for (const note of music.notes) {
      note.pitches = note.pitches.map((p) => p + totalShift);
    }
  }
  return music;
}

/**
 * Parse a fragment of ABC score text (notes, bar lines, etc.) using the
 * header context (key signature, default duration) from a full ABC tune.
 * Returns the parsed Music object and the key signature string for export.
 */
export function parseFragment(
  fragment: string,
  fullAbc: string
): { music: Music; keySignature: string; defaultDuration: Duration } {
  const headerMusic = new Music();
  const lines = fullAbc.split(/\r?\n/).map((l) => {
    return stripComment(l);
  });
  const { defaultDuration, keyAdjustment, pitchShift } = parseHeaders(
    lines,
    headerMusic
  );

  const music = new Music();
  music.signatures[0].keySignature = headerMusic.signatures[0].keySignature;
  music.signatures[0].beatsPerBar = headerMusic.signatures[0].beatsPerBar;
  music.signatures[0].beatValue = headerMusic.signatures[0].beatValue;
  const tokens = tokenize(fragment);
  parseScore(tokens, music, defaultDuration, keyAdjustment);

  if (pitchShift !== 0) {
    for (const note of music.notes) {
      note.pitches = note.pitches.map((p) => p + pitchShift);
    }
  }

  return {
    music,
    keySignature: headerMusic.signatures[0].keySignature,
    defaultDuration,
  };
}

/** Split a multi-tune ABC file into individual tunes with their titles. */
export function parseAbcFile(text: string): { title: string; abc: string }[] {
  const tuneTexts = text.split(/(?=^X:\s*\d+)/m).filter((t) => t.trim());
  return tuneTexts.map((abc) => {
    const titleMatch = abc.match(/^T:\s*(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
    return { title, abc: abc.trim() };
  });
}
