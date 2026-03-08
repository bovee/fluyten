// Duration constants in ticks
// These represent note durations where 4096 ticks = 1 whole note
export const DURATION_TICKS = {
  WHOLE: 4096,
  HALF: 2048,
  QUARTER: 1024,
  EIGHTH: 512,
  SIXTEENTH: 256,
  // Dotted notes (1.5x base duration)
  HALF_DOTTED: 3072,
  QUARTER_DOTTED: 1536,
  EIGHTH_DOTTED: 768,
  SIXTEENTH_DOTTED: 384,
  // Triplet notes (2/3 of base duration)
  HALF_TRIPLET: 1365,
  QUARTER_TRIPLET: 683,
  EIGHTH_TRIPLET: 341,
  SIXTEENTH_TRIPLET: 171,
} as const;

// Note values to MIDI pitch offsets
// C=0, C#/Db=1, D=2, etc. within an octave
export const NOTE_VALUES = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
  // Rests
  X: -1,
  Z: -1,
} as const;

// Maps duration ticks to Vexflow duration strings
export const VEXFLOW_DURATION_MAP: { [key: number]: string } = {
  [DURATION_TICKS.WHOLE]: 'w',
  [DURATION_TICKS.HALF_DOTTED]: 'hd',
  [DURATION_TICKS.HALF]: 'h',
  [DURATION_TICKS.QUARTER_DOTTED]: 'qd',
  [DURATION_TICKS.QUARTER]: 'q',
  [DURATION_TICKS.EIGHTH_DOTTED]: '8d',
  [DURATION_TICKS.EIGHTH]: '8',
  [DURATION_TICKS.SIXTEENTH_DOTTED]: '16d',
  [DURATION_TICKS.SIXTEENTH]: '16',
  // Triplet notes
  [DURATION_TICKS.HALF_TRIPLET]: 'h',
  [DURATION_TICKS.QUARTER_TRIPLET]: 'q',
  [DURATION_TICKS.EIGHTH_TRIPLET]: '8',
  [DURATION_TICKS.SIXTEENTH_TRIPLET]: '16',
};

// Pitch to Vexflow note name mapping (chromatic scale)
export const PITCH_TO_VEXFLOW = {
  0: 'c',
  1: 'd', // C# or Db
  2: 'd',
  3: 'e', // D# or Eb
  4: 'e',
  5: 'f',
  6: 'g', // F# or Gb
  7: 'g',
  8: 'a', // G# or Ab
  9: 'a',
  10: 'b', // A# or Bb
  11: 'b',
} as const;

// Pitch conversion constants
export const PITCH_CONSTANTS = {
  // Standard tuning: A4 = 440 Hz
  CONCERT_A4_FREQ: 440,
  // MIDI pitch value for A4
  MIDI_A4: 69,
  // Octave offset for pitch calculations
  // Used to convert chromatic pitch (0-11 + octave*12) to absolute pitch
  OCTAVE_OFFSET: 24,
  // Semitones per octave
  SEMITONES_PER_OCTAVE: 12,
  // Vexflow octave offset (Vexflow uses octave - 1)
  VEXFLOW_OCTAVE_OFFSET: 1,
} as const;

// Frequency tracker constants
export const FREQUENCY_TRACKER_CONSTANTS = {
  // Buffer size for time-domain PCM data
  FFT_SIZE: 4096,
  // RMS silence threshold (0–1 float range); signals below this are ignored
  MIN_RMS: 0.01,
  // MPM key-maximum threshold: accept the first NSDF peak whose value is at
  // least this fraction of the global peak. Prevents octave errors.
  // 0.8 is the value from the original McLeod & Wyvill paper.
  MPM_CLARITY_THRESHOLD: 0.8,
} as const;

// Note names in chromatic order (C=0 through B=11)
export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

// Time signature constants
export const TIME_SIGNATURES = {
  COMMON_TIME: {
    beatsPerBar: 4,
    beatValue: 4,
  },
  CUT_TIME: {
    beatsPerBar: 2,
    beatValue: 2,
  },
} as const;
