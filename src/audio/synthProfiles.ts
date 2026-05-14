// Synth profiles used by NotePlayer to give each ABC voice a distinct timbre.
//
// Each profile is a small bag of WebAudio parameters: a list of oscillator
// partials (additive synthesis), an ADSR envelope, and optional filter and
// vibrato. NotePlayer reads the profile when scheduling each note.
//
// The mapping from General MIDI program numbers to profiles is intentionally
// coarse — Fluyten only synthesizes a handful of internal timbres.

export type ProfileId =
  | 'default'
  | 'piano'
  | 'guitar'
  | 'violin'
  | 'trumpet'
  | 'oboe'
  | 'recorder';

export interface OscillatorSpec {
  type: OscillatorType;
  ratio: number;
  gain: number;
  detune?: number;
}

export interface AdsrEnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface FilterSpec {
  type: BiquadFilterType;
  frequency: number;
  Q: number;
}

export interface VibratoSpec {
  rate: number;
  depth: number;
  delay?: number;
}

export interface SynthProfile {
  id: ProfileId;
  oscillators: OscillatorSpec[];
  envelope: AdsrEnvelope;
  filter?: FilterSpec;
  vibrato?: VibratoSpec;
  /**
   * Loudness compensation for low pitches. Below `refFreq` Hz, gain is scaled
   * by `(refFreq / freq) ** exponent`. Used to counteract the equal-loudness
   * contour for sine-heavy timbres (piano, recorder) whose bass notes sound
   * much quieter than treble notes at the same amplitude. Harmonic-rich
   * timbres (oboe, brass) already carry energy into the ear's sensitive band
   * via their upper partials and don't need this.
   */
  bassBoost?: { refFreq: number; exponent: number };
}

const PIANO_PROFILE: SynthProfile = {
  id: 'piano',
  oscillators: [
    { type: 'sine', ratio: 1, gain: 1.0 },
    { type: 'triangle', ratio: 1, gain: 0.25 },
    { type: 'sine', ratio: 2, gain: 0.35 },
    { type: 'sine', ratio: 3, gain: 0.18 },
    { type: 'sine', ratio: 4, gain: 0.1 },
  ],
  envelope: { attack: 0.005, decay: 1.8, sustain: 0.35, release: 0.3 },
  bassBoost: { refFreq: 500, exponent: 0.5 },
};

const GUITAR_PROFILE: SynthProfile = {
  id: 'guitar',
  oscillators: [
    { type: 'triangle', ratio: 1, gain: 0.7 },
    { type: 'sawtooth', ratio: 1, gain: 0.3 },
    { type: 'triangle', ratio: 2, gain: 0.15 },
  ],
  envelope: { attack: 0.005, decay: 0.6, sustain: 0.1, release: 0.4 },
  filter: { type: 'lowpass', frequency: 3000, Q: 0.7 },
};

const VIOLIN_PROFILE: SynthProfile = {
  id: 'violin',
  // A sawtooth already contains every harmonic — adding a 2x sawtooth on top
  // doubles the upper partials and sounds tinny. Use two slightly detuned
  // sawtooths for an ensemble shimmer plus a triangle for low-mid warmth,
  // then a gentle lowpass to tame the top so it isn't buzzy.
  // Single sawtooth + triangle at unison so this folds into one PeriodicWave
  // (one oscillator per pitch). Vibrato + the body-resonance filter carry the
  // perceived "richness" instead of detune chorusing.
  oscillators: [
    { type: 'sawtooth', ratio: 1, gain: 0.7 },
    { type: 'triangle', ratio: 1, gain: 0.55 },
  ],
  envelope: { attack: 0.1, decay: 0.1, sustain: 0.85, release: 0.25 },
  filter: { type: 'lowpass', frequency: 2800, Q: 1.2 },
  vibrato: { rate: 5.5, depth: 12, delay: 0.2 },
};

const TRUMPET_PROFILE: SynthProfile = {
  id: 'trumpet',
  oscillators: [
    { type: 'sawtooth', ratio: 1, gain: 0.6 },
    { type: 'sawtooth', ratio: 2, gain: 0.3 },
    { type: 'square', ratio: 3, gain: 0.12 },
  ],
  envelope: { attack: 0.04, decay: 0.05, sustain: 0.9, release: 0.1 },
  filter: { type: 'bandpass', frequency: 1500, Q: 2 },
};

