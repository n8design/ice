import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SCSSBuilder } from '../../src/builders/scss.js';
import { IceConfig } from '../../src/types.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock modules at the top level to avoid conflicts
vi.mock('glob', () => ({
  glob: vi.fn().mockRejectedValue(new Error('Glob failed'))
}));

vi.mock('postcss', () => {
  return {
    default: vi.fn(() => ({
      process: vi.fn().mockResolvedValue({
        css: '/* Processed CSS */',
        map: { toString: () => '{}' }
      })
    }))
  };
});

vi.mock('sass', () => ({
  compile: vi.fn().mockReturnValue({
    css: '/* Compiled CSS */',
    sourceMap: JSON.stringify({})
  })
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  promises: {
    readdir: vi.fn().mockResolvedValue([]),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('/* SCSS content */'),
    access: vi.fn().mockResolvedValue(undefined)
  },
  readdirSync: vi.fn().mockReturnValue([])
}));

/**
 * Test Windows-specific path resolution issues that were reported.
 * These tests verify that SCSS files are found correctly on Windows.
 */
describe('Windows SCSS File Discovery', () => {
  let mockConfig: IceConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    mockConfig = {
      input: {
        ts: [],
        scss: ['source/**/*.scss'],
        html: []
      },
      output: { path: 'public' },
      watch: { paths: ['source'], ignored: [] },
      sass: { style: 'expanded', sourceMap: true },
      postcss: { plugins: [] }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Path Normalization', () => {
    it('should normalize Windows paths correctly', () => {
      const scssBuilder = new SCSSBuilder(mockConfig);
      const builderAny = scssBuilder as any;
      
      const windowsPaths = [
        'C:\\Users\\Project\\source\\styles\\main.scss',
        'source\\styles\\components\\_button.scss',
        'source/styles/components/_button.scss',
        'source\\styles\\..\\components\\_button.scss'
      ];

      const expectedPaths = [
        'C:/Users/Project/source/styles/main.scss',
        'source/styles/components/_button.scss',
        'source/styles/components/_button.scss',
        'source/components/_button.scss'
      ];

      windowsPaths.forEach((windowsPath, index) => {
        const normalized = builderAny.normalizePath(windowsPath);
        expect(normalized).toBe(expectedPaths[index]);
      });
    });

    it('should clean up consecutive slashes', () => {
      const scssBuilder = new SCSSBuilder(mockConfig);
      const builderAny = scssBuilder as any;
      
      const messyPath = 'source///styles//components//_button.scss';
      const expected = 'source/styles/components/_button.scss';
      
      const normalized = builderAny.normalizePath(messyPath);
      expect(normalized).toBe(expected);
    });
  });

  describe('Manual File Discovery', () => {
    it('should find SCSS files manually when glob fails', async () => {
      const scssBuilder = new SCSSBuilder(mockConfig);
      const builderAny = scssBuilder as any;
      
      // Mock fs.promises.readdir to return mock file entries
      const mockFs = fs as any;
      mockFs.promises.readdir.mockResolvedValue([
        {
          name: 'main.scss',
          parentPath: '',
          path: '',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false
        },
        {
          name: '_variables.scss',
          parentPath: '',
          path: '',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false
        }
      ]);

      const files = await builderAny.findScssFilesManually('/test/path');
      expect(files).toHaveLength(2);
      expect(files[0]).toContain('main.scss');
      expect(files[1]).toContain('_variables.scss');
    });

    it('should handle directory scanning errors gracefully', async () => {
      const scssBuilder = new SCSSBuilder(mockConfig);
      const builderAny = scssBuilder as any;
      
      // Mock fs.promises.readdir to throw an error
      const mockFs = fs as any;
      mockFs.promises.readdir.mockRejectedValue(new Error('Permission denied'));

      const files = await builderAny.findScssFilesManually('/test/path');
      expect(files).toHaveLength(0);
    });
  });
});
