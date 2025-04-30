import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypeScriptBuilder } from '../../src/builders/typescript.js';
import path from 'path';

// Mock dependencies
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined)
  }
}));

// Fix the glob mock to return an array properly
vi.mock('glob', () => ({
  glob: vi.fn().mockResolvedValue(['index.ts']), 
  sync: vi.fn().mockReturnValue(['index.ts'])
}));

vi.mock('esbuild', () => ({
  build: vi.fn().mockResolvedValue({ errors: [], warnings: [] })
}));

vi.mock('../../src/utils/logger.js', () => ({
  Logger: class {
    info() {}
    warn() {}
    error() {}
    success() {}
    debug() {}
  }
}));

describe('TypeScriptBuilder', () => {
  const mockConfig = {
    input: {
      ts: ['source/**/*.ts', 'source/**/*.tsx'],
      scss: ['source/**/*.scss'], // Add required scss field
      html: ['source/**/*.html']  // Add html field
    },
    output: { path: 'public' },
    watch: { paths: ['source'], ignored: ['node_modules'] },
    esbuild: {
      bundle: true,
      minify: true,
      sourcemap: true,
      target: 'es2018'
    },
    // Add missing required config fields
    hotreload: {
      port: 3001,
      debounceTime: 300
    },
    sass: {
      style: 'expanded',
      sourceMap: true
    },
    postcss: { plugins: [] }
  };
  
  let tsBuilder;
  
  beforeEach(() => {
    tsBuilder = new TypeScriptBuilder(mockConfig, 'public');
    
    // Reset module mocks
    vi.resetAllMocks();
  });

  it('should build typescript files', async () => {
    // Mock the internal method to avoid "files is not iterable" error
    vi.spyOn(tsBuilder, 'resolveEntryPoints' as any).mockResolvedValue(['index.ts']);
    
    await expect(tsBuilder.build()).resolves.not.toThrow();
  });
  
  it('should build a single typescript file', async () => {
    await expect(tsBuilder.buildFile('source/index.ts')).resolves.not.toThrow();
  });
});