const OBOE_PROFILE: SynthProfile = {
  id: 'oboe',
  oscillators: [
    { type: 'sawtooth', ratio: 1, gain: 0.5 },
    { type: 'square', ratio: 1, gain: 0.4 },
    { type: 'sawtooth', ratio: 2, gain: 0.2 },
  ],
  envelope: { attack: 0.05, decay: 0.05, sustain: 0.85, release: 0.15 },
  filter: { type: 'lowpass', frequency: 2200, Q: 4 },
  vibrato: { rate: 6, depth: 12, delay: 0.3 },
};

const RECORDER_PROFILE: SynthProfile = {
  id: 'recorder',
  oscillators: [
    { type: 'sine', ratio: 1, gain: 1.0 },
    { type: 'sine', ratio: 2, gain: 0.1 },
    { type: 'triangle', ratio: 1, gain: 0.05 },
  ],
  envelope: { attack: 0.06, decay: 0.05, sustain: 0.9, release: 0.12 },
  bassBoost: { refFreq: 500, exponent: 0.8 },
};

// Default falls back to the recorder timbre — Fluyten is a recorder app, so
// any voice without a %%MIDI hint should sound like one.
const DEFAULT_PROFILE: SynthProfile = { ...RECORDER_PROFILE, id: 'default' };

export const SYNTH_PROFILES: Record<ProfileId, SynthProfile> = {
  default: DEFAULT_PROFILE,
  piano: PIANO_PROFILE,
  guitar: GUITAR_PROFILE,
  violin: VIOLIN_PROFILE,
  trumpet: TRUMPET_PROFILE,
  oboe: OBOE_PROFILE,
  recorder: RECORDER_PROFILE,
};

// Fold all the profile's partials into a single PeriodicWave specification —
// one fundamental + harmonic spectrum — so NotePlayer can play each pitch
// with one OscillatorNode instead of one per partial. Returns null when the
// profile uses detune or non-integer ratios (we'd need separate oscillators
// for those), in which case NotePlayer falls back to per-partial synthesis.
export function buildHarmonicSpectrum(
  profile: SynthProfile,
  maxHarmonic: number = 32
): { real: Float32Array; imag: Float32Array } | null {
  for (const spec of profile.oscillators) {
    if (!Number.isInteger(spec.ratio) || spec.ratio < 1) return null;
    if (spec.detune !== undefined && spec.detune !== 0) return null;
  }
  const real = new Float32Array(maxHarmonic + 1);
  const imag = new Float32Array(maxHarmonic + 1);
  for (const spec of profile.oscillators) {
    const r = spec.ratio;
    const g = spec.gain;
    switch (spec.type) {
      case 'sine': {
        if (r <= maxHarmonic) imag[r] += g;
        break;
      }
      case 'sawtooth': {
        // (2/π) Σ_{n=1..} (-1)^(n+1) (1/n) sin(nωt)
        for (let n = 1; n * r <= maxHarmonic; n++) {
          imag[n * r] += (g * (2 / Math.PI) * (n % 2 === 1 ? 1 : -1)) / n;
        }
        break;
      }
      case 'square': {
        // (4/π) Σ_{n odd} (1/n) sin(nωt)
        for (let n = 1; n * r <= maxHarmonic; n += 2) {
          imag[n * r] += (g * (4 / Math.PI)) / n;
        }
        break;
      }
      case 'triangle': {
        // (8/π²) Σ_{k=0..} (-1)^k / (2k+1)² sin((2k+1)ωt)
        for (let k = 0; (2 * k + 1) * r <= maxHarmonic; k++) {
          const n = 2 * k + 1;
          imag[n * r] +=
            (g * (8 / (Math.PI * Math.PI)) * (k % 2 === 0 ? 1 : -1)) / (n * n);
        }
        break;
      }
    }
  }
  return { real, imag };
}

// Bucket a General MIDI program number (1..128) into one of the internal
// profiles. Anything out of range falls back to the default timbre.
export function getSynthProfileForGmInstrument(
  gm: number | undefined
): SynthProfile {
  if (gm === undefined || !Number.isFinite(gm) || gm < 1 || gm > 128) {
    return DEFAULT_PROFILE;
  }
  if (gm <= 24) return PIANO_PROFILE;
  if (gm <= 40) return GUITAR_PROFILE;
  if (gm <= 48) return VIOLIN_PROFILE;
  if (gm <= 56) return DEFAULT_PROFILE;
  if (gm <= 64) return TRUMPET_PROFILE;
  if (gm <= 72) return OBOE_PROFILE;
  if (gm <= 80) return RECORDER_PROFILE;
  return DEFAULT_PROFILE;
}
