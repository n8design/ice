import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SCSSBuilder } from '../../src/builders/scss.js';
import path from 'path';
import fs from 'fs';

// Mock dependencies
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('@import "./variables"; body { color: $primary; }')
  }
}));

vi.mock('glob', () => ({
  glob: vi.fn().mockResolvedValue(['style.scss']),
  sync: vi.fn().mockReturnValue(['style.scss'])
}));

vi.mock('sass', () => ({
  compile: vi.fn().mockReturnValue({
    css: 'body { color: blue; }'
  })
}));

vi.mock('postcss', () => ({
  default: vi.fn().mockReturnValue({
    process: vi.fn().mockResolvedValue({
      css: 'body { color: blue; }',
      map: {
        toString: vi.fn().mockReturnValue('sourcemap-content')
      }
    })
  })
}));

vi.mock('autoprefixer', () => ({
  default: vi.fn().mockReturnValue({})
}));

vi.mock('sass-graph', () => ({
  default: {
    parseDir: vi.fn().mockReturnValue({
      index: {
        'source/_variables.scss': {
          imports: [],
          importedBy: ['source/style.scss']
        },
        'source/style.scss': {
          imports: ['source/_variables.scss'],
          importedBy: []
        }
      },
      visitAncestors: vi.fn().mockImplementation((file) => {
        if (file.includes('_variables')) {
          return { 'source/style.scss': true };
        }
        return {};
      })
    })
  }
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

describe('SCSSBuilder', () => {
  // Fixed mockConfig to include all required properties
  const mockConfig = {
    input: {
      scss: ['source/**/*.scss'],
      ts: ['source/**/*.ts', 'source/**/*.tsx'], // Added required ts property
      html: ['source/**/*.html']  // Added optional html property
    },
    output: { path: 'public' },
    watch: { paths: ['source'], ignored: ['node_modules'] },
    sass: { style: 'expanded', sourceMap: true },
    postcss: { plugins: [] },
    // Add other required config properties
    hotreload: {
      port: 3001,
      debounceTime: 300
    },
    esbuild: {
      bundle: true,
      minify: true,
      sourcemap: true,
      target: 'es2018'
    }
  };
  
  let scssBuilder;
  
  beforeEach(() => {
    scssBuilder = new SCSSBuilder(mockConfig, 'public');
  });

  it('should build scss files', async () => {
    await expect(scssBuilder.build()).resolves.not.toThrow();
  });
  
  it('should process partials and find dependencies', async () => {
    const partialPath = 'source/_variables.scss';
    await expect(scssBuilder.buildFile(partialPath)).resolves.not.toThrow();
    // Would check for specific behavior like rebuilding dependent files
  });
});
