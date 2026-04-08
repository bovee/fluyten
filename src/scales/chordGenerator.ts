import { RECORDER_TYPES, type RecorderType } from '../instrument';
import { abcNote, explicitAccidental, keyAccidentalMap } from './abcUtils';

export interface ChordDef {
  /** Display name used as the tune title (e.g. "G7", "B°7"). */
  name: string;
  /** Note letters with ABC accidental prefix in C-major context,
   *  listed in ascending order, e.g. ["^F", "A", "^C"]. */
  notes: string[];
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

/** Build a ChordDef from a root note name (e.g. "Bb", "F#") and semitone intervals.
 *  Notes are spelled using tertian voice-leading: each successive note advances
 *  two letter positions, with accidentals derived from the interval. */
export function buildChord(root: string, intervals: number[]): string[] {
  const letter = root[0].toUpperCase();
  const acc = root[1] === '#' ? 1 : root[1] === 'b' ? -1 : 0;
  const rootSemi = ((LETTER_SEMITONE[letter] ?? 0) + acc + 12) % 12;
  const rootIdx = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
  return intervals.map((interval, i) => {
    const li = (rootIdx + i * 2) % 7;
    const noteLetter = LETTERS[li];
    const naturalSemi = LETTER_SEMITONE[noteLetter];
    const targetSemi = (rootSemi + interval) % 12;
    let diff = targetSemi - naturalSemi;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    const prefix =
      diff === 2
        ? '^^'
        : diff === 1
          ? '^'
          : diff === -1
            ? '_'
            : diff === -2
              ? '__'
              : '';
    return prefix + noteLetter;
  });
}

export function parseNoteAcc(note: string): { letter: string; acc: number } {
  if (note[0] === '^') return { letter: note[1].toUpperCase(), acc: 1 };
  if (note[0] === '_') return { letter: note[1].toUpperCase(), acc: -1 };
  return { letter: note[0].toUpperCase(), acc: 0 };
}

const LETTER_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

type OctavedNote = { letter: string; acc: number; octave: number };

/** Enumerate every chord tone that falls within [lowMidi, highMidi], ascending.
 *  Naturally produces inversions — starts on whichever chord tone is lowest in range. */
function chordTonesInRange(
  chord: ChordDef,
  lowMidi: number,
  highMidi: number
): OctavedNote[] {
  // Map each chord-tone semitone to its spelled {letter, acc}
  const semiToNote: Record<number, { letter: string; acc: number }> = {};
  for (const note of chord.notes) {
    const { letter, acc } = parseNoteAcc(note);
    const semi = ((LETTER_SEMITONE[letter] ?? 0) + acc + 12) % 12;
    semiToNote[semi] = { letter, acc };
  }

  const result: OctavedNote[] = [];
  for (let midi = lowMidi; midi <= highMidi; midi++) {
    const entry = semiToNote[midi % 12];
    if (entry) {
      result.push({ ...entry, octave: Math.floor(midi / 12) - 1 });
    }
  }
  return result;
}

// Default MIDI range when no specific instrument is known: tenor range
const DEFAULT_LOW_MIDI = 60; // C4
const DEFAULT_HIGH_MIDI = 85; // ~C#6

/** Return the written-notation MIDI range for an instrument.
 *  Soprano is notated identically to tenor (sounds an octave higher but written the same).
 *  Sopranino is notated identically to alto. */
function notationMidiRange(instrumentType: RecorderType): {
  lowMidi: number;
  highMidi: number;
} {
  const notationType =
    instrumentType === 'SOPRANO'
      ? 'TENOR'
      : instrumentType === 'SOPRANINO'
        ? 'ALTO'
        : instrumentType;
  const { basePitch, pitchRange } = RECORDER_TYPES[notationType];
  return { lowMidi: basePitch, highMidi: basePitch + pitchRange };
}

export function generateChordAbc(options: {
  chord: ChordDef;
  range: 'traditional' | 'all';
  direction: 'ascending' | 'descending' | 'random';
  instrumentType?: RecorderType;
  songKey?: string;
}): string {
  const songMap = options.songKey ? keyAccidentalMap(options.songKey) : {};

  // Letter → accidental map for this chord (C-major context), used for key-relative output
  const chordMap: Record<string, number> = {};
  for (const note of options.chord.notes) {
    const { letter, acc } = parseNoteAcc(note);
    chordMap[letter] = acc;
  }

  let lowMidi: number;
  let highMidi: number;
  if (options.instrumentType) {
    ({ lowMidi, highMidi } = notationMidiRange(options.instrumentType));
  } else {
    lowMidi = DEFAULT_LOW_MIDI;
    highMidi = DEFAULT_HIGH_MIDI;
  }
  let octaved: OctavedNote[];
  if (options.range === 'traditional') {
    // Use the same starting octave as scaleGenerator so the arpeggio begins
    // at the same register as the scale (octave 2 for bass, 4 for everything else).
    const startingOctave = options.instrumentType === 'BASS' ? 2 : 4;
    const { letter: rootLetter0, acc: rootAcc } = parseNoteAcc(
      options.chord.notes[0]
    );
    const startMidi =
      (startingOctave + 1) * 12 +
      (((LETTER_SEMITONE[rootLetter0] ?? 0) + rootAcc + 12) % 12);
    octaved = chordTonesInRange(options.chord, startMidi, startMidi + 11);
  } else {
    octaved = chordTonesInRange(options.chord, lowMidi, highMidi);
  }

  if (options.direction === 'descending') {
    octaved = [...octaved].reverse();
  } else if (options.direction === 'random') {
    octaved = [...octaved];
    for (let i = octaved.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [octaved[i], octaved[j]] = [octaved[j], octaved[i]];
    }
  }

  return octaved
    .map(
      ({ letter, octave }) =>
        explicitAccidental(letter, chordMap, songMap) + abcNote(letter, octave)
    )
    .join(' ');
}
