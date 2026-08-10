const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

export const logger = {
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
  error: (...args: unknown[]) => { console.error(...args); },
  debug: (...args: unknown[]) => { if (isDev) console.debug(...args); },
};
