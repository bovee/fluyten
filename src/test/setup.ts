import '@testing-library/jest-dom';
import '../i18n';
import { setupAudioMocks } from './audioMocks';

setupAudioMocks();

// happy-dom doesn't implement the Canvas 2D API, so Vexflow's text measurement
// falls back to a console.warn on every render. Stub getContext('2d') only when
// the environment lacks a real implementation (i.e. not in a real browser).
if (!document.createElement('canvas').getContext('2d')) {
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
    const element = this;
    if (contextId === '2d') {
      return {
        font: '',
        measureText: () => ({
          width: 0,
          actualBoundingBoxAscent: 0,
          actualBoundingBoxDescent: 0,
        }),
        fillText: () => {},
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        save: () => {},
        restore: () => {},
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        setTransform: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        canvas: element,
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;
}

// Setup global test utilities
beforeEach(() => {
  // Clear any mocks or state between tests
});

afterEach(() => {
  // Cleanup after each test
});
