import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicTimeline } from './MusicTimeline';
import { fromAbc } from '../io/abcImport';

// Four quarter notes in C major, 4/4 time
const FOUR_QUARTERS = `X:1\nT:Test\nM:4/4\nL:1/4\nK:C\nC D E F\n`;

function makeTimeline(abc: string, tempo = 60, offset = 0): MusicTimeline {
  const music = fromAbc(abc);
  return new MusicTimeline(music, tempo, offset);
}

describe('MusicTimeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getTimeForExpandedIndex(0) returns 0', () => {
    const tl = makeTimeline(FOUR_QUARTERS);
    expect(tl.getTimeForExpandedIndex(0)).toBe(0);
  });

  it('quarter notes at 60bpm: each note is 1 second apart', () => {
    const tl = makeTimeline(FOUR_QUARTERS, 60);
    expect(tl.getTimeForExpandedIndex(0)).toBeCloseTo(0);
    expect(tl.getTimeForExpandedIndex(1)).toBeCloseTo(1);
    expect(tl.getTimeForExpandedIndex(2)).toBeCloseTo(2);
    expect(tl.getTimeForExpandedIndex(3)).toBeCloseTo(3);
  });

  it('quarter notes at 120bpm: each note is 0.5 seconds apart', () => {
    const tl = makeTimeline(FOUR_QUARTERS, 120);
    expect(tl.getTimeForExpandedIndex(1)).toBeCloseTo(0.5);
    expect(tl.getTimeForExpandedIndex(2)).toBeCloseTo(1.0);
  });

  it('getNoteIdxAtTime(0) returns 0', () => {
    const tl = makeTimeline(FOUR_QUARTERS);
    expect(tl.getNoteIdxAtTime(0)).toBe(0);
  });

  it('getNoteIdxAtTime at halfway through first note returns fractional index between 0 and 1', () => {
    const tl = makeTimeline(FOUR_QUARTERS, 60);
    const result = tl.getNoteIdxAtTime(0.5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('getNoteIdxAtTime past all notes returns last note index + 1', () => {
    const tl = makeTimeline(FOUR_QUARTERS, 60);
    const result = tl.getNoteIdxAtTime(100);
    expect(result).toBeGreaterThanOrEqual(3);
  });

  it('isFinished() returns false before start()', () => {
    const tl = makeTimeline(FOUR_QUARTERS);
    expect(tl.isFinished()).toBe(false);
  });

  it('isFinished() returns false immediately after start()', () => {
    const nowMock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const tl = makeTimeline(FOUR_QUARTERS, 60);
    tl.start();
    nowMock.mockReturnValue(100); // 0.1s elapsed
    expect(tl.isFinished()).toBe(false);
  });

  it('isFinished() returns true after total duration has elapsed', () => {
    // 4 quarter notes at 60bpm = 4 seconds total
    const nowMock = vi.spyOn(performance, 'now').mockReturnValue(0);
    const tl = makeTimeline(FOUR_QUARTERS, 60);
    tl.start();
    nowMock.mockReturnValue(5000); // 5 seconds elapsed
    expect(tl.isFinished()).toBe(true);
  });

  it('startTimeOffset shifts getNoteIdxAtTime by the offset', () => {
    const tl0 = makeTimeline(FOUR_QUARTERS, 60, 0);
    const tl1 = makeTimeline(FOUR_QUARTERS, 60, 1);
    // With 1s offset, querying t=0 on tl1 is like querying t=1 on tl0
    expect(tl1.getNoteIdxAtTime(0)).toBeCloseTo(tl0.getNoteIdxAtTime(1));
  });
});
