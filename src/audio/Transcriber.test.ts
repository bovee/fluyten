/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';

// Mock FrequencyTracker so mic-mode tests don't touch real audio APIs.
const { mockCheckRawFrequency, mockStart, mockStop, mockAudioCtx } = vi.hoisted(
  () => ({
    mockCheckRawFrequency: vi.fn(),
    mockStart: vi.fn().mockResolvedValue(undefined),
    mockStop: vi.fn(),
    mockAudioCtx: { currentTime: 0 },
  })
);

vi.mock('./FrequencyTracker', () => ({
  FrequencyTracker: class {
    audioCtx = mockAudioCtx;
    start = mockStart;
    stop = mockStop;
    checkRawFrequency = mockCheckRawFrequency;
  },
  freqToMidiPitch: (freq: number) =>
    Math.round(12 * Math.log2(freq / 440) + 69),
}));

import { Transcriber } from './Transcriber';

const A4_HZ = 440; // MIDI 69
const C5_HZ = 523.25; // MIDI 72

const MIC_CONFIG = { basePitch: 60, pitchRange: 36, tuning: 1.0 };

describe('Transcriber (mic mode)', () => {
  let onNote: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    onNote = vi.fn();
    mockCheckRawFrequency.mockReset();
    mockStart.mockClear();
    mockStop.mockClear();
    mockAudioCtx.currentTime = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits a single-pitch array when a held note goes silent', async () => {
    const t = new Transcriber('mic', onNote);
    await t.start(MIC_CONFIG);

    mockCheckRawFrequency.mockReturnValueOnce({
      frequency: A4_HZ,
      volume: 0.1,
    });
    vi.advanceTimersByTime(50);
    expect(onNote).not.toHaveBeenCalled(); // note-on alone doesn't emit

    mockAudioCtx.currentTime = 0.5;
    mockCheckRawFrequency.mockReturnValueOnce(null); // silence
    vi.advanceTimersByTime(50);

    expect(onNote).toHaveBeenCalledTimes(1);
    expect(onNote).toHaveBeenCalledWith([69], 0.5);
    t.stop();
  });

  it('emits the previous note when the detected pitch changes', async () => {
    const t = new Transcriber('mic', onNote);
    await t.start(MIC_CONFIG);

    mockCheckRawFrequency.mockReturnValueOnce({
      frequency: A4_HZ,
      volume: 0.1,
    });
    vi.advanceTimersByTime(50);

    mockAudioCtx.currentTime = 0.3;
    mockCheckRawFrequency.mockReturnValueOnce({
      frequency: C5_HZ,
      volume: 0.1,
    });
    vi.advanceTimersByTime(50);

    expect(onNote).toHaveBeenCalledTimes(1);
    expect(onNote).toHaveBeenCalledWith([69], 0.3);
    t.stop();
  });

  it('does not emit while the same pitch is sustained', async () => {
    const t = new Transcriber('mic', onNote);
    await t.start(MIC_CONFIG);

    for (let i = 0; i < 5; i++) {
      mockCheckRawFrequency.mockReturnValueOnce({
        frequency: A4_HZ,
        volume: 0.1,
      });
      vi.advanceTimersByTime(50);
    }

    expect(onNote).not.toHaveBeenCalled();
    t.stop();
  });

  it('applies tuning ratio when mapping frequency to MIDI', async () => {
    const t = new Transcriber('mic', onNote);
    await t.start({ ...MIC_CONFIG, tuning: 0.5 });

    // Detected 220 Hz with tuning=0.5 → divide gives 440 Hz → MIDI 69.
    mockCheckRawFrequency.mockReturnValueOnce({ frequency: 220, volume: 0.1 });
    vi.advanceTimersByTime(50);
    mockAudioCtx.currentTime = 0.2;
    mockCheckRawFrequency.mockReturnValueOnce(null);
    vi.advanceTimersByTime(50);

    expect(onNote).toHaveBeenCalledWith([69], 0.2);
    t.stop();
  });

  it('stop() cancels the polling interval', async () => {
    const t = new Transcriber('mic', onNote);
    await t.start(MIC_CONFIG);
    t.stop();

    mockCheckRawFrequency.mockReturnValue({ frequency: A4_HZ, volume: 0.1 });
    vi.advanceTimersByTime(500);

    expect(mockCheckRawFrequency).not.toHaveBeenCalled();
    expect(mockStop).toHaveBeenCalled();
  });
});

// --- MIDI mocks ---

interface FakeInput {
  type: 'input';
  state: 'connected' | 'disconnected';
  addEventListener: Mock;
  removeEventListener: Mock;
  fire: (data: number[]) => void;
}

function makeFakeInput(): FakeInput {
  let handler: ((e: Event) => void) | null = null;
  const input: any = {
    type: 'input',
    state: 'connected',
    addEventListener: vi.fn((ev: string, h: any) => {
      if (ev === 'midimessage') handler = h;
    }),
    removeEventListener: vi.fn(() => {
      handler = null;
    }),
    fire(data: number[]) {
      handler?.({ data: new Uint8Array(data) } as any);
    },
  };
  return input;
}

