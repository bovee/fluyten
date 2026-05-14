import { describe, it, expect } from 'vitest';
import { findGrandStaffPair } from './grandStaff';
import { Music } from '../music';
import type { VoiceInfo, ScoreGroup } from './abcImport';

function voice(
  id: string,
  clef: Music['clef'],
  opts: { midiInstrument?: number; braceGroup?: ScoreGroup } = {}
): VoiceInfo {
  const m = new Music();
  m.clef = clef;
  return {
    id,
    name: id,
    music: m,
    midiInstrument: opts.midiInstrument,
    braceGroup: opts.braceGroup,
  };
}

describe('findGrandStaffPair', () => {
  it('returns null when no bass voice exists', () => {
    const vs = [voice('A', 'treble'), voice('B', 'treble')];
    expect(findGrandStaffPair(vs)).toBeNull();
  });

  it('returns null when no treble voice exists', () => {
    const vs = [voice('A', 'bass'), voice('B', 'bass')];
    expect(findGrandStaffPair(vs)).toBeNull();
  });

  it('falls back to first treble + first bass', () => {
    const vs = [voice('A', 'treble'), voice('B', 'bass')];
    const pair = findGrandStaffPair(vs);
    expect(pair?.treble.id).toBe('A');
    expect(pair?.bass.id).toBe('B');
  });

  it('prefers a brace-grouped pair', () => {
    const group: ScoreGroup = {
      voices: ['RH', 'LH'],
      sameStaff: [],
    };
    const vs = [
      voice('Solo', 'treble'),
      voice('RH', 'treble', { braceGroup: group }),
      voice('LH', 'bass', { braceGroup: group }),
      voice('Cello', 'bass'),
    ];
    const pair = findGrandStaffPair(vs);
    expect(pair?.treble.id).toBe('RH');
    expect(pair?.bass.id).toBe('LH');
  });

  it('prefers a piano-instrument pair over arbitrary fallback', () => {
    const vs = [
      voice('Flute', 'treble', { midiInstrument: 74 }),
      voice('PianoRH', 'treble', { midiInstrument: 1 }),
      voice('Cello', 'bass', { midiInstrument: 43 }),
      voice('PianoLH', 'bass', { midiInstrument: 1 }),
    ];
    const pair = findGrandStaffPair(vs);
    expect(pair?.treble.id).toBe('PianoRH');
    expect(pair?.bass.id).toBe('PianoLH');
  });

  it('handles treble8va and bass8va clefs', () => {
    const vs = [voice('A', 'treble8va'), voice('B', 'bass8va')];
    const pair = findGrandStaffPair(vs);
    expect(pair?.treble.id).toBe('A');
    expect(pair?.bass.id).toBe('B');
  });
});
