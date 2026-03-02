import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeTuning,
  RecorderDetector,
  type DetectorCallbacks,
} from './RecorderDetector';

// Mock FrequencyTracker
const { mockCheckRawFrequency, mockStart, mockStop } = vi.hoisted(() => {
  const mockCheckRawFrequency = vi.fn();
  const mockStart = vi.fn().mockResolvedValue(undefined);
  const mockStop = vi.fn();
  return { mockCheckRawFrequency, mockStart, mockStop };
});

vi.mock('./FrequencyTracker', () => ({
  FrequencyTracker: class {
    checkRawFrequency = mockCheckRawFrequency;
    start = mockStart;
    stop = mockStop;
  },
  freqToMidiPitch: (freq: number) =>
    Math.round(12 * Math.log2(freq / 440) + 69),
}));

// SOPRANO expected pitch is MIDI 71 (B4); idealFreq = 440 * 2^((71-69)/12) ≈ 493.88 Hz
const SOPRANO_IDEAL_FREQ = 440 * Math.pow(2, (71 - 69) / 12);

describe('computeTuning', () => {
  it('returns 1.0 for a perfectly in-tune note', () => {
    expect(computeTuning(SOPRANO_IDEAL_FREQ, 'SOPRANO')).toBe(1.0);
  });

  it('returns a value slightly below 1.0 for a flat note', () => {
    const result = computeTuning(SOPRANO_IDEAL_FREQ * 0.998, 'SOPRANO');
    expect(result).toBeCloseTo(0.998, 3);
    expect(result).toBeLessThan(1.0);
  });

  it('returns a value slightly above 1.0 for a sharp note', () => {
    const result = computeTuning(SOPRANO_IDEAL_FREQ * 1.005, 'SOPRANO');
    expect(result).toBeCloseTo(1.005, 3);
    expect(result).toBeGreaterThan(1.0);
  });

  it('clamps to 0.8 when the detected frequency is far too low', () => {
    expect(computeTuning(SOPRANO_IDEAL_FREQ * 0.7, 'SOPRANO')).toBe(0.8);
  });

  it('clamps to 1.2 when the detected frequency is far too high', () => {
    expect(computeTuning(SOPRANO_IDEAL_FREQ * 1.3, 'SOPRANO')).toBe(1.2);
  });

  it('rounds to 3 decimal places', () => {
    const result = computeTuning(441, 'SOPRANO');
    const decimals = result.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(3);
  });

  it('computes tuning for ALTO instrument', () => {
    // ALTO expected pitch is MIDI 64
    const altoIdeal = 440 * Math.pow(2, (64 - 69) / 12);
    expect(computeTuning(altoIdeal, 'ALTO')).toBe(1.0);
  });

  it('computes tuning for BASS instrument', () => {
    // BASS expected pitch is MIDI 52
    const bassIdeal = 440 * Math.pow(2, (52 - 69) / 12);
    expect(computeTuning(bassIdeal, 'BASS')).toBe(1.0);
  });
});

