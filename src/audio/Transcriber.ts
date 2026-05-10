import { FrequencyTracker, freqToMidiPitch } from './FrequencyTracker';
import { midiToHz } from './utils';

export type TranscribeSource = 'mic' | 'midi';

/**
 * Fires when a note (or chord) finishes. `pitches` is sorted ascending. Mic
 * mode always reports a single pitch; MIDI mode reports a chord whenever
 * multiple notes were held simultaneously.
 */
export type OnTranscribedNote = (
  pitches: number[],
  durationSecs: number
) => void;

export interface TranscribeConfig {
  /** Lowest expected MIDI pitch (mic mode only). */
  basePitch: number;
  /** Number of semitones above basePitch the instrument can produce (mic mode only). */
  pitchRange: number;
  /** Tuning ratio applied to detected frequencies (mic mode only). */
  tuning: number;
}

const DEFAULT_POLL_MS = 50;

/**
 * Captures completed notes from either a microphone (MPM pitch detection) or
 * a Web MIDI input device, and reports each one as `(pitch, durationSecs)`.
 *
 * Mic mode owns a `FrequencyTracker`, polls it on an interval, and tracks
 * note-on/note-off edges using audio-context time. MIDI mode listens directly
 * to `midimessage` events and times each note from its press to its release.
 */
export class Transcriber {
  private source: TranscribeSource;
  private onNote: OnTranscribedNote;
  private pollIntervalMs: number;

  // Mic state
  private tracker?: FrequencyTracker;
  private intervalId: number | null = null;
  private currentNote: number = 0;
  private currentNoteStart: number = 0;

  // MIDI state. A "chord" is the set of notes held during a single
  // press-to-release cycle: from the first note-on after silence to the
  // note-off that brings the held count back to zero. Notes added via legato
  // (pressed while another is still held) join the same chord.
  private access?: MIDIAccess;
  private boundInputs: MIDIInput[] = [];
  private stateChangeHandler?: (e: Event) => void;
  private chordPitches = new Set<number>();
  private chordStartMs: number = 0;
  private heldCount: number = 0;

  constructor(
    source: TranscribeSource,
    onNote: OnTranscribedNote,
    pollIntervalMs: number = DEFAULT_POLL_MS
  ) {
    this.source = source;
    this.onNote = onNote;
    this.pollIntervalMs = pollIntervalMs;
  }

  async start(config: TranscribeConfig): Promise<void> {
    if (this.source === 'mic') await this.startMic(config);
    else await this.startMidi();
  }

  stop(): void {
    if (this.source === 'mic') this.stopMic();
    else this.stopMidi();
  }

  // --- Mic ---

  private async startMic(config: TranscribeConfig) {
    this.tracker = new FrequencyTracker();
    await this.tracker.start();
    const lowHz = midiToHz(config.basePitch - 1);
    const highHz = midiToHz(config.basePitch + config.pitchRange + 1);
    this.intervalId = window.setInterval(() => {
      this.pollMic(lowHz, highHz, config.tuning);
    }, this.pollIntervalMs);
  }

  private pollMic(lowHz: number, highHz: number, tuning: number) {
    const tracker = this.tracker;
    if (!tracker?.audioCtx) return;
    const result = tracker.checkRawFrequency(lowHz, highHz);
    const now = tracker.audioCtx.currentTime;
    if (result === null) {
      if (this.currentNote) {
        this.onNote([this.currentNote], now - this.currentNoteStart);
        this.currentNote = 0;
      }
      return;
    }
    const note = freqToMidiPitch(result.frequency / tuning);
    if (note === this.currentNote) return;
    if (this.currentNote !== 0) {
      this.onNote([this.currentNote], now - this.currentNoteStart);
    }
    this.currentNote = note;
    this.currentNoteStart = now;
  }

  private stopMic() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.tracker?.stop();
    this.tracker = undefined;
    this.currentNote = 0;
  }

  // --- MIDI ---

  private async startMidi() {
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API is not available in this browser.');
    }
    try {
      this.access = await navigator.requestMIDIAccess();
    } catch (err) {
      throw new Error(`Error opening MIDI access: ${err}`);
    }
    for (const input of this.access.inputs.values()) this.attachInput(input);
    this.stateChangeHandler = (e: Event) => {
      const port = (e as MIDIConnectionEvent).port;
      if (port && port.type === 'input' && port.state === 'connected') {
        this.attachInput(port as MIDIInput);
      }
    };
    this.access.addEventListener('statechange', this.stateChangeHandler);
  }

  private attachInput(input: MIDIInput) {
    if (this.boundInputs.includes(input)) return;
    input.addEventListener('midimessage', this.handleMidiMessage);
    this.boundInputs.push(input);
  }

  private handleMidiMessage = (e: Event) => {
    const data = (e as MIDIMessageEvent).data;
    if (!data || data.length < 3) return;
    const cmd = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];
    if (cmd === 0x90 && velocity > 0) {
      if (this.heldCount === 0) {
        this.chordStartMs = performance.now();
        this.chordPitches.clear();
      }
      this.chordPitches.add(note);
      this.heldCount++;
    } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
      if (this.heldCount === 0) return;
      this.heldCount--;
      if (this.heldCount === 0) {
        const pitches = [...this.chordPitches].sort((a, b) => a - b);
        const durationSecs = (performance.now() - this.chordStartMs) / 1000;
        this.chordPitches.clear();
        this.onNote(pitches, durationSecs);
      }
    }
  };

  private stopMidi() {
    for (const input of this.boundInputs) {
      input.removeEventListener('midimessage', this.handleMidiMessage);
    }
    this.boundInputs = [];
    if (this.access && this.stateChangeHandler) {
      this.access.removeEventListener('statechange', this.stateChangeHandler);
    }
    this.access = undefined;
    this.stateChangeHandler = undefined;
    this.chordPitches.clear();
    this.heldCount = 0;
  }
}
