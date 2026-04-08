import { PITCH_CONSTANTS, FREQUENCY_TRACKER_CONSTANTS } from '../constants';
import { findPeriodLag } from './mpm';
import { midiToHz } from './utils';
export { DETECTION_LOW_HZ, DETECTION_HIGH_HZ } from './utils';

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
  private currentNote: number = 0;
  private currentNoteStart: number = 0;
  private currentVol: number = 0;
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

  checkRawFrequency(lowNote: number, highNote: number): RawFrequencyResult {
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
    const minLag = Math.floor(sampleRate / highNote);
    const maxLag = Math.ceil(sampleRate / lowNote);

    const lag = findPeriodLag(this.samples, minLag, maxLag);
    if (lag === null) return null;

    return {
      frequency: sampleRate / lag,
      volume: rms,
    };
  }

  checkFrequency({
    basePitch,
    pitchRange,
    tuning,
  }: {
    basePitch: number;
    pitchRange: number;
    tuning: number;
  }) {
    const result = this.checkRawFrequency(
      midiToHz(basePitch - 1),
      midiToHz(basePitch + pitchRange + 1)
    );
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
