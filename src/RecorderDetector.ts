import { FrequencyTracker, freqToMidiPitch } from './FrequencyTracker';
import { type RecorderType } from './instrument';

/** Computes tuning ratio from a raw detected frequency and its MIDI pitch, clamped to [0.8, 1.2]. */
export function computeTuning(
  frequency: number,
  instrument: RecorderType
): number {
  const expectedPitch = {
    ALL: 0,
    SOPRANINO: 76,
    SOPRANO: 71,
    ALTO: 64,
    TENOR: 59,
    BASS: 52,
  }[instrument];
  const idealFreq = 440 * Math.pow(2, (expectedPitch - 69) / 12);
  const newTuning = Math.round((frequency / idealFreq) * 1000) / 1000;
  return Math.min(1.2, Math.max(0.8, newTuning));
}

const SAMPLE_RATE = 100;
const MIN_SAMPLES = 7;

const PITCH_TO_RECORDER: Record<number, RecorderType> = {
  77: 'SOPRANINO',
  76: 'SOPRANINO',
  75: 'SOPRANINO',
  74: 'SOPRANINO',
  72: 'SOPRANO',
  71: 'SOPRANO',
  70: 'SOPRANO',
  69: 'SOPRANO',
  65: 'ALTO',
  64: 'ALTO',
  63: 'ALTO',
  62: 'ALTO',
  60: 'TENOR',
  59: 'TENOR',
  58: 'TENOR',
  57: 'TENOR',
  53: 'BASS',
  52: 'BASS',
  51: 'BASS',
  50: 'BASS',
};

const STEP2_FREQS: Record<RecorderType, number> = {
  ALL: 0,
  SOPRANINO: 523.3,
  SOPRANO: 349.2,
  ALTO: 261.6,
  TENOR: 174.6,
  BASS: 130.8,
};

export interface DetectorCallbacks {
  onVolume: (volume: number) => void;
  onRecorderDetected: (recorder: RecorderType, tuning: number) => void;
  onStep2Started: (recorder: RecorderType) => void;
  onSystemDetected: (isGerman: boolean) => void;
  onError: (err: Error) => void;
}

export class RecorderDetector {
  private tracker: FrequencyTracker | null = null;
  private intervalId: number | null = null;
  private callbacks: DetectorCallbacks;

  constructor(callbacks: DetectorCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.tracker = new FrequencyTracker(
      () => {},
      () => {}
    );
    await this.tracker.start();
    this.runStep1();
  }

  stop(): void {
    this.clearInterval();
    this.tracker?.stop();
    this.tracker = null;
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private runStep1(): void {
    const samples: { instrumentType: string; tuning: number }[] = [];
    this.intervalId = window.setInterval(() => {
      const result = this.tracker?.checkRawFrequency('ALL');
      if (!result?.frequency || result.volume == null) return;
      const { frequency, volume } = result as {
        frequency: number;
        volume: number;
      };
      this.callbacks.onVolume(volume);

      const pitch = freqToMidiPitch(frequency);
      const recorderType = PITCH_TO_RECORDER[pitch];
      if (!recorderType) {
        samples.length = 0;
        return;
      }
      if (samples.length > 0 && samples[0].instrumentType !== recorderType)
        samples.length = 0;

      samples.push({
        instrumentType: recorderType,
        tuning: computeTuning(frequency, recorderType),
      });
      if (samples.length >= MIN_SAMPLES) {
        const avgTuning =
          samples.reduce((s, x) => s + x.tuning, 0) / samples.length;
        this.callbacks.onRecorderDetected(
          recorderType,
          Math.round(avgTuning * 100) / 100
        );
        this.clearInterval();
        this.runStep2(recorderType);
      }
    }, SAMPLE_RATE);
  }

  private runStep2(recorder: RecorderType): void {
    this.callbacks.onStep2Started(recorder);
    const knownFreq = STEP2_FREQS[recorder];
    const freqSamples: number[] = [];
    this.intervalId = window.setInterval(() => {
      const result = this.tracker?.checkRawFrequency('ALL');
      if (!result?.frequency || result.volume == null) return;
      const { frequency, volume } = result as {
        frequency: number;
        volume: number;
      };
      this.callbacks.onVolume(volume);

      if (Math.abs(frequency - knownFreq) > 25) return;
      freqSamples.push(frequency);
      if (freqSamples.length >= MIN_SAMPLES) {
        const avg = freqSamples.reduce((a, v) => a + v, 0) / MIN_SAMPLES;
        this.callbacks.onSystemDetected(Math.abs(avg - knownFreq) < 8);
        this.clearInterval();
      }
    }, SAMPLE_RATE);
  }
}
