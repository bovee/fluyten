import { describe, it, expect } from 'vitest';
import { getSynthProfileForGmInstrument } from './synthProfiles';

describe('getSynthProfileForGmInstrument', () => {
  it.each([
    [undefined, 'default'],
    [1, 'piano'],
    [24, 'piano'],
    [25, 'guitar'],
    [40, 'guitar'],
    [41, 'violin'],
    [48, 'violin'],
    [49, 'default'],
    [56, 'default'],
    [57, 'trumpet'],
    [64, 'trumpet'],
    [65, 'oboe'],
    [72, 'oboe'],
    [73, 'recorder'],
    [80, 'recorder'],
    [81, 'default'],
    [128, 'default'],
    [0, 'default'],
    [129, 'default'],
    [-1, 'default'],
  ] as const)('GM %s -> %s', (gm, expectedId) => {
    expect(getSynthProfileForGmInstrument(gm).id).toBe(expectedId);
  });
});
