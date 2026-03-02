import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
import { setProjectAnnotations } from '@storybook/react-vite';
import * as projectAnnotations from './preview';

// This is an important step to apply the right configuration when testing your stories.
// More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);

// Vexflow uses a ResizeObserver to track its container width and calls
// setWindowWidth from within the observer callback — outside React's event
// loop. In a real browser this is correct behaviour, but React prints an
// "update not wrapped in act" warning during testing. Suppress it here since
// it is a known false positive for browser-based tests.
const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('not wrapped in act')
  ) {
    return;
  }
  originalError(...args);
};
