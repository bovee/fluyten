import { type RecorderType } from '../instrument';
import { abcNote, explicitAccidental, keyAccidentalMap } from './abcUtils';

export interface ScaleOptions {
  key: string;
  range: 'traditional' | 'all';
  direction: 'ascending' | 'descending' | 'random';
  instrumentType?: RecorderType;
  /** Key signature already in effect in the target song (e.g. "G", "Am").
   *  When provided, notes are annotated with explicit accidentals wherever
   *  the scale's key differs from the song's key. */
  songKey?: string;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

function notesFromRange(
  startLetter: string,
  startOctave: number,
  count: number
): string[] {
  const rootIdx = LETTERS.indexOf(startLetter as (typeof LETTERS)[number]);
  const notes: string[] = [];
  let letterIdx = rootIdx;
  let octave = startOctave;
  for (let i = 0; i < count; i++) {
    notes.push(abcNote(LETTERS[letterIdx], octave));
    letterIdx++;
    if (letterIdx >= 7) {
      letterIdx = 0;
      octave++;
    }
  }
  return notes;
}

function formatAbcNotes(
  notes: string[],
  scaleMap: Record<string, number>,
  songMap: Record<string, number>
): string {
  const annotated = notes.map((note) => {
    const letter = note[0].toUpperCase();
    const prefix = explicitAccidental(letter, scaleMap, songMap);
    return prefix + note;
  });
  return annotated.join(' ');
}

/** Generate the notes-only ABC string for a scale. */
export function generateScaleAbc(options: ScaleOptions): string {
  const startNote =
    options.instrumentType === 'SOPRANO' || options.instrumentType === 'TENOR'
      ? 'C'
      : 'F';
  const startingOctave = options.instrumentType === 'BASS' ? 2 : 4;
  const allNotes = notesFromRange(startNote, startingOctave, 16);
  const songMap = options.songKey ? keyAccidentalMap(options.songKey) : {};

  let notes =
    options.range === 'all'
      ? allNotes
      : notesFromRange(options.key[0].toUpperCase(), startingOctave, 8);

  if (options.direction === 'descending') {
    notes = [...notes].reverse();
  } else if (options.direction === 'random') {
    notes = [...notes];
    for (let i = notes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [notes[i], notes[j]] = [notes[j], notes[i]];
    }
  }

  const scaleMap = keyAccidentalMap(options.key);
  return formatAbcNotes(notes, scaleMap, songMap);
}
