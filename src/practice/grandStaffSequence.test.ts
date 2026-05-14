import { describe, it, expect } from 'vitest';
import { buildGrandStaffPracticeSequence } from './grandStaffSequence';
import { fromAbc } from '../io/abcImport';

describe('buildGrandStaffPracticeSequence', () => {
  it('two voices with identical rhythms emit one event per onset', () => {
    const treble = fromAbc('M:4/4\nL:1/4\nK:C\nC D E F |');
    const bass = fromAbc('M:4/4\nL:1/4\nK:C clef=bass\nC,, D,, E,, F,, |');
    const seq = buildGrandStaffPracticeSequence([treble, bass]);
    expect(seq).toHaveLength(4);
    for (const e of seq) {
      expect(e.expectedPitches[0]).toHaveLength(1);
      expect(e.expectedPitches[1]).toHaveLength(1);
      expect(e.originalIndices[0]).not.toBeNull();
      expect(e.originalIndices[1]).not.toBeNull();
    }
  });

  it('different rhythms produce events at every onset (union)', () => {
    // Treble: half + half  → onsets at tick 0 and 2048
    // Bass:   four quarters → onsets at tick 0, 1024, 2048, 3072
    const treble = fromAbc('M:4/4\nL:1/4\nK:C\nC2 G2 |');
    const bass = fromAbc('M:4/4\nL:1/4\nK:C clef=bass\nC,, D,, E,, F,, |');
    const seq = buildGrandStaffPracticeSequence([treble, bass]);
    expect(seq).toHaveLength(4);
    expect(seq.map((e) => e.tick)).toEqual([0, 1024, 2048, 3072]);
    // At tick 1024: treble half still sounding → no fresh treble onset.
    expect(seq[1].expectedPitches[0]).toEqual([]);
    expect(seq[1].originalIndices[0]).toBeNull();
    expect(seq[1].expectedPitches[1]).toHaveLength(1);
    expect(seq[1].originalIndices[1]).not.toBeNull();
    // At tick 0 and 2048: both voices have onsets.
    expect(seq[0].originalIndices[0]).not.toBeNull();
    expect(seq[0].originalIndices[1]).not.toBeNull();
    expect(seq[2].originalIndices[0]).not.toBeNull();
    expect(seq[2].originalIndices[1]).not.toBeNull();
  });

  it('a rest in one voice produces an empty inner pitch list', () => {
    const treble = fromAbc('M:4/4\nL:1/4\nK:C\nC z E F |');
    const bass = fromAbc('M:4/4\nL:1/4\nK:C clef=bass\nC,, D,, E,, F,, |');
    const seq = buildGrandStaffPracticeSequence([treble, bass]);
    // Tick 1024 (beat 2): treble rest, bass D,,
    const beat2 = seq.find((e) => e.tick === 1024)!;
    expect(beat2.expectedPitches[0]).toEqual([]); // rest → no pitches
    expect(beat2.originalIndices[0]).not.toBeNull(); // rest still has an original index
    expect(beat2.expectedPitches[1]).toHaveLength(1);
  });

  it('a single-voice input generalises to a 1-voice sequence', () => {
    const treble = fromAbc('M:4/4\nL:1/4\nK:C\nC D E F |');
    const seq = buildGrandStaffPracticeSequence([treble]);
    expect(seq).toHaveLength(4);
    for (const e of seq) {
      expect(e.expectedPitches).toHaveLength(1);
      expect(e.originalIndices).toHaveLength(1);
    }
  });

  it('chords produce multiple inner pitches', () => {
    const treble = fromAbc('M:4/4\nL:1/4\nK:C\n[CEG] D E F |');
    const bass = fromAbc('M:4/4\nL:1/4\nK:C clef=bass\nC,, D,, E,, F,, |');
    const seq = buildGrandStaffPracticeSequence([treble, bass]);
    expect(seq[0].expectedPitches[0]).toHaveLength(3);
  });
});
