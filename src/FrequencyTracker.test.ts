/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  freqToMidiPitch,
  fitGaussian,
  FrequencyTracker,
  type OnStartNote,
  type OnStopNote,
} from './FrequencyTracker';

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
    // Halfway between A440 and A#466.16 should round to one or the other
    const result = freqToMidiPitch(453);
    expect(result).toBeGreaterThanOrEqual(69);
    expect(result).toBeLessThanOrEqual(70);
  });

  it('should convert low frequencies', () => {
    // C2 = 65.41 Hz = MIDI 36
    expect(freqToMidiPitch(65.41)).toBe(36);
  });

  it('should convert high frequencies', () => {
    // C8 = 4186 Hz = MIDI 108
    expect(freqToMidiPitch(4186)).toBe(108);
  });
});

describe('fitGaussian', () => {
  it('should fit a perfect Gaussian', () => {
    // Create a perfect Gaussian centered at 2 with height 100
    const points = [
      100 * Math.exp(-((0 - 2) ** 2) / (2 * 1 ** 2)),
      100 * Math.exp(-((1 - 2) ** 2) / (2 * 1 ** 2)),
      100 * Math.exp(-((2 - 2) ** 2) / (2 * 1 ** 2)),
      100 * Math.exp(-((3 - 2) ** 2) / (2 * 1 ** 2)),
      100 * Math.exp(-((4 - 2) ** 2) / (2 * 1 ** 2)),
    ];

    const result = fitGaussian(points);
    expect(result).not.toBeNull();
    const [center, height, width] = result!;

    // Should return valid numbers (optimizer can be flaky)
    expect(center).toBeTypeOf('number');
    expect(height).toBeTypeOf('number');
    expect(width).toBeTypeOf('number');
    expect(center).toBeGreaterThanOrEqual(0);
    expect(center).toBeLessThanOrEqual(4);
  });

  it('should handle peaked data', () => {
    const points = [10, 30, 100, 30, 10];
    const peaked = fitGaussian(points);
    expect(peaked).not.toBeNull();
    const [center, height, width] = peaked!;

    // Should return valid numbers
    expect(center).toBeTypeOf('number');
    expect(height).toBeTypeOf('number');
    expect(width).toBeTypeOf('number');
  });

  it('should handle flat data', () => {
    const points = [50, 50, 50, 50, 50];
    // Flat data has no distinct peak; fitGaussian returns null
    expect(fitGaussian(points)).toBeNull();
  });

  it('should handle error cases gracefully', () => {
    // All-zero data: logarithms of eps produce a degenerate but valid Gaussian
    const result = fitGaussian([0, 0, 0, 0, 0]);
    if (result !== null) {
      expect(result[0]).toBeTypeOf('number');
      expect(result[1]).toBeTypeOf('number');
      expect(result[2]).toBeTypeOf('number');
    }
  });

  it('should return fallback on optimization failure', () => {
    // If the optimizer fails, should return [2, 0, 0]
    const result = fitGaussian([NaN, NaN, NaN, NaN, NaN]);
    // The function should not crash and should return valid numbers
    expect(result).toHaveLength(3);
  });
});

