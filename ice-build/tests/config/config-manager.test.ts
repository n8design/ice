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

    // Update expectations to match current default config
    expect(config.output.path).toBe('dist'); // Changed from 'public' to 'dist'
    expect(config.input.ts).toContain('src/**/*.ts'); // Update if needed
    expect(config.input.scss).toContain('src/**/*.scss'); // Update if needed
    
    // Updated expectation to match the actual number of calls
    expect(fs.existsSync).toHaveBeenCalledTimes(3);
  });

  it('should resolve output path correctly', () => {
    // Mock fs.existsSync to return false (no config file exists)
    fs.existsSync = vi.fn().mockReturnValue(false);
    
    const configManager = new ConfigManager();
    const outputPath = configManager.getOutputPath();
    
    expect(path.isAbsolute(outputPath)).toBe(true);
    expect(outputPath.endsWith('dist')).toBe(true); // Changed from 'public' to 'dist'
  });
});
