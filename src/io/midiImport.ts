import { Duration, DurationModifier, Music, Note } from '../music';
import { DURATION_TICKS } from '../constants';

// Key signature: sharps/flats count → key name
const FIFTHS_TO_MAJOR_KEY: Record<number, string> = {
  '-7': 'Cb',
  '-6': 'Gb',
  '-5': 'Db',
  '-4': 'Ab',
  '-3': 'Eb',
  '-2': 'Bb',
  '-1': 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
};

const FIFTHS_TO_MINOR_KEY: Record<number, string> = {
  '-7': 'Abm',
  '-6': 'Ebm',
  '-5': 'Bbm',
  '-4': 'Fm',
  '-3': 'Cm',
  '-2': 'Gm',
  '-1': 'Dm',
  0: 'Am',
  1: 'Em',
  2: 'Bm',
  3: 'F#m',
  4: 'C#m',
  5: 'G#m',
  6: 'D#m',
};

// Quantization targets: [internalTicks, Duration, DurationModifier], largest first
const QUANT_TABLE: [number, Duration, DurationModifier][] = [
  [DURATION_TICKS.WHOLE, Duration.WHOLE, DurationModifier.NONE],
  [DURATION_TICKS.HALF_DOTTED, Duration.HALF, DurationModifier.DOTTED],
  [DURATION_TICKS.HALF, Duration.HALF, DurationModifier.NONE],
  [DURATION_TICKS.QUARTER_DOTTED, Duration.QUARTER, DurationModifier.DOTTED],
  [DURATION_TICKS.QUARTER, Duration.QUARTER, DurationModifier.NONE],
  [DURATION_TICKS.EIGHTH_DOTTED, Duration.EIGHTH, DurationModifier.DOTTED],
  [DURATION_TICKS.EIGHTH, Duration.EIGHTH, DurationModifier.NONE],
  [
    DURATION_TICKS.SIXTEENTH_DOTTED,
    Duration.SIXTEENTH,
    DurationModifier.DOTTED,
  ],
  [DURATION_TICKS.SIXTEENTH, Duration.SIXTEENTH, DurationModifier.NONE],
];

// ---- Binary parsing helpers -------------------------------------------------

/** Read a MIDI variable-length quantity. Returns [value, newOffset]. */
function readVarLen(view: DataView, offset: number): [number, number] {
  let value = 0;
  let byte: number;
  do {
    byte = view.getUint8(offset++);
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return [value, offset];
}

interface MidiHeader {
  format: number;
  trackCount: number;
  ticksPerQuarter: number;
}

interface RawNoteEvent {
  tick: number; // absolute MIDI tick
  channel: number;
  pitch: number;
  isOn: boolean;
}

interface MetaEvent {
  tick: number;
  type: number;
  data: Uint8Array;
}

function parseHeader(view: DataView): MidiHeader {
  if (
    view.getUint8(0) !== 0x4d || // M
    view.getUint8(1) !== 0x54 || // T
    view.getUint8(2) !== 0x68 || // h
    view.getUint8(3) !== 0x64 // d
  ) {
    throw new Error('Not a MIDI file: missing MThd header');
  }

  const headerLen = view.getUint32(4);
  if (headerLen < 6) throw new Error('Invalid MIDI header length');

  const format = view.getUint16(8);
  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);

  if (division & 0x8000) {
    throw new Error('SMPTE timing is not supported');
  }

  return { format, trackCount, ticksPerQuarter: division };
}

