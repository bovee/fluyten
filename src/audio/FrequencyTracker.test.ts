/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freqToMidiPitch, FrequencyTracker } from './FrequencyTracker';

/** Generate a pure sine wave buffer at the given frequency. */
function makeSineBuffer(
  freq: number,
  sampleRate: number,
  length: number,
  amplitude = 0.5
): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buf;
}

/** Generate a sawtooth wave (rich in harmonics) at the given frequency. */
function makeSawtoothBuffer(
  freq: number,
  sampleRate: number,
  length: number,
  amplitude = 0.5
): Float32Array {
  const buf = new Float32Array(length);
  const period = sampleRate / freq;
  for (let i = 0; i < length; i++) {
    buf[i] = amplitude * (2 * ((i % period) / period) - 1);
  }
  return buf;
}

describe('freqToMidiPitch', () => {
  it('should convert A440 to MIDI pitch 69', () => {
    expect(freqToMidiPitch(440)).toBe(69);
  });

  it('should convert A220 to MIDI pitch 57', () => {
    expect(freqToMidiPitch(220)).toBe(57);
  });

  it('should convert A880 to MIDI pitch 81', () => {
    expect(freqToMidiPitch(880)).toBe(81);
  });

  it('should convert C261.63 to MIDI pitch 60 (middle C)', () => {
    expect(freqToMidiPitch(261.63)).toBe(60);
  });

  it('should handle frequencies between semitones with rounding', () => {
    const result = freqToMidiPitch(453);
    expect(result).toBeGreaterThanOrEqual(69);
    expect(result).toBeLessThanOrEqual(70);
  });

  it('should convert low frequencies', () => {
    expect(freqToMidiPitch(65.41)).toBe(36);
  });

  it('should convert high frequencies', () => {
    expect(freqToMidiPitch(4186)).toBe(108);
  });
});

describe('FrequencyTracker', () => {
  const sampleRate = 44100;
  const bufferSize = 4096;
  let tracker: FrequencyTracker;

  beforeEach(() => {
    tracker = new FrequencyTracker();
  });

  function injectAudioContext() {
    tracker.audioCtx = { currentTime: 0, sampleRate } as any;
    tracker.source = { connect: vi.fn(), disconnect: vi.fn() } as any;
  }

  function makeAnalyser(pcmData: Float32Array) {
    return {
      connect: vi.fn(),
      fftSize: bufferSize,
      getFloatTimeDomainData: vi.fn((arr: Float32Array) => arr.set(pcmData)),
    };
  }

  // Pitch range: ~C4 (260 Hz) to ~C7 (2100 Hz).
  const LOW_HZ = 260;
  const HIGH_HZ = 2100;

  describe('start', () => {
    it('initialises AudioContext, analyser, and source', async () => {
      await tracker.start();
      expect(tracker.audioCtx).toBeDefined();
      expect(tracker.analyser).toBeDefined();
      expect(tracker.source).toBeDefined();
      tracker.stop();
    });

    it('sets fftSize to the configured buffer size', async () => {
      await tracker.start();
      expect(tracker.analyser!.fftSize).toBe(4096);
      tracker.stop();
    });
  });

  describe('stop', () => {
    it('disconnects source and clears audio nodes', async () => {
      await tracker.start();
      const disconnectSpy = vi.spyOn(tracker.source!, 'disconnect');

      tracker.stop();

      expect(disconnectSpy).toHaveBeenCalled();
      expect(tracker.source).toBeUndefined();
      expect(tracker.analyser).toBeUndefined();
    });

    it('stops all media stream tracks', async () => {
      await tracker.start();
      const trackStopSpy = vi.fn();
      tracker.mediaStream = {
        getTracks: () => [{ stop: trackStopSpy }],
      } as any;

      tracker.stop();

      expect(trackStopSpy).toHaveBeenCalled();
    });
  });

  describe('checkRawFrequency', () => {
    it('returns null when audio context is not set up', () => {
      expect(tracker.checkRawFrequency(LOW_HZ, HIGH_HZ)).toBeNull();
    });

    it('returns null for silence (low RMS)', () => {
      injectAudioContext();
      tracker.analyser = makeAnalyser(
        new Float32Array(bufferSize).fill(0)
      ) as any;

      expect(tracker.checkRawFrequency(LOW_HZ, HIGH_HZ)).toBeNull();
    });

    it('detects A4 (440 Hz) from a sine wave', () => {
      injectAudioContext();
      tracker.analyser = makeAnalyser(
        makeSineBuffer(440, sampleRate, bufferSize)
      ) as any;

      const result = tracker.checkRawFrequency(LOW_HZ, HIGH_HZ);
      expect(result).not.toBeNull();
      expect(freqToMidiPitch(result!.frequency)).toBe(69);
      expect(result!.volume).toBeGreaterThan(0);
    });

    it('locks onto the fundamental of a harmonic-rich sawtooth', () => {
      // D4 (~293.66 Hz) sawtooth has strong harmonics; MPM should still
      // pick the fundamental, not an octave up.
      injectAudioContext();
      tracker.analyser = makeAnalyser(
        makeSawtoothBuffer(293.66, sampleRate, bufferSize)
      ) as any;

      const result = tracker.checkRawFrequency(LOW_HZ, HIGH_HZ);
      expect(result).not.toBeNull();
      const pitch = freqToMidiPitch(result!.frequency);
      expect(pitch).toBeGreaterThanOrEqual(61);
      expect(pitch).toBeLessThanOrEqual(63);
    });
  });
});
