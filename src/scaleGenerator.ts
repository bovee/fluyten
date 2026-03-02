import { type RecorderType } from './instrument';
import { type UserSong } from './store';

export interface ScaleOptions {
  keys: string[];
  range: 'traditional' | 'all';
  direction: 'ascending' | 'descending' | 'both';
  instrumentType?: RecorderType;
  formatTitle?: (key: string) => string;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

// Convert a letter + MIDI octave number to an ABC note name.
// C4 = 'C', C5 = 'c', C6 = "c'", C3 = 'C,', etc.
function abcNote(letter: string, octave: number): string {
  if (octave >= 5) {
    return letter.toLowerCase() + "'".repeat(octave - 5);
  } else if (octave === 4) {
    return letter.toUpperCase();
  } else {
    return letter.toUpperCase() + ','.repeat(4 - octave);
  }
}

// Generate `count` ascending scale-degree note names starting at a given letter and octave.
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

function formatTitle(key: string): string {
  const isMinor = key.endsWith('m');
  let display = isMinor ? key.slice(0, -1) : key;
  display = display.replace('#', '♯').replace('b', '♭');
  return `${display} ${isMinor ? 'Minor' : 'Major'} Scale`;
}

function formatAbcNotes(notes: string[]): string {
  const groups: string[] = [];
  for (let i = 0; i < notes.length; i += 4) {
    groups.push(notes.slice(i, i + 4).join(' '));
  }
  return groups.join(' | ') + ' |';
}

export function generateScaleAbc(options: ScaleOptions): UserSong[] {
  const startNote =
    options.instrumentType === 'SOPRANO' || options.instrumentType === 'TENOR'
      ? 'C'
      : 'F';
  const startingOctave = options.instrumentType === 'BASS' ? 2 : 4;
  const allNotes = notesFromRange(startNote, startingOctave, 16);
  const clef = options.instrumentType === 'BASS' ? 'bass' : '';

  return options.keys.map((key) => {
    let notes =
      options.range === 'all'
        ? allNotes
        : notesFromRange(key[0].toUpperCase(), startingOctave, 8);

    if (options.direction === 'descending') {
      notes = [...notes].reverse();
    } else if (options.direction === 'both') {
      // ascending then descending, dedup pivot
      const desc = [...notes].reverse().slice(1);
      notes = [...notes, ...desc];
    }

    const title = (options.formatTitle ?? formatTitle)(key);
    const keyLine = clef ? `K:${key} clef=${clef}` : `K:${key}`;
    const abc = [
      `X:1`,
      `T:${title}`,
      `M:C`,
      `L:1/4`,
      keyLine,
      formatAbcNotes(notes),
    ].join('\n');

    return {
      id: crypto.randomUUID(),
      title,
      abc,
    };
  });
}
