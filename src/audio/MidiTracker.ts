import type { OnCheckCallback } from './SingleFrequencyTracker';

/**
 * Drop-in replacement for `SingleFrequencyTracker` that uses the Web MIDI API
 * (https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) instead of
 * microphone analysis. Reports note-on / note-off events as `active`
 * transitions on `onCheck` so the existing checking-mode hooks work
 * unchanged.
 *
 * `basePitch`, `pitchRange`, and `tuning` are accepted for signature parity
 * with `SingleFrequencyTracker` but ignored — MIDI events already carry
 * exact pitch information.
 */
export class MidiTracker {
  /** Bottom MIDI pitch we are listening for (0 = none). For chords this is
   * `targetPitches[0]`; the full chord is in `targetPitches`. */
  targetPitch: number = 0;
  /** All MIDI pitches that must be held simultaneously for `active=true`. */
  private targetPitches: number[] = [];
  /** Kept for signature parity with SingleFrequencyTracker. */
  targetTuning: number = 1.0;

  /** Settable so a single tracker can be shared across UI modes. */
  onCheck?: OnCheckCallback;

  private access?: MIDIAccess;
  private heldNotes = new Set<number>();
  private boundInputs: MIDIInput[] = [];
  private stateChangeHandler?: (e: Event) => void;

  constructor(_pollIntervalMs: number = 50) {}

  /** Read-only view of currently-held MIDI notes. Useful for callers that
   *  want to check per-voice subsets (e.g. "did the user hold all the bass
   *  pitches?") without mirroring state. */
  getHeldNotes(): ReadonlySet<number> {
    return this.heldNotes;
  }

  setTarget(midiPitch: number | number[], tuning: number = 1.0) {
    const arr = Array.isArray(midiPitch)
      ? midiPitch.filter((p) => p !== 0)
      : midiPitch === 0
        ? []
        : [midiPitch];
    this.targetPitches = arr;
    this.targetPitch = arr[0] ?? 0;
    this.targetTuning = tuning;
    // Fire immediately so a held target chord is reported without waiting
    // for the next MIDI event.
    this.fire();
  }

  async start(_basePitch: number, _pitchRange: number, _tuning: number = 1.0) {
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
    input.addEventListener('midimessage', this.handleMessage);
    this.boundInputs.push(input);
  }

  private handleMessage = (e: Event) => {
    const data = (e as MIDIMessageEvent).data;
    if (!data || data.length < 3) return;
    const cmd = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];
    if (cmd === 0x90 && velocity > 0) {
      this.heldNotes.add(note);
    } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
      this.heldNotes.delete(note);
    } else {
      return;
    }
    this.fire();
  };

  private fire() {
    if (!this.onCheck) return;
    if (
      this.targetPitches.length > 0 &&
      this.targetPitches.every((p) => this.heldNotes.has(p))
    ) {
      this.onCheck(true, this.targetPitch);
      return;
    }
    // Surface the most-recently-pressed non-target note for "wrong note"
    // display. Set iteration order is insertion order, so the last entry is
    // the most recent press still being held.
    let last: number | null = null;
    for (const n of this.heldNotes) last = n;
    this.onCheck(false, last);
  }

  stop() {
    for (const input of this.boundInputs) {
      input.removeEventListener('midimessage', this.handleMessage);
    }
    this.boundInputs = [];
    if (this.access && this.stateChangeHandler) {
      this.access.removeEventListener('statechange', this.stateChangeHandler);
    }
    this.access = undefined;
    this.stateChangeHandler = undefined;
    this.heldNotes.clear();
    this.targetPitch = 0;
    this.targetPitches = [];
  }
}
