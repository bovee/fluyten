export interface Instrument {
  lowNote: number;
  highNote: number;
  tuning: number;
}

export type RecorderType = keyof typeof RECORDER_TYPES;

export const RECORDER_TYPES = {
  ALL: {
    lowNote: 174.6141,
    highNote: 3135.963,
  },
  BASS: {
    lowNote: 174.6141, // F3
    highNote: 783.9909, // G5
  },
  TENOR: {
    lowNote: 261.6256, // C4
    highNote: 1108.731, // D6
  },
  ALTO: {
    lowNote: 349.2282, // F4
    highNote: 1567.982, // G6
  },
  SOPRANO: {
    lowNote: 523.2511, // C5
    highNote: 2217.461, // D7
  },
  SOPRANINO: {
    lowNote: 698.4565, // F5
    highNote: 3135.963, // G7
  },
};
