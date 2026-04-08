import { detectMidiFromSamples } from './mpm';

type WorkerInput = {
  samples: Float32Array;
  minLag: number;
  maxLag: number;
  sampleRate: number;
};

type WorkerOutput = {
  midi: number | null;
};

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { samples, minLag, maxLag, sampleRate } = e.data;
  self.postMessage({
    midi: detectMidiFromSamples(samples, minLag, maxLag, sampleRate),
  } satisfies WorkerOutput);
};
