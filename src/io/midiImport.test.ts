import { describe, it, expect } from 'vitest';
import { fromMidi, fromMidiToAbc } from './midiImport';
import { Duration, DurationModifier } from '../music';

// ---- MIDI binary builder helpers --------------------------------------------

/** Encode a number as a MIDI variable-length quantity. */
function varLen(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  bytes.push(n & 0x7f);
  n >>= 7;
  while (n > 0) {
    bytes.push((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes.reverse();
}

/** Write a 16-bit big-endian value. */
function u16(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

/** Write a 32-bit big-endian value. */
function u32(n: number): number[] {
  return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Build a complete MIDI file from track event data arrays. */
function buildMidi(
  ticksPerQuarter: number,
  ...tracks: number[][]
): ArrayBuffer {
  const format = tracks.length === 1 ? 0 : 1;
  const header = [
    ...[0x4d, 0x54, 0x68, 0x64], // MThd
    ...u32(6),
    ...u16(format),
    ...u16(tracks.length),
    ...u16(ticksPerQuarter),
  ];

  const trackChunks: number[] = [];
  for (const events of tracks) {
    trackChunks.push(0x4d, 0x54, 0x72, 0x6b); // MTrk
    trackChunks.push(...u32(events.length));
    trackChunks.push(...events);
  }

  const buf = new Uint8Array([...header, ...trackChunks]);
  return buf.buffer;
}

/** Note-on event: delta, 0x9n, pitch, velocity. */
function noteOn(
  delta: number,
  pitch: number,
  velocity: number = 80,
  channel: number = 0
): number[] {
  return [...varLen(delta), 0x90 | channel, pitch, velocity];
}

/** Note-off event: delta, 0x8n, pitch, velocity. */
function noteOff(delta: number, pitch: number, channel: number = 0): number[] {
  return [...varLen(delta), 0x80 | channel, pitch, 0];
}

/** End of track meta event. */
function endOfTrack(delta: number = 0): number[] {
  return [...varLen(delta), 0xff, 0x2f, 0x00];
}

/** Time signature meta event: delta, FF 58 04, nn dd cc bb. */
function timeSig(
  delta: number,
  numerator: number,
  denomPower: number
): number[] {
  return [
    ...varLen(delta),
    0xff,
    0x58,
    0x04,
    numerator,
    denomPower,
    0x18,
    0x08,
  ];
}

/** Key signature meta event: delta, FF 59 02, sf mi. */
function keySig(delta: number, sf: number, minor: number): number[] {
  return [...varLen(delta), 0xff, 0x59, 0x02, sf & 0xff, minor];
}

/** Track name meta event. */
function trackName(delta: number, name: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(name));
  return [...varLen(delta), 0xff, 0x03, ...varLen(bytes.length), ...bytes];
}

// ---- Tests ------------------------------------------------------------------

describe('fromMidi', () => {
  it('parses a single quarter note', () => {
    const tpq = 480;
    const track = [
      ...noteOn(0, 60), // C4 at tick 0
      ...noteOff(tpq, 60), // off at tick 480 (1 quarter note)
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.notes.length).toBe(1);
    expect(music.notes[0].pitches).toEqual([60]);
    expect(music.notes[0].duration).toBe(Duration.QUARTER);
  });

  it('parses multiple notes of different durations', () => {
    const tpq = 480;
    const track = [
      ...noteOn(0, 60), // C4 quarter
      ...noteOff(tpq, 60),
      ...noteOn(0, 62), // D4 half
      ...noteOff(tpq * 2, 62),
      ...noteOn(0, 64), // E4 eighth
      ...noteOff(tpq / 2, 64),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.notes.length).toBe(3);
    expect(music.notes[0].duration).toBe(Duration.QUARTER);
    expect(music.notes[1].duration).toBe(Duration.HALF);
    expect(music.notes[2].duration).toBe(Duration.EIGHTH);
  });

  it('inserts rests for gaps between notes', () => {
    const tpq = 480;
    const track = [
      ...noteOn(0, 60),
      ...noteOff(tpq, 60), // quarter note ends at 480
      ...noteOn(tpq, 62), // D starts at 960 (gap of 1 quarter)
      ...noteOff(tpq, 62),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.notes.length).toBe(3);
    expect(music.notes[0].pitches).toEqual([60]);
    expect(music.notes[1].pitches).toEqual([]); // rest
    expect(music.notes[2].pitches).toEqual([62]);
  });

  it('groups simultaneous notes as chords', () => {
    const tpq = 480;
    const track = [
      ...noteOn(0, 60), // C4
      ...noteOn(0, 64), // E4 (same tick)
      ...noteOff(tpq, 60),
      ...noteOff(0, 64),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.notes.length).toBe(1);
    expect(music.notes[0].pitches).toContain(60);
    expect(music.notes[0].pitches).toContain(64);
  });

  it('parses dotted quarter note duration', () => {
    const tpq = 480;
    const dottedQuarter = tpq * 1.5;
    const track = [
      ...noteOn(0, 60),
      ...noteOff(dottedQuarter, 60),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.notes[0].duration).toBe(Duration.QUARTER);
    expect(music.notes[0].durationModifier).toBe(DurationModifier.DOTTED);
  });

  it('reads time signature meta event', () => {
    const tpq = 480;
    const track = [
      ...timeSig(0, 3, 2), // 3/4 time (denominator = 2^2 = 4)
      ...noteOn(0, 60),
      ...noteOff(tpq, 60),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.beatsPerBar).toBe(3);
    expect(music.beatValue).toBe(4);
  });

  it('reads key signature meta event (G major)', () => {
    const tpq = 480;
    const track = [
      ...keySig(0, 1, 0), // 1 sharp, major = G
      ...noteOn(0, 60),
      ...noteOff(tpq, 60),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.keySignature).toBe('G');
  });

  it('reads key signature meta event (D minor)', () => {
    const tpq = 480;
    const track = [
      ...keySig(0, 0xff, 1), // -1 flat (0xFF signed), minor = Dm
      ...noteOn(0, 60),
      ...noteOff(tpq, 60),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.keySignature).toBe('Dm');
  });

  it('reads track name meta event', () => {
    const tpq = 480;
    const track = [
      ...trackName(0, 'My Song'),
      ...noteOn(0, 60),
      ...noteOff(tpq, 60),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.title).toBe('My Song');
  });

  it('skips drum channel (channel 9)', () => {
    const tpq = 480;
    const track = [
      ...noteOn(0, 60, 80, 0), // channel 0: keep
      ...noteOn(0, 36, 80, 9), // channel 9: drum, skip
      ...noteOff(tpq, 60, 0),
      ...noteOff(0, 36, 9),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.notes.length).toBe(1);
    expect(music.notes[0].pitches).toEqual([60]);
  });

  it('merges events from multiple tracks (format 1)', () => {
    const tpq = 480;
    const metaTrack = [
      ...timeSig(0, 4, 2),
      ...trackName(0, 'Song Title'),
      ...endOfTrack(0),
    ];
    const noteTrack = [
      ...noteOn(0, 60),
      ...noteOff(tpq, 60),
      ...noteOn(0, 62),
      ...noteOff(tpq, 62),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, metaTrack, noteTrack));

    expect(music.title).toBe('Song Title');
    expect(music.beatsPerBar).toBe(4);
    expect(music.notes.filter((n) => n.pitches.length > 0).length).toBe(2);
  });

  it('computes bar lines via reflow', () => {
    const tpq = 480;
    // 4 quarter notes = 1 bar in 4/4
    const track = [
      ...timeSig(0, 4, 2),
      ...noteOn(0, 60),
      ...noteOff(tpq, 60),
      ...noteOn(0, 62),
      ...noteOff(tpq, 62),
      ...noteOn(0, 64),
      ...noteOff(tpq, 64),
      ...noteOn(0, 65),
      ...noteOff(tpq, 65),
      ...noteOn(0, 67),
      ...noteOff(tpq, 67),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    // Should have at least 1 bar line after 4 notes
    expect(music.bars.length).toBeGreaterThan(0);
  });

  it('handles velocity 0 as note-off', () => {
    const tpq = 480;
    const track = [
      ...varLen(0),
      0x90,
      60,
      80, // note on C4
      ...varLen(tpq),
      0x90,
      60,
      0, // note on with velocity 0 = note off
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.notes.length).toBe(1);
    expect(music.notes[0].pitches).toEqual([60]);
    expect(music.notes[0].duration).toBe(Duration.QUARTER);
  });

  it('handles leading rest when first note does not start at tick 0', () => {
    const tpq = 480;
    const track = [
      ...noteOn(tpq, 60), // starts at tick 480 (quarter rest first)
      ...noteOff(tpq, 60),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.notes.length).toBe(2);
    expect(music.notes[0].pitches).toEqual([]); // rest
    expect(music.notes[1].pitches).toEqual([60]);
  });

  it('returns empty Music for file with no notes', () => {
    const tpq = 480;
    const track = [...endOfTrack(0)];
    const music = fromMidi(buildMidi(tpq, track));

    expect(music.notes.length).toBe(0);
  });

  it('throws on invalid header', () => {
    const buf = new Uint8Array([0, 0, 0, 0]).buffer;
    expect(() => fromMidi(buf)).toThrow('Not a MIDI file');
  });

  it('throws on SMPTE timing', () => {
    const header = [
      0x4d,
      0x54,
      0x68,
      0x64, // MThd
      ...u32(6),
      ...u16(0), // format 0
      ...u16(1), // 1 track
      0x80,
      0x00, // SMPTE: bit 15 set
    ];
    const track = [0x4d, 0x54, 0x72, 0x6b, ...u32(4), ...endOfTrack(0)];
    const buf = new Uint8Array([...header, ...track]).buffer;
    expect(() => fromMidi(buf)).toThrow('SMPTE');
  });

  it('fromMidi returns first channel only for multi-channel files', () => {
    const tpq = 480;
    const track = [
      ...noteOn(0, 60, 80, 0), // ch 0: C4
      ...noteOn(0, 64, 80, 1), // ch 1: E4
      ...noteOff(tpq, 60, 0),
      ...noteOff(0, 64, 1),
      ...endOfTrack(0),
    ];
    const music = fromMidi(buildMidi(tpq, track));
    // fromMidi only returns the first channel
    expect(music.notes.length).toBe(1);
    expect(music.notes[0].pitches).toEqual([60]);
  });

  it('fromMidiToAbc produces multi-voice ABC for multi-channel files', () => {
    const tpq = 480;
    const track = [
      ...noteOn(0, 60, 80, 0), // ch 0: C4 quarter
      ...noteOn(0, 64, 80, 1), // ch 1: E4 quarter
      ...noteOff(tpq, 60, 0),
      ...noteOff(0, 64, 1),
      ...endOfTrack(0),
    ];
    const { abc } = fromMidiToAbc(buildMidi(tpq, track));
    expect(abc).toContain('V:1');
    expect(abc).toContain('V:2');
  });

  it('fromMidiToAbc returns plain ABC for single-channel files', () => {
    const tpq = 480;
    const track = [...noteOn(0, 60), ...noteOff(tpq, 60), ...endOfTrack(0)];
    const { abc } = fromMidiToAbc(buildMidi(tpq, track));
    expect(abc).not.toContain('V:');
  });
});
