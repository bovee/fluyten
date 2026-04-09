import { noteNameToMidi } from './audio/utils';

export type RecorderType = keyof typeof RECORDER_TYPES;

const RECORDER_PITCH_RANGE = 26;

export const RECORDER_TYPES = {
  GARKLEIN: { basePitch: 84, pitchRange: RECORDER_PITCH_RANGE },
  SOPRANINO: { basePitch: 77, pitchRange: RECORDER_PITCH_RANGE },
  SOPRANO: { basePitch: 72, pitchRange: RECORDER_PITCH_RANGE },
  ALTO: { basePitch: 65, pitchRange: RECORDER_PITCH_RANGE },
  VOICEFLUTE: { basePitch: 62, pitchRange: RECORDER_PITCH_RANGE },
  TENOR: { basePitch: 60, pitchRange: RECORDER_PITCH_RANGE },
  BASS: { basePitch: 53, pitchRange: RECORDER_PITCH_RANGE },
  GREATBASS: { basePitch: 48, pitchRange: RECORDER_PITCH_RANGE },
  CONTRABASS: { basePitch: 41, pitchRange: RECORDER_PITCH_RANGE },
};

/**
 * Returns the effective {basePitch, pitchRange} for an instrument.
 * When instrumentType is null ("Other"), parses the custom note-name strings.
 * Returns null if the custom strings are invalid or the range is non-positive.
 */
export function resolveInstrumentConfig(
  instrumentType: RecorderType | null,
  customBasePitchStr: string,
  customHighNoteStr: string
): { basePitch: number; pitchRange: number } | null {
  if (instrumentType !== null) return RECORDER_TYPES[instrumentType];
  const basePitch = noteNameToMidi(customBasePitchStr);
  const highNote = noteNameToMidi(customHighNoteStr);
  if (basePitch === null || highNote === null || highNote <= basePitch)
    return null;
  return { basePitch, pitchRange: highNote - basePitch };
}

export function getStarterBookUrl(instrumentType: RecorderType | null): string {
  if (instrumentType === null) return '';
  let basePitch = '';
  if (RECORDER_TYPES[instrumentType].basePitch % 12 === 0) basePitch = 'c';
  if (RECORDER_TYPES[instrumentType].basePitch % 12 === 5) basePitch = 'f';
  if (!basePitch) return '';
  return `${window.location.origin}${import.meta.env.BASE_URL}beginner-songs-${basePitch}.abc`;
}

export function isStarterBookUrl(url: string): boolean {
  return (
    url.endsWith('/beginner-songs-c.abc') ||
    url.endsWith('/beginner-songs-f.abc')
  );
}