function parseTrack(
  view: DataView,
  offset: number
): { noteEvents: RawNoteEvent[]; metaEvents: MetaEvent[]; newOffset: number } {
  if (
    view.getUint8(offset) !== 0x4d || // M
    view.getUint8(offset + 1) !== 0x54 || // T
    view.getUint8(offset + 2) !== 0x72 || // r
    view.getUint8(offset + 3) !== 0x6b // k
  ) {
    throw new Error(`Expected MTrk at offset ${offset}`);
  }

  const trackLen = view.getUint32(offset + 4);
  const trackEnd = offset + 8 + trackLen;
  let pos = offset + 8;

  const noteEvents: RawNoteEvent[] = [];
  const metaEvents: MetaEvent[] = [];
  let absoluteTick = 0;
  let runningStatus = 0;

  while (pos < trackEnd) {
    const [delta, newPos] = readVarLen(view, pos);
    pos = newPos;
    absoluteTick += delta;

    let statusByte = view.getUint8(pos);

    if (statusByte === 0xff) {
      // Meta event: FF type len data
      pos++;
      const metaType = view.getUint8(pos++);
      const [len, dataPos] = readVarLen(view, pos);
      pos = dataPos;
      const data = new Uint8Array(len);
      for (let i = 0; i < len; i++) data[i] = view.getUint8(pos + i);
      metaEvents.push({ tick: absoluteTick, type: metaType, data });
      pos += len;
      runningStatus = 0;
    } else if (statusByte === 0xf0 || statusByte === 0xf7) {
      // SysEx event: skip
      pos++;
      const [len, dataPos] = readVarLen(view, pos);
      pos = dataPos + len;
      runningStatus = 0;
    } else if (statusByte >= 0xf8) {
      // System real-time messages (0xF8–0xFF except 0xFF handled above):
      // single-byte, do not affect running status
      pos++;
    } else if (statusByte >= 0xf1 && statusByte <= 0xf6) {
      // System common messages: skip with their data bytes
      pos++;
      if (statusByte === 0xf2)
        pos += 2; // Song Position Pointer: 2 bytes
      else if (statusByte === 0xf1 || statusByte === 0xf3) pos += 1; // 1 byte
      // 0xF6 (Tune Request), 0xF4, 0xF5: no data bytes
      runningStatus = 0;
    } else {
      // Channel message
      if (statusByte & 0x80) {
        runningStatus = statusByte;
        pos++;
      } else {
        statusByte = runningStatus;
      }

      const msgType = statusByte & 0xf0;
      const channel = statusByte & 0x0f;

      if (msgType === 0x80) {
        // Note Off
        const pitch = view.getUint8(pos++);
        pos++; // skip velocity
        noteEvents.push({ tick: absoluteTick, channel, pitch, isOn: false });
      } else if (msgType === 0x90) {
        // Note On (velocity 0 = Note Off)
        const pitch = view.getUint8(pos++);
        const velocity = view.getUint8(pos++);
        noteEvents.push({
          tick: absoluteTick,
          channel,
          pitch,
          isOn: velocity > 0,
        });
      } else if (msgType === 0xa0 || msgType === 0xb0 || msgType === 0xe0) {
        // Aftertouch, Control Change, Pitch Bend — 2 data bytes
        pos += 2;
      } else if (msgType === 0xc0 || msgType === 0xd0) {
        // Program Change, Channel Pressure — 1 data byte
        pos += 1;
      }
    }
  }

  return { noteEvents, metaEvents, newOffset: trackEnd };
}

// ---- Note pairing and quantization ------------------------------------------

interface MidiNote {
  pitch: number;
  channel: number;
  startTick: number;
  durationTicks: number;
}

/** Pair note-on/off events into notes with durations, skipping drum channel. */
function pairNotes(events: RawNoteEvent[]): MidiNote[] {
  const open = new Map<number, { tick: number; channel: number }>(); // channel*128 + pitch → startTick
  const notes: MidiNote[] = [];

  for (const ev of events) {
    if (ev.channel === 9) continue; // skip GM drum channel

    const key = ev.channel * 128 + ev.pitch;
    if (ev.isOn) {
      open.set(key, { tick: ev.tick, channel: ev.channel });
    } else {
      const entry = open.get(key);
      if (entry !== undefined) {
        const dur = ev.tick - entry.tick;
        if (dur > 0)
          notes.push({
            pitch: ev.pitch,
            channel: entry.channel,
            startTick: entry.tick,
            durationTicks: dur,
          });
        open.delete(key);
      }
    }
  }

  return notes.sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch);
}