describe('RecorderDetector', () => {
  let callbacks: DetectorCallbacks;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCheckRawFrequency.mockReset();
    mockStart.mockReset().mockResolvedValue(undefined);
    mockStop.mockReset();

    callbacks = {
      onVolume: vi.fn(),
      onRecorderDetected: vi.fn(),
      onStep2Started: vi.fn(),
      onSystemDetected: vi.fn(),
      onError: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('constructor stores callbacks without error', () => {
    const detector = new RecorderDetector(callbacks);
    expect(detector).toBeDefined();
  });

  it('stop() before start(): no crash', () => {
    const detector = new RecorderDetector(callbacks);
    expect(() => detector.stop()).not.toThrow();
  });

  it('step 1: identifies SOPRANO from 7+ consistent pitch readings', async () => {
    const detector = new RecorderDetector(callbacks);
    await detector.start();

    // SOPRANO pitches are 69-72; freq for MIDI 71 ≈ 493.88 Hz
    mockCheckRawFrequency.mockReturnValue({
      frequency: SOPRANO_IDEAL_FREQ,
      volume: 150,
    });

    // Advance 7 intervals (100ms each)
    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(100);
    }

    expect(callbacks.onRecorderDetected).toHaveBeenCalledWith(
      'SOPRANO',
      expect.any(Number)
    );
    expect(callbacks.onStep2Started).toHaveBeenCalledWith('SOPRANO');
    detector.stop();
  });

  it('step 1: resets on inconsistent recorder type', async () => {
    const detector = new RecorderDetector(callbacks);
    await detector.start();

    // Alternate between SOPRANO-range and ALTO-range frequencies
    const sopranoFreq = 493.88; // MIDI 71 → SOPRANO
    const altoFreq = 329.63; // MIDI 64 → ALTO

    mockCheckRawFrequency
      .mockReturnValueOnce({ frequency: sopranoFreq, volume: 150 })
      .mockReturnValueOnce({ frequency: sopranoFreq, volume: 150 })
      .mockReturnValueOnce({ frequency: altoFreq, volume: 150 })
      .mockReturnValueOnce({ frequency: sopranoFreq, volume: 150 })
      .mockReturnValueOnce({ frequency: sopranoFreq, volume: 150 })
      .mockReturnValueOnce({ frequency: sopranoFreq, volume: 150 })
      .mockReturnValueOnce({ frequency: sopranoFreq, volume: 150 });

    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(100);
    }

    // Should NOT have detected yet because of the inconsistency reset
    expect(callbacks.onRecorderDetected).not.toHaveBeenCalled();
    detector.stop();
  });

  it('step 1: resets on unknown pitch', async () => {
    const detector = new RecorderDetector(callbacks);
    await detector.start();

    // MIDI pitch 66 is not in PITCH_TO_RECORDER → unknown
    const unknownFreq = 440 * Math.pow(2, (66 - 69) / 12); // ~369.99
    mockCheckRawFrequency.mockReturnValue({
      frequency: unknownFreq,
      volume: 150,
    });

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
    }

    expect(callbacks.onRecorderDetected).not.toHaveBeenCalled();
    detector.stop();
  });

  it('step 1: onVolume callback fires each interval', async () => {
    const detector = new RecorderDetector(callbacks);
    await detector.start();

    mockCheckRawFrequency.mockReturnValue({
      frequency: SOPRANO_IDEAL_FREQ,
      volume: 150,
    });

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);

    expect(callbacks.onVolume).toHaveBeenCalledTimes(3);
    expect(callbacks.onVolume).toHaveBeenCalledWith(150);
    detector.stop();
  });

  it('step 1: skips when no frequency detected', async () => {
    const detector = new RecorderDetector(callbacks);
    await detector.start();

    mockCheckRawFrequency.mockReturnValue(null);

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);

    expect(callbacks.onVolume).not.toHaveBeenCalled();
    expect(callbacks.onRecorderDetected).not.toHaveBeenCalled();
    detector.stop();
  });

  it('step 2: freq close to known (< 8Hz) → onSystemDetected(true)', async () => {
    const detector = new RecorderDetector(callbacks);
    await detector.start();

    // First get through step 1 with SOPRANO
    mockCheckRawFrequency.mockReturnValue({
      frequency: SOPRANO_IDEAL_FREQ,
      volume: 150,
    });
    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(100);
    }
    expect(callbacks.onStep2Started).toHaveBeenCalled();

    // Step 2: SOPRANO known freq is 349.2 Hz
    // Provide frequency close to 349.2 (within 8Hz)
    mockCheckRawFrequency.mockReturnValue({
      frequency: 349.2, // Exactly the known freq
      volume: 150,
    });
    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(100);
    }

    expect(callbacks.onSystemDetected).toHaveBeenCalledWith(true);
    detector.stop();
  });

  it('step 2: freq farther from known (8-25Hz) → onSystemDetected(false)', async () => {
    const detector = new RecorderDetector(callbacks);
    await detector.start();

    // Get through step 1
    mockCheckRawFrequency.mockReturnValue({
      frequency: SOPRANO_IDEAL_FREQ,
      volume: 150,
    });
    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(100);
    }

    // Step 2: SOPRANO known freq is 349.2
    // Provide frequency 15Hz away (within 25Hz but outside 8Hz)
    mockCheckRawFrequency.mockReturnValue({
      frequency: 349.2 + 15,
      volume: 150,
    });
    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(100);
    }

    expect(callbacks.onSystemDetected).toHaveBeenCalledWith(false);
    detector.stop();
  });

  it('step 2: freq too far (>25Hz) → ignored, no callback', async () => {
    const detector = new RecorderDetector(callbacks);
    await detector.start();

    // Get through step 1
    mockCheckRawFrequency.mockReturnValue({
      frequency: SOPRANO_IDEAL_FREQ,
      volume: 150,
    });
    for (let i = 0; i < 7; i++) {
      vi.advanceTimersByTime(100);
    }

    // Step 2: SOPRANO known freq is 349.2
    // Provide frequency >25Hz away
    mockCheckRawFrequency.mockReturnValue({
      frequency: 349.2 + 30,
      volume: 150,
    });
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(100);
    }

    expect(callbacks.onSystemDetected).not.toHaveBeenCalled();
    detector.stop();
  });

  it('stop() clears interval and stops tracker', async () => {
    const detector = new RecorderDetector(callbacks);
    await detector.start();

    mockCheckRawFrequency.mockReturnValue({
      frequency: SOPRANO_IDEAL_FREQ,
      volume: 150,
    });

    vi.advanceTimersByTime(100);
    expect(callbacks.onVolume).toHaveBeenCalledTimes(1);

    detector.stop();
    expect(mockStop).toHaveBeenCalled();

    // After stop, no more callbacks
    vi.advanceTimersByTime(500);
    expect(callbacks.onVolume).toHaveBeenCalledTimes(1);
  });
});