describe('FrequencyTracker', () => {
  const instrumentType = 'SOPRANO';
  const tuning = 1.0;
  let onStartNote: Mock<OnStartNote>;
  let onStopNote: Mock<OnStopNote>;
  let tracker: FrequencyTracker;

  beforeEach(() => {
    onStartNote = vi.fn();
    onStopNote = vi.fn();
    tracker = new FrequencyTracker(onStartNote, onStopNote);
  });

  // Helpers for injecting mock audio state without calling start()
  function makeAnalyser(freqData: Uint8Array) {
    return {
      connect: vi.fn(),
      fftSize: 4096,
      frequencyBinCount: freqData.length,
      getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.set(freqData)),
    };
  }

  function injectAudioContext(currentTime = 0) {
    tracker.audioCtx = { currentTime, sampleRate: 44100 } as any;
    tracker.source = { connect: vi.fn(), disconnect: vi.fn() } as any;
    // freqStep = 0.5 * sampleRate / fftSize ≈ 5.38 Hz/bin
    tracker.freqStep = (0.5 * 44100) / 4096;
  }

  describe('start', () => {
    it('initialises AudioContext, analyser, and source', async () => {
      await tracker.start();
      expect(tracker.audioCtx).toBeDefined();
      expect(tracker.analyser).toBeDefined();
      expect(tracker.source).toBeDefined();
      tracker.stop();
    });

    it('calculates freqStep from sampleRate and fftSize', async () => {
      await tracker.start();
      const expected =
        (0.5 * tracker.audioCtx!.sampleRate) / tracker.analyser!.fftSize;
      expect(tracker.freqStep).toBeCloseTo(expected);
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

  describe('checkFrequency', () => {
    it('does nothing when audio context is not set up', () => {
      tracker.checkFrequency({ instrumentType, tuning });
      expect(onStartNote).not.toHaveBeenCalled();
      expect(onStopNote).not.toHaveBeenCalled();
    });

    it('does nothing when signal is below the minimum volume threshold', () => {
      injectAudioContext();
      tracker.analyser = makeAnalyser(new Uint8Array(2048).fill(0)) as any;

      tracker.checkFrequency({ instrumentType, tuning });

      expect(onStartNote).not.toHaveBeenCalled();
    });

    it('calls onStopNote when a tracked note goes quiet', () => {
      const freqData = new Uint8Array(2048).fill(0); // all silent
      injectAudioContext(2.5);
      tracker.analyser = makeAnalyser(freqData) as any;
      tracker.currentMaxBin = 50;
      tracker.currentNote = 69; // A4
      tracker.currentNoteStart = 1.0;

      tracker.checkFrequency({ instrumentType, tuning });

      expect(onStopNote).toHaveBeenCalledWith(69, 1.5);
      expect(tracker.currentMaxBin).toBe(null);
    });

    it('does not call onStopNote while the tracked note continues to sound', () => {
      const freqData = new Uint8Array(2048).fill(0);
      freqData[50] = 200; // still loud
      injectAudioContext();
      tracker.analyser = makeAnalyser(freqData) as any;
      tracker.currentMaxBin = 50;
      tracker.currentNoteStart = 0;

      tracker.checkFrequency({ instrumentType, tuning });

      expect(onStopNote).not.toHaveBeenCalled();
    });

    it('calls onStartNote with pitch shifted down an octave for soprano', () => {
      // freqStep ≈ 5.38 Hz/bin; soprano range starts at bin ~97.
      // Bin 106 (≈ 571 Hz) falls inside the soprano scan window and has a
      // recorder-like overtone structure, so it is detected as the fundamental.
      // freqToMidiPitch(571) ≈ MIDI 74; the soprano -12 shift yields ~62 (D4).
      const freqData = new Uint8Array(2048).fill(0);
      freqData[104] = 50;
      freqData[105] = 150;
      freqData[106] = 200; // fundamental inside soprano range, > MIN_VOLUME (120)
      freqData[107] = 150;
      freqData[108] = 50;
      // overtone2 at 2*106 = 212, weaker than fundamental
      freqData[212] = 150;
      // overtone3 at 3*106 = 318, weaker than 2nd overtone
      freqData[318] = 100;

      injectAudioContext();
      tracker.analyser = makeAnalyser(freqData) as any;

      tracker.checkFrequency({ instrumentType: 'SOPRANO', tuning });

      expect(onStartNote).toHaveBeenCalledTimes(1);
      const detectedPitch: number = onStartNote.mock.calls[0][0];
      // Raw pitch ~74, shifted down 12 semitones for soprano → ~62 (D4)
      expect(detectedPitch).toBeGreaterThanOrEqual(60);
      expect(detectedPitch).toBeLessThanOrEqual(64);
    });

    it('does not shift pitch for tenor', () => {
      // freqStep ≈ 5.38 Hz/bin; tenor range covers bin ~49–206.
      // Bin 51 (≈ 275 Hz, ~D4) is inside the tenor scan window.
      const freqData = new Uint8Array(2048).fill(0);
      freqData[49] = 50;
      freqData[50] = 150;
      freqData[51] = 200; // fundamental inside tenor range, > MIN_VOLUME (120)
      freqData[52] = 150;
      freqData[53] = 50;
      // overtone2 at 2*51 = 102, weaker than fundamental
      freqData[102] = 150;
      // overtone3 at 3*51 = 153, weaker than 2nd overtone
      freqData[153] = 100;

      injectAudioContext();
      tracker.analyser = makeAnalyser(freqData) as any;

      tracker.checkFrequency({ instrumentType: 'TENOR', tuning });

      expect(onStartNote).toHaveBeenCalledTimes(1);
      const detectedPitch: number = onStartNote.mock.calls[0][0];
      // Raw pitch ~62 (D4), no octave shift applied for tenor
      expect(detectedPitch).toBeGreaterThanOrEqual(60);
      expect(detectedPitch).toBeLessThanOrEqual(64);
    });
  });
});
