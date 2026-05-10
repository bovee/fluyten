/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MidiTracker } from './MidiTracker';

class FakeMIDIInput extends EventTarget {
  readonly type = 'input';
  state = 'connected';
  send(bytes: number[]) {
    const event = new Event('midimessage') as Event & {
      data: Uint8Array;
    };
    event.data = new Uint8Array(bytes);
    this.dispatchEvent(event);
  }
}

class FakeMIDIAccess extends EventTarget {
  inputs = new Map<string, FakeMIDIInput>();
  addInput(id: string, input: FakeMIDIInput) {
    this.inputs.set(id, input);
  }
  /** Simulate a device connecting after `start()` has been called. */
  connect(id: string, input: FakeMIDIInput) {
    this.inputs.set(id, input);
    const event = new Event('statechange') as Event & {
      port: FakeMIDIInput;
    };
    event.port = input;
    this.dispatchEvent(event);
  }
}

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

describe('MidiTracker', () => {
  let access: FakeMIDIAccess;
  let input: FakeMIDIInput;
  let tracker: MidiTracker;
  let onCheck: ReturnType<
    typeof vi.fn<(active: boolean, pitch: number | null) => void>
  >;

  beforeEach(async () => {
    access = new FakeMIDIAccess();
    input = new FakeMIDIInput();
    access.addInput('in-1', input);
    (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(access);

    tracker = new MidiTracker();
    onCheck = vi.fn();
    tracker.onCheck = onCheck;
    await tracker.start(60, 24, 1.0);
  });

  afterEach(() => {
    tracker.stop();
    delete (navigator as any).requestMIDIAccess;
  });

  it('throws if Web MIDI API is unavailable', async () => {
    delete (navigator as any).requestMIDIAccess;
    const t = new MidiTracker();
    await expect(t.start(60, 24)).rejects.toThrow(/Web MIDI API/);
  });

  it('reports active=true when the target pitch is pressed', () => {
    tracker.setTarget(69, 1.0);
    onCheck.mockClear();
    input.send([NOTE_ON, 69, 100]);
    expect(onCheck).toHaveBeenLastCalledWith(true, 69);
  });

  it('reports active=false with the wrong pitch when a non-target is pressed', () => {
    tracker.setTarget(69, 1.0);
    onCheck.mockClear();
    input.send([NOTE_ON, 67, 100]);
    expect(onCheck).toHaveBeenLastCalledWith(false, 67);
  });

  it('reports active=false on note-off of the target', () => {
    tracker.setTarget(69, 1.0);
    input.send([NOTE_ON, 69, 100]);
    onCheck.mockClear();
    input.send([NOTE_OFF, 69, 0]);
    expect(onCheck).toHaveBeenLastCalledWith(false, null);
  });

  it('treats note-on with velocity 0 as note-off', () => {
    tracker.setTarget(69, 1.0);
    input.send([NOTE_ON, 69, 100]);
    onCheck.mockClear();
    input.send([NOTE_ON, 69, 0]);
    expect(onCheck).toHaveBeenLastCalledWith(false, null);
  });

  it('reports the held target even while a wrong note is also held', () => {
    tracker.setTarget(69, 1.0);
    input.send([NOTE_ON, 67, 100]); // wrong first
    onCheck.mockClear();
    input.send([NOTE_ON, 69, 100]); // then target
    expect(onCheck).toHaveBeenLastCalledWith(true, 69);
  });

  it('falls back to the remaining held note after the target is released', () => {
    tracker.setTarget(69, 1.0);
    input.send([NOTE_ON, 67, 100]);
    input.send([NOTE_ON, 69, 100]);
    onCheck.mockClear();
    input.send([NOTE_OFF, 69, 0]);
    expect(onCheck).toHaveBeenLastCalledWith(false, 67);
  });

  it('fires immediately on setTarget when the new target is already held', () => {
    input.send([NOTE_ON, 71, 100]);
    onCheck.mockClear();
    tracker.setTarget(71, 1.0);
    expect(onCheck).toHaveBeenLastCalledWith(true, 71);
  });

  it('reports active=false with target=0 (rest) regardless of held notes', () => {
    input.send([NOTE_ON, 60, 100]);
    onCheck.mockClear();
    tracker.setTarget(0, 1.0);
    expect(onCheck).toHaveBeenLastCalledWith(false, 60);
  });

  it('attaches to inputs that connect after start()', () => {
    tracker.setTarget(69, 1.0);
    const late = new FakeMIDIInput();
    access.connect('in-2', late);
    onCheck.mockClear();
    late.send([NOTE_ON, 69, 100]);
    expect(onCheck).toHaveBeenLastCalledWith(true, 69);
  });

  it('ignores non-note MIDI messages', () => {
    tracker.setTarget(69, 1.0);
    onCheck.mockClear();
    input.send([0xb0, 7, 100]); // CC volume — not a note
    expect(onCheck).not.toHaveBeenCalled();
  });

  it('reports active=true only when all chord pitches are held', () => {
    tracker.setTarget([60, 64, 67], 1.0);
    input.send([NOTE_ON, 60, 100]);
    input.send([NOTE_ON, 64, 100]);
    onCheck.mockClear();
    input.send([NOTE_ON, 67, 100]);
    expect(onCheck).toHaveBeenLastCalledWith(true, 60);
  });

  it('reports active=false while a chord is partially held', () => {
    tracker.setTarget([60, 64, 67], 1.0);
    onCheck.mockClear();
    input.send([NOTE_ON, 60, 100]);
    input.send([NOTE_ON, 64, 100]);
    // 67 still missing
    expect(onCheck).toHaveBeenLastCalledWith(false, 64);
  });

  it('drops to active=false when one chord pitch is released', () => {
    tracker.setTarget([60, 64, 67], 1.0);
    input.send([NOTE_ON, 60, 100]);
    input.send([NOTE_ON, 64, 100]);
    input.send([NOTE_ON, 67, 100]);
    onCheck.mockClear();
    input.send([NOTE_OFF, 64, 0]);
    expect(onCheck).toHaveBeenLastCalledWith(false, 67);
  });

  it('treats a held superset of the chord as active', () => {
    tracker.setTarget([60, 64, 67], 1.0);
    input.send([NOTE_ON, 60, 100]);
    input.send([NOTE_ON, 64, 100]);
    input.send([NOTE_ON, 67, 100]);
    onCheck.mockClear();
    input.send([NOTE_ON, 72, 100]); // extra note on top
    expect(onCheck).toHaveBeenLastCalledWith(true, 60);
  });

  it('treats setTarget([]) as a rest (always inactive)', () => {
    input.send([NOTE_ON, 60, 100]);
    onCheck.mockClear();
    tracker.setTarget([], 1.0);
    expect(onCheck).toHaveBeenLastCalledWith(false, 60);
  });

  it('stops listening after stop()', () => {
    tracker.setTarget(69, 1.0);
    tracker.stop();
    onCheck.mockClear();
    input.send([NOTE_ON, 69, 100]);
    expect(onCheck).not.toHaveBeenCalled();
  });
});
