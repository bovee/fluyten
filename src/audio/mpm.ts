/**
 * McLeod Pitch Method (MPM) core implementation.
 *
 * Shared between FrequencyTracker (main thread, full instrument range) and
 * mpm.worker.ts (Worker thread, full range off the hot path).
 */

import { PITCH_CONSTANTS, FREQUENCY_TRACKER_CONSTANTS } from '../constants';

/**
 * Run MPM on `samples` over the lag range [minLag, maxLag].
 * Returns the detected MIDI pitch (rounded to nearest semitone), or null if
 * no clear periodic signal is found.
 */
export function detectMidiFromSamples(
  samples: Float32Array,
  minLag: number,
  maxLag: number,
  sampleRate: number
): number | null {
  const lag = findPeriodLag(samples, minLag, maxLag);
  if (lag === null) return null;
  const freq = sampleRate / lag;
  const { CONCERT_A4_FREQ, MIDI_A4, SEMITONES_PER_OCTAVE } = PITCH_CONSTANTS;
  return Math.round(
    SEMITONES_PER_OCTAVE * Math.log2(freq / CONCERT_A4_FREQ) + MIDI_A4
  );
}

/**
 * Run MPM on `samples` over the lag range [minLag, maxLag].
 * Returns the fundamental period in samples (with sub-sample accuracy via
 * parabolic interpolation), or null if no clear peak is found.
 */
export function findPeriodLag(
  samples: Float32Array,
  minLag: number,
  maxLag: number
): number | null {
  const N = samples.length;
  const nsdf = new Float32Array(maxLag + 1);

  // Normalized Square Difference Function:
  // nsdf[τ] = 2·Σ x[j]·x[j+τ] / (Σ x[j]² + Σ x[j+τ]²)
  for (let tau = minLag; tau <= maxLag; tau++) {
    let num = 0;
    let denomA = 0;
    let denomB = 0;
    const len = N - tau;
    for (let j = 0; j < len; j++) {
      num += samples[j] * samples[j + tau];
      denomA += samples[j] * samples[j];
      denomB += samples[j + tau] * samples[j + tau];
    }
    const denom = denomA + denomB;
    nsdf[tau] = denom < 1e-10 ? 0 : (2 * num) / denom;
  }

  // Find positive-going peaks: cross zero upward, reach local max, cross down.
  let keyMax = -Infinity;
  const peaks: Array<{ lag: number; value: number }> = [];
  let tau = minLag;
  while (tau <= maxLag && nsdf[tau] > 0) tau++;
  while (tau <= maxLag) {
    while (tau <= maxLag && nsdf[tau] <= 0) tau++;
    if (tau > maxLag) break;
    let peakLag = tau;
    let peakVal = nsdf[tau];
    while (tau <= maxLag && nsdf[tau] > 0) {
      if (nsdf[tau] > peakVal) {
        peakVal = nsdf[tau];
        peakLag = tau;
      }
      tau++;
    }
    peaks.push({ lag: peakLag, value: peakVal });
    if (peakVal > keyMax) keyMax = peakVal;
  }

  if (peaks.length === 0) return null;

  // Key maximum selection: first peak ≥ threshold × keyMax prevents octave errors.
  const threshold = FREQUENCY_TRACKER_CONSTANTS.MPM_CLARITY_THRESHOLD * keyMax;
  const chosen = peaks.find((p) => p.value >= threshold);
  if (!chosen) return null;

  // Parabolic interpolation for sub-sample accuracy.
  const t = chosen.lag;
  if (t > minLag && t < maxLag) {
    const y0 = nsdf[t - 1];
    const y1 = nsdf[t];
    const y2 = nsdf[t + 1];
    const denom = 2 * (2 * y1 - y0 - y2);
    if (Math.abs(denom) > 1e-10) return t + (y2 - y0) / denom;
  }
  return t;
}
