/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Mock } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  freqToMidiPitch,
  FrequencyTracker,
  type OnStartNote,
  type OnStopNote,
} from './FrequencyTracker';

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

describe('FrequencyTracker', () => {
  const sampleRate = 44100;
  const bufferSize = 4096;
  const tuning = 1.0;
  let onStartNote: Mock<OnStartNote>;
  let onStopNote: Mock<OnStopNote>;
  let tracker: FrequencyTracker;

  beforeEach(() => {
    onStartNote = vi.fn();
    onStopNote = vi.fn();
    tracker = new FrequencyTracker(onStartNote, onStopNote);
  });

  function injectAudioContext(currentTime = 0) {
    tracker.audioCtx = { currentTime, sampleRate } as any;
    tracker.source = { connect: vi.fn(), disconnect: vi.fn() } as any;
    tracker.freqStep = (0.5 * sampleRate) / bufferSize;
  }

  function makeAnalyser(pcmData: Float32Array) {
    return {
      connect: vi.fn(),
      fftSize: bufferSize,
      getFloatTimeDomainData: vi.fn((arr: Float32Array) => arr.set(pcmData)),
    };
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
      tracker.checkFrequency({ instrumentType: 'TENOR', tuning });
      expect(onStartNote).not.toHaveBeenCalled();
      expect(onStopNote).not.toHaveBeenCalled();
    });

    it('returns null for silence (low RMS)', () => {
      injectAudioContext();
      tracker.analyser = makeAnalyser(new Float32Array(bufferSize).fill(0)) as any;

      tracker.checkFrequency({ instrumentType: 'TENOR', tuning });

      expect(onStartNote).not.toHaveBeenCalled();
    });

    it('calls onStopNote when a tracked note goes quiet', () => {
      injectAudioContext(2.5);
      tracker.analyser = makeAnalyser(new Float32Array(bufferSize).fill(0)) as any;
      tracker.currentNote = 69; // A4
      tracker.currentNoteStart = 1.0;

      tracker.checkFrequency({ instrumentType: 'TENOR', tuning });

      expect(onStopNote).toHaveBeenCalledWith(69, 1.5);
    });

    it('detects A4 (440 Hz) as MIDI 69 for tenor', () => {
      injectAudioContext();
      const buf = makeSineBuffer(440, sampleRate, bufferSize);
      tracker.analyser = makeAnalyser(buf) as any;

      tracker.checkFrequency({ instrumentType: 'TENOR', tuning });

      expect(onStartNote).toHaveBeenCalledTimes(1);
      const pitch: number = onStartNote.mock.calls[0][0];
      expect(pitch).toBe(69); // A4
    });

    it('detects fundamental correctly even when harmonics are present (sawtooth)', () => {
      // Sawtooth at D4 (~293.66 Hz, MIDI 62) has strong harmonics.
      // MPM should still lock on to the fundamental, not an octave up.
      injectAudioContext();
      const buf = makeSawtoothBuffer(293.66, sampleRate, bufferSize);
      tracker.analyser = makeAnalyser(buf) as any;

      tracker.checkFrequency({ instrumentType: 'TENOR', tuning });

      expect(onStartNote).toHaveBeenCalledTimes(1);
      const pitch: number = onStartNote.mock.calls[0][0];
      expect(pitch).toBeGreaterThanOrEqual(61);
      expect(pitch).toBeLessThanOrEqual(63);
    });

    it('detects soprano C5 (523 Hz) as MIDI 72 (sounding pitch, no shift)', () => {
      injectAudioContext();
      const buf = makeSineBuffer(523.25, sampleRate, bufferSize);
      tracker.analyser = makeAnalyser(buf) as any;

      tracker.checkFrequency({ instrumentType: 'SOPRANO', tuning });

      expect(onStartNote).toHaveBeenCalledTimes(1);
      const pitch: number = onStartNote.mock.calls[0][0];
      expect(pitch).toBeGreaterThanOrEqual(70);
      expect(pitch).toBeLessThanOrEqual(74);
    });

    it('does not shift pitch for tenor', () => {
      // Tenor C4 (~261.63 Hz, MIDI 60)
      injectAudioContext();
      const buf = makeSineBuffer(261.63, sampleRate, bufferSize);
      tracker.analyser = makeAnalyser(buf) as any;

      tracker.checkFrequency({ instrumentType: 'TENOR', tuning });

      expect(onStartNote).toHaveBeenCalledTimes(1);
      const pitch: number = onStartNote.mock.calls[0][0];
      expect(pitch).toBeGreaterThanOrEqual(59);
      expect(pitch).toBeLessThanOrEqual(61);
    });

    it('fires onStartNote and onStopNote on successive different notes', () => {
      injectAudioContext(0);
      const bufA = makeSineBuffer(440, sampleRate, bufferSize);
      tracker.analyser = makeAnalyser(bufA) as any;
      tracker.checkFrequency({ instrumentType: 'TENOR', tuning });
      expect(onStartNote).toHaveBeenCalledTimes(1);

      // Now play D4 (~293.66 Hz)
      (tracker.audioCtx as any).currentTime = 1.0;
      const bufD = makeSineBuffer(293.66, sampleRate, bufferSize);
      tracker.analyser = makeAnalyser(bufD) as any;
      tracker.checkFrequency({ instrumentType: 'TENOR', tuning });

      expect(onStopNote).toHaveBeenCalledTimes(1);
      expect(onStartNote).toHaveBeenCalledTimes(2);
    });
  });
});
