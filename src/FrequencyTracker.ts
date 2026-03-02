import { type RecorderType, RECORDER_TYPES } from './instrument';
import { PITCH_CONSTANTS, FREQUENCY_TRACKER_CONSTANTS } from './constants';

// Fit a Gaussian to 5 points by taking log(y) = A*x^2 + B*x + C (a parabola)
// and solving the least-squares normal equations directly — no iteration needed.
export function fitGaussian(points: number[]): [number, number, number] | null {
  const eps = 1e-6;
  const y = points.map((v) => Math.log(Math.max(v, eps)));

  // Build 3x3 normal equations for basis [x^2, x, 1]
  const M: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let x = 0; x < 5; x++) {
    const basis = [x * x, x, 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) M[r][c] += basis[r] * basis[c];
      M[r][3] += basis[r] * y[x];
    }
  }

  // Gaussian elimination with partial pivoting
  for (let i = 0; i < 3; i++) {
    let maxRow = i;
    for (let k = i + 1; k < 3; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    if (Math.abs(M[i][i]) < eps) return null;
    for (let k = i + 1; k < 3; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j <= 3; j++) M[k][j] -= f * M[i][j];
    }
  }

  // Back substitution
  const sol = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    sol[i] = M[i][3];
    for (let j = i + 1; j < 3; j++) sol[i] -= M[i][j] * sol[j];
    sol[i] /= M[i][i];
  }
  const [A, B, C] = sol;

  if (A >= 0) return null; // not a downward parabola → no valid peak
  const center = -B / (2 * A);
  const width = Math.sqrt(-1 / (2 * A));
  const height = Math.exp(C - (B * B) / (4 * A));
  return [center, height, width];
}

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
  currentMaxBin: number | null = null;
  currentNote: number = 0;
  currentNoteStart: number = 0;
  currentVol: number = 0;
  minVol: number = FREQUENCY_TRACKER_CONSTANTS.MIN_VOLUME;
  freqStep: number = 0;
  freqs?: Uint8Array<ArrayBuffer>;
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
    if (!this.freqs)
      this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(this.freqs);
    const instrument = RECORDER_TYPES[instrumentType];
    const startBin = Math.floor(instrument.lowNote / this.freqStep);
    const stopBin = Math.ceil(instrument.highNote / this.freqStep);

    let maxVal = 0;
    let maxBin = 0;
    if (this.currentMaxBin === null) {
      for (let bin = startBin; bin <= stopBin; bin++) {
        if (this.freqs[bin] > maxVal) {
          maxVal = this.freqs[bin];
          maxBin = bin;
        }
      }
    } else {
      maxBin = Math.round(this.currentMaxBin);
      maxVal = this.freqs[maxBin];
    }

    // check the highest bin is loud enough
    if (maxVal < this.minVol) {
      this.currentMaxBin = null;
      return null;
    }
    // check that the second overtone is at least 10% of the dominant harmonic
    if (
      Math.max(
        this.freqs[2 * maxBin - 1],
        this.freqs[2 * maxBin],
        this.freqs[2 * maxBin + 1]
      ) <
      0.1 * this.freqs[maxBin]
    ) {
      this.currentMaxBin = null;
      return null;
    }

    const [center, height, width] = fitGaussian(
      Array.from(this.freqs.slice(maxBin - 2, maxBin + 3))
    ) ?? [2, 0, 1];
    const realBin = maxBin - 2 + center;
    // TODO: maybe these should return a confidence score or something instead?
    if (Math.abs(height - maxVal) > 50) {
      this.currentMaxBin = 0;
      return null;
    }
    if (width * this.freqStep > FREQUENCY_TRACKER_CONSTANTS.MAX_FREQ_WIDTH) {
      this.currentMaxBin = 0;
      return null;
    }
    this.currentMaxBin = realBin;
    return {
      frequency: this.currentMaxBin * this.freqStep,
      volume: this.freqs[Math.round(this.currentMaxBin)],
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

    let note = freqToMidiPitch(result.frequency / tuning);
    if (note === this.currentNote) {
      return;
    } else if (this.currentNote !== 0) {
      const duration = this.audioCtx!.currentTime - this.currentNoteStart;
      this.onStopNote(this.currentNote, duration);
    }
    this.currentNoteStart = this.audioCtx!.currentTime;
    this.currentNote = note;
    this.currentVol = result.volume;
    // Soprano recorders are written an octave lower than they sound
    if (instrumentType === 'SOPRANO' || instrumentType === 'SOPRANINO')
      note -= 12;
    this.onStartNote(note, this.currentVol);
  }

  async start() {
    this.audioCtx = new AudioContext();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = FREQUENCY_TRACKER_CONSTANTS.FFT_SIZE;
    this.analyser.minDecibels = FREQUENCY_TRACKER_CONSTANTS.MIN_DECIBELS;
    this.analyser.maxDecibels = FREQUENCY_TRACKER_CONSTANTS.MAX_DECIBELS;
    this.analyser.smoothingTimeConstant =
      FREQUENCY_TRACKER_CONSTANTS.SMOOTHING_TIME_CONSTANT;
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
    this.freqs = undefined;
  }
}
