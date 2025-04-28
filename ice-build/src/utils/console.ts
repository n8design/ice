// Console output utilities for ice-build

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    crimson: "\x1b[38m",
  },
  
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    crimson: "\x1b[48m",
  }
};

// Get current time formatted as HH:MM:SS
export function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString();
}

// Format milliseconds into a readable duration
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
}

// Simple phrases for console output
const buildPhrases = [
  "Processing",
  "Building",
  "Compiling"
];

// Get a random phrase
export function getRandomPhrase(): string {
  return buildPhrases[Math.floor(Math.random() * buildPhrases.length)];
}

// Log a file being compiled
export function logFileCompilation(fileType: string, filePath: string): void {
  console.log(`🧊 [${getCurrentTime()}] ${fileType}: ${filePath}`);
}

// Log a success message
export function logSuccess(message: string): void {
  console.log(`🧊 [${getCurrentTime()}] ✓ ${message}`);
}

// Log an error message
export function logError(message: string, error?: Error): void {
  console.error(`🧊 [${getCurrentTime()}] ✗ ${message}`);
  if (error && error.stack) {
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
  }
}

// Log a warning message
export function logWarning(message: string): void {
  console.warn(`🧊 [${getCurrentTime()}] ⚠ ${message}`);
}

// Log an info message
export function logInfo(message: string): void {
  console.info(`🧊 [${getCurrentTime()}] ${message}`);
}

// Hot reloader specific logging functions
export function logHotReload(message: string, verbose: boolean = false): void {
  console.log(`🔥 [${getCurrentTime()}] ${message}`);
}

export function logHotReloadDetail(message: string, verbose: boolean = false): void {
  if (verbose) {
    console.log(`🔥 [${getCurrentTime()}] ${message}`);
  }
}

export function logHotReloadSuccess(message: string): void {
  console.log(`🔥 [${getCurrentTime()}] ✓ ${message}`);
}

export function logHotReloadError(message: string, error?: Error, verbose: boolean = false): void {
  console.error(`🔥 [${getCurrentTime()}] ✗ ${message}`);
  if (verbose && error && error.stack) {
    console.error(`${colors.dim}${error.stack}${colors.reset}`);
  }
}

// Format build success message
export function formatSuccess(message: string): string {
  return `\n${colors.bg.yellow}${colors.fg.black} SUCCESS ${colors.reset} ${colors.bright}${colors.fg.white}${message}${colors.reset}\n`;
}

// Export everything
export {
  colors
};

// Also export as default for legacy compatibility
export default {
  getRandomPhrase,
  logFileCompilation,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  logHotReload,
  logHotReloadDetail,
  logHotReloadSuccess,
  logHotReloadError,
  getCurrentTime,
  formatDuration,
  formatSuccess,
  colors
};
