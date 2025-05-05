/**
 * Shared test utilities for ice-build
 */

import { vi } from 'vitest';
import { IceConfig } from '../../src/types.js'; // Fix: import from types.js instead of interfaces/config.js

/**
 * Create a mock IceConfig for testing
 * @returns Mock configuration
 */
export function createMockConfig(): IceConfig {
  return {
    input: {
      scss: ['src/**/*.scss'],
      ts: ['src/**/*.ts'],
      html: ['src/**/*.html']
    },
    output: { path: 'public' },
    watch: { paths: ['src'], ignored: ['node_modules'] },
    sass: { style: 'expanded', sourceMap: true },
    postcss: { plugins: [] },
    hotreload: {
      port: 3001,
      debounceTime: 300
    },
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      target: 'es2018'
    }
  };
}

/**
 * Create mock filesystem functions
 * @returns Object with mocked fs functions
 */
export function createMockFs() {
  return {
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
      access: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue('@use "./variables"; body { color: $primary; }')
    },
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('@use "./variables"; body { color: $primary; }'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn()
  };
}

/**
 * Create a mock logger
 * @returns Mock logger object
 */
export function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn()
  };
}

/**
 * Create mock sass compiler
 * @returns Mock sass compiler
 */
export function createMockSass() {
  return {
    compile: vi.fn().mockReturnValue({
      css: 'body { color: blue; }',
      sourceMap: 'sourcemap-content'
    })
  };
}

/**
 * Create mock postcss
 * @returns Mock postcss
 */
export function createMockPostcss() {
  return vi.fn().mockReturnValue({
    process: vi.fn().mockResolvedValue({
      css: 'body { color: blue; }',
      map: {
        toString: vi.fn().mockReturnValue('sourcemap-content')
      }
    })
  });
}

/**
 * Create a mock sass dependency graph
 * @returns Mock sass-graph module
 */
export function createMockSassGraph() {
  return {
    default: {
      parseDir: vi.fn().mockReturnValue({
        index: {
          'src/_variables.scss': {
            imports: [],
            importedBy: ['src/style.scss', 'src/theme.scss'] // Add multiple importers
          },
          'src/style.scss': {
            imports: ['src/_variables.scss'],
            importedBy: []
          },
          'src/theme.scss': { // Add another file that imports _variables.scss
            imports: ['src/_variables.scss'],
            importedBy: []
          },
          'src/components/_button.scss': { // Add a deeper nested partial
            imports: ['src/_variables.scss'],
            importedBy: ['src/style.scss']
          }
        },
        visitAncestors: vi.fn().mockImplementation((file) => {
          if (file.includes('_variables')) {
            return { 'src/style.scss': true, 'src/theme.scss': true }; // Return all dependent files
          }
          if (file.includes('_button')) {
            return { 'src/style.scss': true };
          }
          return {};
        })
      })
    }
  };
}
