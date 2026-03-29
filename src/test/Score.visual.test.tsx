import { cdp, commands, page } from 'vitest/browser';
import { composeStories } from '@storybook/react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { beforeAll, describe, it, expect, afterEach } from 'vitest';
import * as stories from '../engraving/Score.stories';

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
// Also wait for fonts (Bravura) to finish loading before any test runs.
beforeAll(async () => {
  await page.viewport(1280, 720);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (cdp() as any).send('Runtime.evaluate', {
    expression: 'document.fonts.ready',
    awaitPromise: true,
  });
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
      // Wait for two animation frames so the browser finishes painting glyphs
      // (especially important for the first test, where fonts may not yet be
      // applied to DOM elements even though document.fonts.ready resolved).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (cdp() as any).send('Runtime.evaluate', {
        expression:
          'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))',
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
