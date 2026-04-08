import { midiToHz } from './utils';
import { PITCH_CONSTANTS, FREQUENCY_TRACKER_CONSTANTS } from '../constants';

/**
 * Called each poll cycle.
 * @param active       true if the current target pitch is sounding
 * @param detectedPitch  best-guess MIDI pitch (target when active; last
 *                       Worker result when inactive; null when silent)
 */
export type OnCheckCallback = (
  active: boolean,
  detectedPitch: number | null
) => void;

/**
 * Detects whether a single target MIDI pitch is currently being played,
 * and occasionally identifies the actual pitch being sounded via a Web Worker.
 *
 * The narrow target check (NSDF over ±50 cents) runs synchronously on the
 * main thread every poll cycle (~0.7 ms). When the target is not detected,
 * a copy of the sample buffer is transferred to a Web Worker that runs full
 * MPM pitch detection (~32 ms) off the main thread. The Worker result is
 * surfaced on the next poll cycle, so wrong-note display lags by at most one
 * poll interval.
 *
 * Typical usage:
 *   const tracker = new SingleFrequencyTracker((active, pitch) => { ... });
 *   await tracker.start('SOPRANO', tuning);
 *   tracker.setTarget(midiPitch, tuning);
 *   // poll loop is internal; stop when done:
 *   tracker.stop();
 */
export class SingleFrequencyTracker {
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private source?: MediaStreamAudioSourceNode;
  private mediaStream?: MediaStream;
  private samples?: Float32Array<ArrayBuffer>;

  /** MIDI pitch we are listening for (0 = none). */
  targetPitch: number = 0;
  /** Tuning ratio applied when converting pitch → frequency (1.0 = standard). */
  targetTuning: number = 1.0;

  // ── derived from targetPitch / targetTuning ──────────────────────────────
  private minLag: number = 0;
  private maxLag: number = 0;

  // ── full-range MPM via Web Worker ────────────────────────────────────────
  private worker?: Worker;
  private workerBusy: boolean = false;
  private lastDetectedPitch: number | null = null;
  /** minLag for the full instrument range (set in start()). */
  private instrMinLag: number = 0;
  /** maxLag for the full instrument range (set in start()). */
  private instrMaxLag: number = 0;

  // ── internal poll loop ───────────────────────────────────────────────────
  private intervalId?: ReturnType<typeof setInterval>;
  private readonly onCheck?: OnCheckCallback;
  private readonly pollIntervalMs: number;

  // ── NSDF threshold: a peak must reach this fraction of 1.0 to count ──────
  static readonly DETECTION_THRESHOLD = 0.5;

  constructor(onCheck?: OnCheckCallback, pollIntervalMs: number = 50) {
    this.onCheck = onCheck;
    this.pollIntervalMs = pollIntervalMs;
  }

  setTarget(midiPitch: number, tuning: number = 1.0) {
    this.targetPitch = midiPitch;
    this.targetTuning = tuning;
    this._updateLagWindow();
  }

  private _updateLagWindow() {
    if (!this.audioCtx || this.targetPitch === 0) {
      this.minLag = 0;
      this.maxLag = 0;
      return;
    }
    const sampleRate = this.audioCtx.sampleRate;
    const { CONCERT_A4_FREQ, MIDI_A4, SEMITONES_PER_OCTAVE } = PITCH_CONSTANTS;
    const targetFreq =
      CONCERT_A4_FREQ *
      Math.pow(2, (this.targetPitch - MIDI_A4) / SEMITONES_PER_OCTAVE) *
      this.targetTuning;
    const targetLag = sampleRate / targetFreq;

    // Accept pitches within ±50 cents (one full semitone wide)
    const halfSemitone = Math.pow(2, 1 / 24); // ~1.0293
    this.minLag = Math.max(1, Math.floor(targetLag / halfSemitone));
    this.maxLag = Math.ceil(targetLag * halfSemitone);
  }

