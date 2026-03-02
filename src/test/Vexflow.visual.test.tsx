import { cdp, commands, page } from 'vitest/browser';
import { composeStories } from '@storybook/react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { beforeAll, describe, it, expect, afterEach } from 'vitest';
import * as stories from '../Vexflow.stories';

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
// barsPerLine = Math.floor((1000 - 40) / 250) = 3
beforeAll(async () => {
  await page.viewport(1000, 720);
});

afterEach(cleanup);

async function captureBase64(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (cdp() as any).send('Page.captureScreenshot', {
    format: 'png',
  });
  return data as string;
}

describe('Vexflow visual regression', () => {
  for (const [name, Story] of Object.entries(composed)) {
    it(name, async () => {
      const { container } = render(<Story />);
      await waitFor(() => expect(container.querySelector('svg')).toBeTruthy());
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
