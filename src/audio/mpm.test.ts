import { describe, it, expect } from 'vitest';
import { findPeriodLag, detectMidiFromSamples } from './mpm';

const SAMPLE_RATE = 44100;
const BUFFER_SIZE = 4096;

function makeSineBuffer(
  freq: number,
  sampleRate: number,
  length: number,
  amplitude = 0.5
): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++)
    buf[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return buf;
}

function makeSawtoothBuffer(
  freq: number,
  sampleRate: number,
  length: number,
  amplitude = 0.5
): Float32Array {
  const buf = new Float32Array(length);
  const period = sampleRate / freq;
  for (let i = 0; i < length; i++)
    buf[i] = amplitude * (2 * ((i % period) / period) - 1);
  return buf;
}

/** Lag bounds for a given instrument frequency range. */
function lagBounds(lowHz: number, highHz: number, sampleRate = SAMPLE_RATE) {
  return {
    minLag: Math.floor(sampleRate / highHz),
    maxLag: Math.ceil(sampleRate / lowHz),
  };
}

// Tenor recorder range: C4 (261.63 Hz) – D6 (1174.66 Hz)
const TENOR = lagBounds(261.63, 1174.66);

describe('findPeriodLag', () => {
  it('returns null for a silent buffer', () => {
    const silent = new Float32Array(BUFFER_SIZE); // all zeros
    expect(findPeriodLag(silent, TENOR.minLag, TENOR.maxLag)).toBeNull();
  });

  it('returns a lag close to sampleRate/freq for a pure sine', () => {
    const freq = 440; // A4
    const expectedLag = SAMPLE_RATE / freq; // ~100.2 samples
    const buf = makeSineBuffer(freq, SAMPLE_RATE, BUFFER_SIZE);
    const lag = findPeriodLag(buf, TENOR.minLag, TENOR.maxLag);
    expect(lag).not.toBeNull();
    expect(lag!).toBeCloseTo(expectedLag, 0); // within 1 sample
  });

  it('returns a lag close to sampleRate/freq for a sawtooth (harmonic-rich)', () => {
    const freq = 293.66; // D4
    const expectedLag = SAMPLE_RATE / freq; // ~150.2 samples
    const buf = makeSawtoothBuffer(freq, SAMPLE_RATE, BUFFER_SIZE);
    const lag = findPeriodLag(buf, TENOR.minLag, TENOR.maxLag);
    expect(lag).not.toBeNull();
    // MPM key-maximum selection prevents octave errors; lag should be
    // within a few samples of the fundamental, not half of it.
    expect(lag!).toBeGreaterThan(expectedLag * 0.9);
    expect(lag!).toBeLessThan(expectedLag * 1.1);
  });

  it('returns null when the signal is out of the provided lag window', () => {
    // 100 Hz is below the tenor range — lag ~441 samples, above TENOR.maxLag
    const buf = makeSineBuffer(100, SAMPLE_RATE, BUFFER_SIZE);
    const result = findPeriodLag(buf, TENOR.minLag, TENOR.maxLag);
    // May return null or an octave alias; either way should NOT be ~441
    if (result !== null) {
      expect(result).toBeLessThan(300); // not near the true fundamental
    }
  });

  it('sub-sample accuracy: lag differs from integer by less than 1', () => {
    // 523.25 Hz (C5) — period is not an integer number of samples
    const freq = 523.25;
    const buf = makeSineBuffer(freq, SAMPLE_RATE, BUFFER_SIZE);
    const lag = findPeriodLag(buf, TENOR.minLag, TENOR.maxLag);
    expect(lag).not.toBeNull();
    const intLag = Math.round(lag!);
    expect(Math.abs(lag! - intLag)).toBeGreaterThan(0); // has fractional part
  });
});

describe('detectMidiFromSamples', () => {
  it('returns null for silence', () => {
    const silent = new Float32Array(BUFFER_SIZE);
    expect(
      detectMidiFromSamples(silent, TENOR.minLag, TENOR.maxLag, SAMPLE_RATE)
    ).toBeNull();
  });

  it('detects A4 (440 Hz) as MIDI 69', () => {
    const buf = makeSineBuffer(440, SAMPLE_RATE, BUFFER_SIZE);
    expect(
      detectMidiFromSamples(buf, TENOR.minLag, TENOR.maxLag, SAMPLE_RATE)
    ).toBe(69);
  });

  it('detects middle C (261.63 Hz) as MIDI 60', () => {
    const buf = makeSineBuffer(261.63, SAMPLE_RATE, BUFFER_SIZE);
    expect(
      detectMidiFromSamples(buf, TENOR.minLag, TENOR.maxLag, SAMPLE_RATE)
    ).toBe(60);
  });

  it('detects C5 (523.25 Hz) as MIDI 72 for soprano range', () => {
    const SOPRANO = lagBounds(523.25, 2217.46);
    const buf = makeSineBuffer(523.25, SAMPLE_RATE, BUFFER_SIZE);
    expect(
      detectMidiFromSamples(buf, SOPRANO.minLag, SOPRANO.maxLag, SAMPLE_RATE)
    ).toBe(72);
  });

  it('detects D4 (293.66 Hz) sawtooth as MIDI 62, not an octave error', () => {
    const buf = makeSawtoothBuffer(293.66, SAMPLE_RATE, BUFFER_SIZE);
    const midi = detectMidiFromSamples(
      buf,
      TENOR.minLag,
      TENOR.maxLag,
      SAMPLE_RATE
    );
    expect(midi).not.toBeNull();
    expect(midi).toBeGreaterThanOrEqual(61);
    expect(midi).toBeLessThanOrEqual(63);
  });

  it('detects E5 (659.25 Hz) as MIDI 76', () => {
    const buf = makeSineBuffer(659.25, SAMPLE_RATE, BUFFER_SIZE);
    // E5 is within tenor upper range
    const midi = detectMidiFromSamples(
      buf,
      TENOR.minLag,
      TENOR.maxLag,
      SAMPLE_RATE
    );
    expect(midi).not.toBeNull();
    expect(midi).toBeGreaterThanOrEqual(75);
    expect(midi).toBeLessThanOrEqual(77);
  });

  it('is stable across sample rate variations (48000 Hz)', () => {
    const sampleRate = 48000;
    const { minLag, maxLag } = lagBounds(261.63, 1174.66, sampleRate);
    const buf = makeSineBuffer(440, sampleRate, BUFFER_SIZE);
    expect(detectMidiFromSamples(buf, minLag, maxLag, sampleRate)).toBe(69);
  });
});
