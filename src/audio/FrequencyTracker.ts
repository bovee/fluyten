import { type RecorderType, RECORDER_TYPES } from '../instrument';
import { PITCH_CONSTANTS, FREQUENCY_TRACKER_CONSTANTS } from '../constants';

export function freqToMidiPitch(freq: number): number {
  return Math.round(
    PITCH_CONSTANTS.SEMITONES_PER_OCTAVE *
      Math.log2(freq / PITCH_CONSTANTS.CONCERT_A4_FREQ) +
      PITCH_CONSTANTS.MIDI_A4
  );
}

export type OnStartNote = (pitch: number, volume: number) => void;
export type OnStopNote = (pitch: number, duration: number) => void;

export type RawFrequencyResult = { frequency: number; volume: number } | null;

export class FrequencyTracker {
  currentNote: number = 0;
  currentNoteStart: number = 0;
  currentVol: number = 0;
  freqStep: number = 0;
  samples?: Float32Array<ArrayBuffer>;
  source?: MediaStreamAudioSourceNode;
  mediaStream?: MediaStream;
  audioCtx?: AudioContext;
  analyser?: AnalyserNode;
  onStartNote: OnStartNote;
  onStopNote: OnStopNote;

  constructor(onStartNote: OnStartNote, onStopNote: OnStopNote) {
    this.onStartNote = onStartNote;
    this.onStopNote = onStopNote;
  }

  checkRawFrequency(instrumentType: RecorderType): RawFrequencyResult {
    if (!this.audioCtx || !this.analyser || !this.source) return null;
    const bufferSize = this.analyser.fftSize;
    if (!this.samples)
      this.samples = new Float32Array(bufferSize) as Float32Array<ArrayBuffer>;
    this.analyser.getFloatTimeDomainData(this.samples);

    // RMS silence gate
    let sumSq = 0;
    for (let i = 0; i < bufferSize; i++)
      sumSq += this.samples[i] * this.samples[i];
    const rms = Math.sqrt(sumSq / bufferSize);
    if (rms < FREQUENCY_TRACKER_CONSTANTS.MIN_RMS) return null;

    const sampleRate = this.audioCtx.sampleRate;
    const instrument = RECORDER_TYPES[instrumentType];
    const minLag = Math.floor(sampleRate / instrument.highNote);
    const maxLag = Math.ceil(sampleRate / instrument.lowNote);

    // McLeod Pitch Method: Normalized Square Difference Function (NSDF)
    // nsdf[τ] = 2·Σ x[j]·x[j+τ] / (Σ x[j]² + Σ x[j+τ]²)
    // We compute the numerator and denominator incrementally.
    const N = bufferSize;
    const nsdf = new Float32Array(maxLag + 1);

    for (let tau = minLag; tau <= maxLag; tau++) {
      let num = 0;
      let denomA = 0;
      let denomB = 0;
      const len = N - tau;
      for (let j = 0; j < len; j++) {
        num += this.samples[j] * this.samples[j + tau];
        denomA += this.samples[j] * this.samples[j];
        denomB += this.samples[j + tau] * this.samples[j + tau];
      }
      const denom = denomA + denomB;
      nsdf[tau] = denom < 1e-10 ? 0 : (2 * num) / denom;
    }

    // Find positive-going peaks: locations where nsdf crosses zero upward
    // then reaches a local maximum before crossing zero again.
    let keyMax = -Infinity;
    const peaks: Array<{ lag: number; value: number }> = [];

    let tau = minLag;
    // Skip initial negative region if any
    while (tau <= maxLag && nsdf[tau] > 0) tau++;
    while (tau <= maxLag) {
      // Skip negative region
      while (tau <= maxLag && nsdf[tau] <= 0) tau++;
      if (tau > maxLag) break;
      // Scan positive region for local max
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

    // Key maximum selection: first peak >= threshold * keyMax
    const threshold =
      FREQUENCY_TRACKER_CONSTANTS.MPM_CLARITY_THRESHOLD * keyMax;
    const chosen = peaks.find((p) => p.value >= threshold);
    if (!chosen) return null;

    // Parabolic interpolation for sub-sample accuracy
    const t = chosen.lag;
    let interpolatedLag = t;
    if (t > minLag && t < maxLag) {
      const y0 = nsdf[t - 1];
      const y1 = nsdf[t];
      const y2 = nsdf[t + 1];
      const denom = 2 * (2 * y1 - y0 - y2);
      if (Math.abs(denom) > 1e-10) {
        interpolatedLag = t + (y2 - y0) / denom;
      }
    }

    return {
      frequency: sampleRate / interpolatedLag,
      volume: rms,
    };
  }

  checkFrequency({
    instrumentType,
    tuning,
  }: {
    instrumentType: RecorderType;
    tuning: number;
  }) {
    const result = this.checkRawFrequency(instrumentType);
    if (result === null) {
      if (this.currentNote) {
        // a note was active and has now stopped
        const duration = this.audioCtx!.currentTime - this.currentNoteStart;
        this.onStopNote(this.currentNote, duration);
        this.currentNote = 0;
        this.currentVol = 0;
      }
      return;
    }

    const note = freqToMidiPitch(result.frequency / tuning);
    if (note === this.currentNote) {
      return;
    } else if (this.currentNote !== 0) {
      const duration = this.audioCtx!.currentTime - this.currentNoteStart;
      this.onStopNote(this.currentNote, duration);
    }
    this.currentNoteStart = this.audioCtx!.currentTime;
    this.currentNote = note;
    this.currentVol = result.volume;
    this.onStartNote(note, this.currentVol);
  }

  async start() {
    this.audioCtx = new AudioContext();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = FREQUENCY_TRACKER_CONSTANTS.FFT_SIZE;
    this.freqStep = (0.5 * this.audioCtx.sampleRate) / this.analyser.fftSize;

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
