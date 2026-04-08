/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SingleFrequencyTracker } from './SingleFrequencyTracker';

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

function makeAnalyser(pcmData: Float32Array) {
  return {
    fftSize: BUFFER_SIZE,
    getFloatTimeDomainData: vi.fn((arr: Float32Array) => arr.set(pcmData)),
    connect: vi.fn(),
  };
}

function injectContext(
  tracker: SingleFrequencyTracker,
  pcmData: Float32Array,
  currentTime = 0
) {
  (tracker as any).audioCtx = { currentTime, sampleRate: SAMPLE_RATE };
  (tracker as any).source = {};
  (tracker as any).analyser = makeAnalyser(pcmData);
}

describe('SingleFrequencyTracker.check()', () => {
  let tracker: SingleFrequencyTracker;

  beforeEach(() => {
    tracker = new SingleFrequencyTracker();
  });

  it('returns null when not started', () => {
    expect(tracker.check()).toBeNull();
  });

  it('returns null when started but no target set', () => {
    injectContext(tracker, new Float32Array(BUFFER_SIZE));
    expect(tracker.check()).toBeNull();
  });

  it('returns false for silence (zero buffer) even with target set', () => {
    injectContext(tracker, new Float32Array(BUFFER_SIZE));
    tracker.setTarget(69, 1.0); // A4
    expect(tracker.check()).toBe(false);
  });

  it('returns true when the target pitch is sounding', () => {
    const buf = makeSineBuffer(440, SAMPLE_RATE, BUFFER_SIZE); // A4
    injectContext(tracker, buf);
    tracker.setTarget(69, 1.0); // A4 = MIDI 69
    expect(tracker.check()).toBe(true);
  });

  it('returns false for a harmonically unrelated pitch (E3 vs A4 target)', () => {
    // E3 (164.81 Hz, lag ~268 samples) vs target A4 (440 Hz, lag ~100 samples).
    // E3's harmonics land at lags ~268, 134, 89, 67 — none inside A4's window [97–104].
    const buf = makeSineBuffer(164.81, SAMPLE_RATE, BUFFER_SIZE);
    injectContext(tracker, buf);
    tracker.setTarget(69, 1.0); // A4
    expect(tracker.check()).toBe(false);
  });

  // ── Interior-peak check (adjacent semitone rejection) ─────────────────────

  it('returns false when an adjacent semitone is playing (A#4 vs A4 target)', () => {
    // A#4 (466.16 Hz) has its NSDF peak at lag ~94.6, outside A4's window
    // [97, 104]. The NSDF enters the window still near its peak (~0.988),
    // so the window's maximum is at the left edge — rejected as non-interior.
    const buf = makeSineBuffer(466.16, SAMPLE_RATE, BUFFER_SIZE); // A#4
    injectContext(tracker, buf);
    tracker.setTarget(69, 1.0); // A4
    expect(tracker.check()).toBe(false);
  });

  it('returns false when G#4 is playing (one semitone below A4 target)', () => {
    // G#4 (415.30 Hz) has its NSDF peak at lag ~106.3, outside A4's window
    // [97, 104], so the max is at the right edge — rejected as non-interior.
    const buf = makeSineBuffer(415.3, SAMPLE_RATE, BUFFER_SIZE); // G#4
    injectContext(tracker, buf);
    tracker.setTarget(69, 1.0); // A4
    expect(tracker.check()).toBe(false);
  });

  // ── Harmonic alias rejection ───────────────────────────────────────────────

  it('returns false when one octave above the target is playing (A5 vs A4)', () => {
    // A5 (880 Hz, lag ~50 samples) has its 2nd harmonic at lag ~100 — right
    // inside A4's window. The halfLag check detects the strong NSDF at lag 50
    // and rejects the false positive.
    const buf = makeSineBuffer(880, SAMPLE_RATE, BUFFER_SIZE); // A5
    injectContext(tracker, buf);
    tracker.setTarget(69, 1.0); // A4
    expect(tracker.check()).toBe(false);
  });

  it('returns false when two octaves above the target is playing (A6 vs A4)', () => {
    // A6 (1760 Hz) has its 4th harmonic at A4's lag. The halfLag check sees
    // a strong NSDF at lag ~50 (A5's lag, also a harmonic of A6) and rejects.
    const buf = makeSineBuffer(1760, SAMPLE_RATE, BUFFER_SIZE); // A6
    injectContext(tracker, buf);
    tracker.setTarget(69, 1.0); // A4
    expect(tracker.check()).toBe(false);
  });

  it('accepts tuned-up pitch (tuning ratio > 1)', () => {
    // Tuning raised by 10 cents (~1.006×): target A4 at tuning 1.006 means
    // the expected frequency is 440 × 1.006 ≈ 442.6 Hz.
    // Playing exactly 440 Hz should fall outside the window and return false.
    const buf = makeSineBuffer(440, SAMPLE_RATE, BUFFER_SIZE);
    injectContext(tracker, buf);
    tracker.setTarget(69, 1.006); // A4 shifted up
    // 440 Hz vs expected 442.6 Hz — ~10 cents off, within ±50 cent window
    expect(tracker.check()).toBe(true);
  });

  it('returns false after setTarget is called with pitch 0', () => {
    const buf = makeSineBuffer(440, SAMPLE_RATE, BUFFER_SIZE);
    injectContext(tracker, buf);
    tracker.setTarget(69, 1.0);
    expect(tracker.check()).toBe(true);
    tracker.setTarget(0); // clear target
    expect(tracker.check()).toBeNull();
  });

  it('detects C5 (523.25 Hz) as MIDI 72', () => {
    const buf = makeSineBuffer(523.25, SAMPLE_RATE, BUFFER_SIZE);
    injectContext(tracker, buf);
    tracker.setTarget(72, 1.0); // C5
    expect(tracker.check()).toBe(true);
  });

  it('check() does not throw when analyser returns all zeros after target is set', () => {
    injectContext(tracker, new Float32Array(BUFFER_SIZE));
    tracker.setTarget(69, 1.0);
    expect(() => tracker.check()).not.toThrow();
  });
});
