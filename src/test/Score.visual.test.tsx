import { cdp, commands, page } from 'vitest/browser';
import { composeStories, setProjectAnnotations } from '@storybook/react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { beforeAll, describe, it, expect, afterEach } from 'vitest';
import * as stories from '../engraving/Score.stories';
import * as preview from '../../.storybook/preview';
import { SMUFL } from '../engraving/glyphs/smufl';

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
// Warm up the Bravura font cache by (1) painting every SMuFL glyph as HTML
// text and (2) throwaway-rendering every story. document.fonts.load resolves
// once the font file is available, but Chromium rasterizes glyph subsets
// lazily on first paint and keys its glyph cache on (font, size), so a single
// warmup render doesn't cover glyphs that only appear in later stories (e.g.
// accidentals first appear in the Accidentals story). Rendering every story
// once here guarantees all glyph+size combinations are rasterized before any
// screenshot comparison runs.
beforeAll(async () => {
  await page.viewport(1280, 720);
  const allGlyphs = Object.values(SMUFL).join('');
  const warmup = document.createElement('div');
  warmup.style.cssText =
    'position:fixed;top:0;left:0;font-family:Bravura;font-size:40px;opacity:0;pointer-events:none;';
  warmup.textContent = allGlyphs;
  document.body.appendChild(warmup);
  for (const Story of Object.values(composed)) {
    const { unmount } = render(<Story />);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (cdp() as any).send('Runtime.evaluate', {
      expression:
        "document.fonts.load('1em Bravura').then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))",
      awaitPromise: true,
    });
    unmount();
  }
  document.body.removeChild(warmup);
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
