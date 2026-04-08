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
