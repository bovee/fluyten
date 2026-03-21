export type RecorderType = keyof typeof RECORDER_TYPES;

export const RECORDER_TYPES = {
  ALL: {
    lowNote: 174.6141,
    highNote: 3135.963,
    starterBook: 'beginner-songs-soprano.abc',
  },
  BASS: {
    lowNote: 174.6141, // F3
    highNote: 783.9909, // G5
    starterBook: 'beginner-songs-bass.abc',
  },
  TENOR: {
    lowNote: 261.6256, // C4
    highNote: 1108.731, // D6
    starterBook: 'beginner-songs-soprano.abc',
  },
  ALTO: {
    lowNote: 349.2282, // F4
    highNote: 1567.982, // G6
    starterBook: 'beginner-songs-alto.abc',
  },
  SOPRANO: {
    lowNote: 523.2511, // C5
    highNote: 2217.461, // D7
    starterBook: 'beginner-songs-soprano.abc',
  },
  SOPRANINO: {
    lowNote: 698.4565, // F5
    highNote: 3135.963, // G7
    starterBook: 'beginner-songs-alto.abc',
  },
};

export function getStarterBookUrl(instrumentType: RecorderType): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${RECORDER_TYPES[instrumentType].starterBook}`;
}
