export type RecorderType = keyof typeof RECORDER_TYPES;

export const RECORDER_TYPES = {
  ALL: {
    lowNote: 174.6141,
    highNote: 3135.963,
    starterBook: 'beginner-songs-c.abc',
    basePitch: 0,
  },
  BASS: {
    lowNote: 174.6141, // F3
    highNote: 783.9909, // G5
    starterBook: 'beginner-songs-f.abc',
    basePitch: 52,
  },
  TENOR: {
    lowNote: 261.6256, // C4
    highNote: 1108.731, // D6
    starterBook: 'beginner-songs-c.abc',
    basePitch: 59,
  },
  ALTO: {
    lowNote: 349.2282, // F4
    highNote: 1567.982, // G6
    starterBook: 'beginner-songs-f.abc',
    basePitch: 64,
  },
  SOPRANO: {
    lowNote: 523.2511, // C5
    highNote: 2217.461, // D7
    starterBook: 'beginner-songs-c.abc',
    basePitch: 71,
  },
  SOPRANINO: {
    lowNote: 698.4565, // F5
    highNote: 3135.963, // G7
    starterBook: 'beginner-songs-f.abc',
    basePitch: 76,
  },
};

export function getStarterBookUrl(instrumentType: RecorderType): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}${RECORDER_TYPES[instrumentType].starterBook}`;
}

export function isStarterBookUrl(url: string): boolean {
  return Object.values(RECORDER_TYPES).some((rt) =>
    url.endsWith(rt.starterBook)
  );
}