/** Find the closest standard duration for a given internal tick count. */
function quantizeDuration(internalTicks: number): [Duration, DurationModifier] {
  let best = QUANT_TABLE[QUANT_TABLE.length - 1];
  let bestDiff = Infinity;
  for (const entry of QUANT_TABLE) {
    const diff = Math.abs(entry[0] - internalTicks);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return [best[1], best[2]];
}

/** Round an internal tick value to the nearest sixteenth-note grid position. */
function snapToGrid(internalTick: number): number {
  return (
    Math.round(internalTick / DURATION_TICKS.SIXTEENTH) *
    DURATION_TICKS.SIXTEENTH
  );
}

/** Fill a gap (in internal ticks) with the fewest standard-duration rests. */
function fillRestsForGap(ticks: number): Note[] {
  const rests: Note[] = [];
  let remaining = ticks;
  while (remaining >= DURATION_TICKS.SIXTEENTH) {
    let placed = false;
    for (const [t, dur, mod] of QUANT_TABLE) {
      if (t <= remaining) {
        rests.push(new Note(undefined, dur, [], [], mod));
        remaining -= t;
        placed = true;
        break;
      }
    }
    if (!placed) break;
  }
  return rests;
}

// ---- Note-building ----------------------------------------------------------

/**
 * Convert a sorted array of MidiNotes (all from one channel) into Music notes
 * and rests. The music object must already have beatsPerBar/beatValue set.
 */
function buildNotesIntoMusic(
  midiNotes: MidiNote[],
  music: Music,
  ticksPerQuarter: number
): void {
  if (midiNotes.length === 0) return;

  const scale = DURATION_TICKS.QUARTER / ticksPerQuarter;
  const chordThreshold = (ticksPerQuarter / 4) * 0.5; // half a sixteenth in MIDI ticks

  // Group simultaneous notes as chords
  const groups: MidiNote[][] = [];
  let currentGroup: MidiNote[] = [midiNotes[0]];
  for (let i = 1; i < midiNotes.length; i++) {
    if (midiNotes[i].startTick - currentGroup[0].startTick < chordThreshold) {
      currentGroup.push(midiNotes[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [midiNotes[i]];
    }
  }
  groups.push(currentGroup);

  let currentEndTick = 0; // in internal ticks
  for (const group of groups) {
    const startInternal = snapToGrid(group[0].startTick * scale);

    const gap = startInternal - currentEndTick;
    if (gap >= DURATION_TICKS.SIXTEENTH) {
      for (const rest of fillRestsForGap(gap)) music.notes.push(rest);
    }

    const longestTicks = Math.max(...group.map((n) => n.durationTicks));
    const internalDur = Math.round(longestTicks * scale);
    const [duration, modifier] = quantizeDuration(internalDur);

    const pitches = group.map((n) => n.pitch);
    const note = new Note(pitches, duration, [], [], modifier);
    music.notes.push(note);
    currentEndTick = startInternal + note.ticks();
  }
}

// ---- Public API -------------------------------------------------------------

interface ParsedMidi {
  title: string;
  beatsPerBar: number;
  beatValue: number;
  keySignature: string;
  channels: number[];
  channelNotes: Map<number, MidiNote[]>;
  ticksPerQuarter: number;
}

function parseMidiBuffer(buffer: ArrayBuffer): ParsedMidi {
  const view = new DataView(buffer);
  const header = parseHeader(view);

  if (header.format === 2)
    throw new Error('MIDI format 2 (pattern-based) is not supported');
  if (header.ticksPerQuarter === 0)
    throw new Error('Invalid MIDI file: ticksPerQuarter is 0');

  let offset = 8 + view.getUint32(4); // skip past MThd chunk
  const allNoteEvents: RawNoteEvent[] = [];
  const allMetaEvents: MetaEvent[] = [];

  for (let i = 0; i < header.trackCount; i++) {
    try {
      const { noteEvents, metaEvents, newOffset } = parseTrack(view, offset);
      allNoteEvents.push(...noteEvents);
      allMetaEvents.push(...metaEvents);
      offset = newOffset;
    } catch {
      break; // skip malformed tracks, keep what we have
    }
  }

  allNoteEvents.sort((a, b) => a.tick - b.tick);
  allMetaEvents.sort((a, b) => a.tick - b.tick);

  let title = '';
  let beatsPerBar = 4;
  let beatValue = 4;
  let keySignature = 'C';

  for (const meta of allMetaEvents) {
    if (meta.type === 0x03 && !title) {
      title = new TextDecoder().decode(meta.data);
    } else if (meta.type === 0x58 && meta.data.length >= 2) {
      beatsPerBar = meta.data[0];
      beatValue = 1 << meta.data[1];
    } else if (meta.type === 0x59 && meta.data.length >= 2) {
      const sf = meta.data[0] > 127 ? meta.data[0] - 256 : meta.data[0];
      const mi = meta.data[1];
      keySignature =
        (mi === 1 ? FIFTHS_TO_MINOR_KEY : FIFTHS_TO_MAJOR_KEY)[sf] ?? 'C';
    }
  }

  const midiNotes = pairNotes(allNoteEvents);
  const channelNotes = new Map<number, MidiNote[]>();
  for (const note of midiNotes) {
    let ch = channelNotes.get(note.channel);
    if (!ch) {
      ch = [];
      channelNotes.set(note.channel, ch);
    }
    ch.push(note);
  }
  const channels = [...channelNotes.keys()].sort((a, b) => a - b);

  return {
    title,
    beatsPerBar,
    beatValue,
    keySignature,
    channels,
    channelNotes,
    ticksPerQuarter: header.ticksPerQuarter,
  };
}

/**
 * Parse a MIDI buffer into an array of Music objects, one per non-drum channel.
 * If the file has no pitched channels an array containing one empty Music
 * (with metadata only) is returned so callers always get at least one object.
 * For single-channel files the array has one element.
 */
export function fromMidi(buffer: ArrayBuffer): Music[] {
  const {
    title,
    beatsPerBar,
    beatValue,
    keySignature,
    channels,
    channelNotes,
    ticksPerQuarter,
  } = parseMidiBuffer(buffer);

  function makeBaseMusic(): Music {
    const m = new Music();
    m.title = title;
    m.beatsPerBar = beatsPerBar;
    m.beatValue = beatValue;
    m.keySignature = keySignature;
    return m;
  }

  if (channels.length === 0) return [makeBaseMusic()];

  return channels.map((ch) => {
    const music = makeBaseMusic();
    buildNotesIntoMusic(channelNotes.get(ch)!, music, ticksPerQuarter);
    music.reflow();
    return music;
  });
}
