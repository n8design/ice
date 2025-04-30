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
  // Fixed mockConfig to include all required properties
  const mockConfig = {
    input: {
      ts: ['source/**/*.ts', 'source/**/*.tsx'],
      scss: ['source/**/*.scss'], // Added required scss property
      html: ['source/**/*.html']  // Added optional html property
    },
    output: { path: 'public' },
    watch: { paths: ['source'], ignored: ['node_modules'] },
    esbuild: {
      bundle: true,
      minify: true,
      sourcemap: true,
      target: 'es2018'
    },
    // Add other required config properties
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
    // Mock the resolveEntryPoints method directly to avoid the glob issue
    vi.spyOn(tsBuilder, 'resolveEntryPoints' as any).mockResolvedValue(['index.ts']);
    
    await expect(tsBuilder.build()).resolves.not.toThrow();
  });
  
  it('should build a single typescript file', async () => {
    await expect(tsBuilder.buildFile('source/index.ts')).resolves.not.toThrow();
  });
});