function installMidiAccess(inputs: FakeInput[]) {
  let stateHandler: ((e: Event) => void) | null = null;
  const access: any = {
    inputs: { values: () => inputs.values() },
    addEventListener: vi.fn((ev: string, h: any) => {
      if (ev === 'statechange') stateHandler = h;
    }),
    removeEventListener: vi.fn(() => {
      stateHandler = null;
    }),
    fireStateChange: (port: any) => stateHandler?.({ port } as any),
  };
  (navigator as any).requestMIDIAccess = vi.fn().mockResolvedValue(access);
  return access;
}

function noteOn(input: FakeInput, pitch: number, velocity = 100) {
  input.fire([0x90, pitch, velocity]);
}
function noteOff(input: FakeInput, pitch: number) {
  input.fire([0x80, pitch, 0]);
}

describe('Transcriber (MIDI mode)', () => {
  let onNote: Mock;
  let nowMs: number;
  let perfSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    onNote = vi.fn();
    nowMs = 0;
    perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  });

  afterEach(() => {
    perfSpy.mockRestore();
    delete (navigator as any).requestMIDIAccess;
  });

  it('throws when Web MIDI is unavailable', async () => {
    delete (navigator as any).requestMIDIAccess;
    const t = new Transcriber('midi', onNote);
    await expect(
      t.start({ basePitch: 0, pitchRange: 0, tuning: 1 })
    ).rejects.toThrow(/Web MIDI/);
  });

  it('emits a single-pitch chord on a press/release', async () => {
    const input = makeFakeInput();
    installMidiAccess([input]);

    const t = new Transcriber('midi', onNote);
    await t.start({ basePitch: 0, pitchRange: 0, tuning: 1 });

    nowMs = 100;
    noteOn(input, 60);
    nowMs = 600;
    noteOff(input, 60);

    expect(onNote).toHaveBeenCalledTimes(1);
    expect(onNote).toHaveBeenCalledWith([60], 0.5);
    t.stop();
  });

  it('treats velocity-0 note-on as note-off', async () => {
    const input = makeFakeInput();
    installMidiAccess([input]);
    const t = new Transcriber('midi', onNote);
    await t.start({ basePitch: 0, pitchRange: 0, tuning: 1 });

    nowMs = 0;
    noteOn(input, 64);
    nowMs = 250;
    input.fire([0x90, 64, 0]); // note-on with velocity 0 == note-off

    expect(onNote).toHaveBeenCalledWith([64], 0.25);
    t.stop();
  });

  it('groups overlapping notes into one chord and reports them sorted', async () => {
    const input = makeFakeInput();
    installMidiAccess([input]);
    const t = new Transcriber('midi', onNote);
    await t.start({ basePitch: 0, pitchRange: 0, tuning: 1 });

    nowMs = 0;
    noteOn(input, 67); // G
    nowMs = 50;
    noteOn(input, 60); // C (added below G)
    nowMs = 100;
    noteOn(input, 64); // E
    nowMs = 800;
    noteOff(input, 60);
    nowMs = 850;
    noteOff(input, 67);
    expect(onNote).not.toHaveBeenCalled(); // E still held → chord not done
    nowMs = 900;
    noteOff(input, 64);

    expect(onNote).toHaveBeenCalledTimes(1);
    // Pitches sorted ascending; duration is from first press to last release.
    expect(onNote).toHaveBeenCalledWith([60, 64, 67], 0.9);
    t.stop();
  });

  it('emits separate events when notes are fully detached', async () => {
    const input = makeFakeInput();
    installMidiAccess([input]);
    const t = new Transcriber('midi', onNote);
    await t.start({ basePitch: 0, pitchRange: 0, tuning: 1 });

    nowMs = 0;
    noteOn(input, 60);
    nowMs = 200;
    noteOff(input, 60);
    nowMs = 300;
    noteOn(input, 62);
    nowMs = 500;
    noteOff(input, 62);

    expect(onNote).toHaveBeenCalledTimes(2);
    expect(onNote).toHaveBeenNthCalledWith(1, [60], 0.2);
    expect(onNote).toHaveBeenNthCalledWith(2, [62], 0.2);
    t.stop();
  });

  it('ignores stray note-offs with no matching note-on', async () => {
    const input = makeFakeInput();
    installMidiAccess([input]);
    const t = new Transcriber('midi', onNote);
    await t.start({ basePitch: 0, pitchRange: 0, tuning: 1 });

    noteOff(input, 60); // never pressed

    expect(onNote).not.toHaveBeenCalled();
    t.stop();
  });

  it('attaches inputs that connect after start', async () => {
    const access = installMidiAccess([]);
    const t = new Transcriber('midi', onNote);
    await t.start({ basePitch: 0, pitchRange: 0, tuning: 1 });

    const lateInput = makeFakeInput();
    access.fireStateChange(lateInput);

    nowMs = 0;
    noteOn(lateInput, 72);
    nowMs = 400;
    noteOff(lateInput, 72);

    expect(onNote).toHaveBeenCalledWith([72], 0.4);
    t.stop();
  });

  it('stop() detaches handlers so further messages are ignored', async () => {
    const input = makeFakeInput();
    installMidiAccess([input]);
    const t = new Transcriber('midi', onNote);
    await t.start({ basePitch: 0, pitchRange: 0, tuning: 1 });

    t.stop();
    expect(input.removeEventListener).toHaveBeenCalled();

    // After stop, the captured handler is null — firing produces nothing.
    nowMs = 0;
    noteOn(input, 60);
    nowMs = 200;
    noteOff(input, 60);
    expect(onNote).not.toHaveBeenCalled();
  });
});