  /**
   * Returns true if the target pitch is currently sounding above the silence
   * threshold, false otherwise. Returns null if not set up (no target or not
   * started).
   *
   * This method is synchronous and cheap (~0.7 ms). It fills `this.samples`
   * as a side effect; the Worker poll reads the same buffer.
   */
  check(): boolean | null {
    if (
      !this.audioCtx ||
      !this.analyser ||
      !this.source ||
      this.targetPitch === 0 ||
      this.minLag === 0
    )
      return null;

    const bufferSize = this.analyser.fftSize;
    if (!this.samples)
      this.samples = new Float32Array(bufferSize) as Float32Array<ArrayBuffer>;
    this.analyser.getFloatTimeDomainData(this.samples);

    // RMS silence gate
    let sumSq = 0;
    for (let i = 0; i < bufferSize; i++)
      sumSq += this.samples[i] * this.samples[i];
    const rms = Math.sqrt(sumSq / bufferSize);
    if (rms < FREQUENCY_TRACKER_CONSTANTS.MIN_RMS) return false;

    const N = bufferSize;
    const minLag = Math.min(this.minLag, N - 1);
    const maxLag = Math.min(this.maxLag, N - 2);

    let peakNsdf = -Infinity;
    let peakLag = minLag;
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
      const nsdf = denom < 1e-10 ? 0 : (2 * num) / denom;
      if (nsdf > peakNsdf) {
        peakNsdf = nsdf;
        peakLag = tau;
      }
    }

    if (peakNsdf < SingleFrequencyTracker.DETECTION_THRESHOLD) return false;

    // Reject if the peak sits at the window edge rather than being a genuine
    // interior maximum. An edge peak means the true NSDF peak lies outside
    // our ±50 cent acceptance zone — i.e. the actual pitch is out of range.
    // Only enforce when the window is wide enough to have an interior.
    if (
      maxLag - minLag >= 4 &&
      (peakLag <= minLag + 1 || peakLag >= maxLag - 1)
    )
      return false;

    // Harmonic alias rejection: if NSDF at half the peak lag is also above
    // threshold, the actual pitch is likely an octave above the target
    // (its 2nd harmonic lands in our window).
    const halfLag = Math.round(peakLag / 2);
    if (halfLag >= 1 && halfLag < N - 1) {
      let num = 0;
      let denomA = 0;
      let denomB = 0;
      const len = N - halfLag;
      for (let j = 0; j < len; j++) {
        num += this.samples[j] * this.samples[j + halfLag];
        denomA += this.samples[j] * this.samples[j];
        denomB += this.samples[j + halfLag] * this.samples[j + halfLag];
      }
      const denom = denomA + denomB;
      const halfLagNsdf = denom < 1e-10 ? 0 : (2 * num) / denom;
      if (halfLagNsdf >= SingleFrequencyTracker.DETECTION_THRESHOLD)
        return false;
    }

    return true;
  }

  /** Internal poll: runs check(), dispatches Worker when inactive. */
  private _poll = () => {
    const active = this.check();

    if (active) {
      this.lastDetectedPitch = this.targetPitch;
      this.workerBusy = false; // discard any pending Worker result
      this.onCheck?.(true, this.targetPitch);
      return;
    }

    // When inactive and Worker is free, offload full-range MPM.
    if (
      !this.workerBusy &&
      this.worker &&
      this.samples &&
      this.instrMinLag > 0 &&
      this.audioCtx
    ) {
      // Transfer the buffer (zero-copy). Re-allocate samples so the next
      // check() call gets a fresh buffer without a data race.
      const buf = this.samples;
      this.samples = undefined;
      this.workerBusy = true;
      this.worker.postMessage(
        {
          samples: buf,
          minLag: this.instrMinLag,
          maxLag: this.instrMaxLag,
          sampleRate: this.audioCtx.sampleRate,
        },
        [buf.buffer]
      );
    }

    // active === false means audio detected but wrong pitch;
    // active === null means tracker not ready (silence or no target).
    const detectedPitch = active === false ? this.lastDetectedPitch : null;
    this.onCheck?.(false, detectedPitch);
  };

  async start(basePitch: number, pitchRange: number, tuning: number = 1.0) {
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

    // Recompute lag window now that we have the actual sample rate.
    this.targetTuning = tuning;
    this._updateLagWindow();

    // Precompute full-range lag bounds for the Worker.
    const sampleRate = this.audioCtx.sampleRate;
    this.instrMinLag = Math.floor(
      sampleRate / midiToHz(basePitch + pitchRange + 1)
    );
    this.instrMaxLag = Math.ceil(sampleRate / midiToHz(basePitch - 1));

    // Spawn Worker and wire up result handler.
    this.worker = new Worker(new URL('./mpm.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<{ midi: number | null }>) => {
      this.lastDetectedPitch = e.data.midi;
      this.workerBusy = false;
    };

    this.intervalId = setInterval(this._poll, this.pollIntervalMs);
  }

  stop() {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.worker?.terminate();
    this.worker = undefined;
    this.workerBusy = false;
    this.lastDetectedPitch = null;

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
    this.minLag = 0;
    this.maxLag = 0;
    this.instrMinLag = 0;
    this.instrMaxLag = 0;
  }
}
