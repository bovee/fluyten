export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
  maxWait?: number
): { call: (...args: T) => void; cancel: () => void } {
  let timer: number | null = null;
  let maxTimer: number | null = null;
  let lastArgs: T | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (maxTimer !== null) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
    if (lastArgs !== null) {
      const args = lastArgs;
      lastArgs = null;
      fn(...args);
    }
  };

  return {
    call(...args: T) {
      lastArgs = args;
      if (timer !== null) clearTimeout(timer);
      timer = window.setTimeout(flush, delay);
      if (maxWait !== undefined && maxTimer === null) {
        maxTimer = window.setTimeout(flush, maxWait);
      }
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (maxTimer !== null) {
        clearTimeout(maxTimer);
        maxTimer = null;
      }
      lastArgs = null;
    },
  };
}
