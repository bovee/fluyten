export class AudioContextMock {
  currentTime = 0;
  sampleRate = 44100;
  destination = {};

  createGain() {
    return {
      connect: () => {},
      disconnect: () => {},
      gain: {
        value: 1,
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
      },
    };
  }

  createOscillator() {
    return {
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {},
      type: 'sine',
      frequency: { value: 440 },
    };
  }

  createAnalyser() {
    return {
      connect: () => {},
      disconnect: () => {},
      fftSize: 2048,
      minDecibels: -100,
      maxDecibels: -30,
      smoothingTimeConstant: 0.8,
      frequencyBinCount: 1024,
      getByteFrequencyData: (array: Uint8Array) => {
        if (array) array.fill(0);
      },
    };
  }

  createMediaStreamSource(stream: MediaStream) {
    return {
      connect: () => {},
      disconnect: () => {},
      mediaStream: stream,
    };
  }

  close() {
    return Promise.resolve();
  }
}

export const setupAudioMocks = () => {
  if (typeof window !== 'undefined') {
    window.AudioContext = AudioContextMock as unknown as typeof AudioContext;
    (
      window as Window & { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext = AudioContextMock as unknown as typeof AudioContext;
  }

  if (typeof navigator !== 'undefined') {
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
      });
    }
    navigator.mediaDevices.getUserMedia = () =>
      Promise.resolve({
        getTracks: () => [{ stop: () => {} }],
      } as MediaStream);
  }
};
