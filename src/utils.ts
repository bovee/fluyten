export function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): { call: (...args: T) => void; cancel: () => void } {
  let timer: number | null = null;
  return {
    call(...args: T) {
      if (timer !== null) clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
