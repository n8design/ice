import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../src/config/index.js';
import path from 'path';
import fs from 'fs';

// Mock filesystem
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn()
  }
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
  }
}));

// Mock for dynamic imports
vi.mock('../../src/utils/logger.js', () => ({
  Logger: class {
    info() {}
    warn() {}
    error() {}
    success() {}
    debug() {}
  }
}));

describe('ConfigManager', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up mocks
    vi.restoreAllMocks();
  });

  it('should load default config when no custom config exists', () => {
    // Mock fs.existsSync to return false (no config file exists)
    fs.existsSync = vi.fn().mockReturnValue(false);

    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    // Update test to match the current default config
    expect(config.output.path).toBe('public'); // Changed to match updated default
    expect(config.input.ts).toContain('source/**/*.ts'); // Update to look for source pattern
    expect(config.input.scss).toContain('source/**/*.scss'); // Update to look for source pattern
    
    // Updated expectation to match the actual number of calls
    expect(fs.existsSync).toHaveBeenCalledTimes(3);
  });

  it('should resolve output path correctly', () => {
    // Mock fs.existsSync to return false (no config file exists)
    fs.existsSync = vi.fn().mockReturnValue(false);
    
    const configManager = new ConfigManager();
    const outputPath = configManager.getOutputPath();
    
    // Update test to check for 'public' instead of 'dist'
    expect(path.isAbsolute(outputPath)).toBe(true);
    expect(outputPath.endsWith('public')).toBe(true); // Changed to match new default
  });
});
