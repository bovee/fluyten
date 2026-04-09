import { describe, it, expect } from 'vitest';
import {
  resolveInstrumentConfig,
  getStarterBookUrl,
  isStarterBookUrl,
  RECORDER_TYPES,
  type RecorderType,
} from './instrument';

describe('resolveInstrumentConfig', () => {
  it('returns preset config for a named instrument type', () => {
    const config = resolveInstrumentConfig('SOPRANO', '', '');
    expect(config).toEqual(RECORDER_TYPES.SOPRANO);
    expect(config?.basePitch).toBe(72);
  });

  it('returns preset config for ALTO', () => {
    const config = resolveInstrumentConfig('ALTO', '', '');
    expect(config?.basePitch).toBe(65);
  });

  it('parses custom base and high note strings when type is null', () => {
    // C4 = MIDI 60, C6 = MIDI 84, range = 24
    const config = resolveInstrumentConfig(null, 'C4', 'C6');
    expect(config).not.toBeNull();
    expect(config?.basePitch).toBe(60);
    expect(config?.pitchRange).toBe(24);
  });

  it('returns null for invalid base pitch string', () => {
    expect(resolveInstrumentConfig(null, 'not-a-note', 'C6')).toBeNull();
  });

  it('returns null for invalid high note string', () => {
    expect(resolveInstrumentConfig(null, 'C4', 'xyz')).toBeNull();
  });

  it('returns null when high note equals base pitch', () => {
    expect(resolveInstrumentConfig(null, 'C4', 'C4')).toBeNull();
  });

  it('returns null when high note is below base pitch', () => {
    expect(resolveInstrumentConfig(null, 'C5', 'C4')).toBeNull();
  });
});

describe('getStarterBookUrl', () => {
  it('returns empty string for null instrument type', () => {
    expect(getStarterBookUrl(null)).toBe('');
  });

  it.each<[RecorderType, string]>([
    ['TENOR', 'beginner-songs-c.abc'],
    ['GARKLEIN', 'beginner-songs-c.abc'],
    ['GREATBASS', 'beginner-songs-c.abc'],
    ['ALTO', 'beginner-songs-f.abc'],
    ['CONTRABASS', 'beginner-songs-f.abc'],
  ])(
    'returns correct starter book URL for %s',
    (instrumentType, expectedFile) => {
      expect(getStarterBookUrl(instrumentType)).toContain(expectedFile);
    }
  );

  it('returns empty string for instruments with non-C/F base (VOICEFLUTE)', () => {
    expect(getStarterBookUrl('VOICEFLUTE')).toBe('');
  });
});

describe('isStarterBookUrl', () => {
  it('returns true for c-based starter URL', () => {
    expect(isStarterBookUrl('https://example.com/beginner-songs-c.abc')).toBe(
      true
    );
  });

  it('returns true for f-based starter URL', () => {
    expect(isStarterBookUrl('https://example.com/beginner-songs-f.abc')).toBe(
      true
    );
  });

  it('returns false for unrelated URL', () => {
    expect(isStarterBookUrl('https://example.com/my-songs.abc')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isStarterBookUrl('')).toBe(false);
  });
});
