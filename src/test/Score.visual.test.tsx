import { cdp, commands, page } from 'vitest/browser';
import { composeStories, setProjectAnnotations } from '@storybook/react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { beforeAll, describe, it, expect, afterEach } from 'vitest';
import * as stories from '../engraving/Score.stories';
import * as preview from '../../.storybook/preview';

// Apply storybook preview annotations (decorators, CSS imports including the
// Bravura @font-face) so that composeStories picks them up in this test context.
setProjectAnnotations([preview]);

declare module 'vitest/browser' {
  interface BrowserCommands {
    matchScreenshot(
      name: string,
      base64: string,
      update: boolean
    ): Promise<string | null>;
  }
}

const composed = composeStories(stories);

// Pin to a fixed viewport so stories that depend on line-wrapping are stable.
// Also warm up the Bravura font cache with a throwaway render so all glyph
// subsets (including accidentals) are GPU-cached before any comparison test runs.
beforeAll(async () => {
  await page.viewport(1280, 720);
  const [FirstStory] = Object.values(composed);
  const { container, unmount } = render(<FirstStory />);
  await waitFor(() => expect(container.querySelector('svg')).toBeTruthy());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (cdp() as any).send('Runtime.evaluate', {
    expression:
      "document.fonts.load('1em Bravura').then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))",
    awaitPromise: true,
  });
  unmount();
});

afterEach(cleanup);

async function captureBase64(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (cdp() as any).send('Page.captureScreenshot', {
    format: 'png',
  });
  return data as string;
}

describe('Score visual regression', () => {
  for (const [name, Story] of Object.entries(composed)) {
    it(name, async () => {
      const { container } = render(<Story />);
      await waitFor(() => expect(container.querySelector('svg')).toBeTruthy());
      // document.fonts.load() blocks until Bravura is fully applied to the
      // current document context, which is more reliable than document.fonts.ready
      // (which resolves before fonts are painted on newly-mounted DOM nodes).
      // The rAF chain after ensures the browser has finished the paint pass.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (cdp() as any).send('Runtime.evaluate', {
        expression:
          "document.fonts.load('1em Bravura').then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))",
        awaitPromise: true,
      });
      const base64 = await captureBase64();
      const update = import.meta.env.VITE_UPDATE_SCREENSHOTS === 'true';
      const baselineBase64 = await commands.matchScreenshot(
        name,
        base64,
        update
      );
      if (baselineBase64 !== null) {
        expect(base64).toBe(baselineBase64);
      }
    });
  }
});
