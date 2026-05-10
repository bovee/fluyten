import { PITCH_CONSTANTS, FREQUENCY_TRACKER_CONSTANTS } from '../constants';
import { findPeriodLag } from './mpm';
export { DETECTION_LOW_HZ, DETECTION_HIGH_HZ } from './utils';

export function freqToMidiPitch(freq: number): number {
  return Math.round(
    PITCH_CONSTANTS.SEMITONES_PER_OCTAVE *
      Math.log2(freq / PITCH_CONSTANTS.CONCERT_A4_FREQ) +
      PITCH_CONSTANTS.MIDI_A4
  );
}

export type RawFrequencyResult = { frequency: number; volume: number } | null;

/**
 * Mic + analyser + raw MPM primitive. Callers poll `checkRawFrequency` at
 * their preferred cadence; higher-level note-on/note-off bookkeeping lives in
 * consumers (e.g. `Transcriber`).
 */
export class FrequencyTracker {
  samples?: Float32Array<ArrayBuffer>;
  source?: MediaStreamAudioSourceNode;
  mediaStream?: MediaStream;
  audioCtx?: AudioContext;
  analyser?: AnalyserNode;

  checkRawFrequency(lowHz: number, highHz: number): RawFrequencyResult {
    if (!this.audioCtx || !this.analyser || !this.source) return null;
    const bufferSize = this.analyser.fftSize;
    if (!this.samples)
      this.samples = new Float32Array(bufferSize) as Float32Array<ArrayBuffer>;
    this.analyser.getFloatTimeDomainData(this.samples);

    let sumSq = 0;
    for (let i = 0; i < bufferSize; i++)
      sumSq += this.samples[i] * this.samples[i];
    const rms = Math.sqrt(sumSq / bufferSize);
    if (rms < FREQUENCY_TRACKER_CONSTANTS.MIN_RMS) return null;

    const sampleRate = this.audioCtx.sampleRate;
    const minLag = Math.floor(sampleRate / highHz);
    const maxLag = Math.ceil(sampleRate / lowHz);

    const lag = findPeriodLag(this.samples, minLag, maxLag);
    if (lag === null) return null;

    return {
      frequency: sampleRate / lag,
      volume: rms,
    };
  }

  async start() {
    this.audioCtx = new AudioContext();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = FREQUENCY_TRACKER_CONSTANTS.FFT_SIZE;

    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not available.');
    }
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      this.source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.source.connect(this.analyser);
    } catch (err) {
      throw new Error(`Error opening microphone: ${err}`);
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = undefined;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = undefined;
    }
    this.analyser = undefined;
    this.samples = undefined;
    this.audioCtx?.close();
    this.audioCtx = undefined;
  }
}
