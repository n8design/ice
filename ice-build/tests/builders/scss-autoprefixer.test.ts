import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SCSSBuilder } from '../../src/builders/scss.js';
import { IceConfig } from '../../src/types.js';
import autoprefixer from 'autoprefixer';

// Mock modules BEFORE using any variables
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdtempSync: vi.fn().mockImplementation((prefix) => prefix + 'test-dir'),
  rmSync: vi.fn(),
  constants: { R_OK: 4 },
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('body { display: flex; }')
  }
}));

vi.mock('postcss', () => ({
  default: vi.fn().mockImplementation((plugins) => ({
    process: vi.fn().mockImplementation((css) => {
      if (plugins.some(plugin => plugin.postcssPlugin === 'autoprefixer')) {
        return Promise.resolve({
          css: 'body { display: -webkit-flex; display: -ms-flexbox; display: flex; }',
          map: { toString: () => '{}' }
        });
      }
      return Promise.resolve({ css, map: { toString: () => '{}' } });
    })
  }))
}));

vi.mock('autoprefixer', () => ({
  default: vi.fn().mockImplementation((options = {}) => ({
    postcssPlugin: 'autoprefixer',
    process: vi.fn(),
    options
  }))
}));

vi.mock('sass', () => ({
  compile: vi.fn().mockImplementation(() => ({
    css: 'body { display: flex; }',
    loadedUrls: [],
    sourceMap: { version: "3", sources: [], names: [], mappings: '' }
  }))
}));

describe('SCSSBuilder with Autoprefixer', () => {
  let tempDir;
  let mockConfig;
  let scssBuilder;
  
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ice-autoprefixer-test-'));
    
    const sourceDir = path.join(tempDir, 'source');
    const publicDir = path.join(tempDir, 'public');

    mockConfig = {
      input: {
        ts: [],
        scss: [sourceDir],
        html: []
      },
      output: { path: publicDir },
      watch: { paths: [sourceDir], ignored: ['node_modules'] },
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

    scssBuilder = new SCSSBuilder(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it('should use autoprefixer with standard configuration discovery', async () => {
    const scssFilePath = path.join(tempDir, 'source', 'style.scss');
    
    await scssBuilder.buildFile(scssFilePath);
    
    // Verify autoprefixer was called with empty options (standard discovery)
    expect(autoprefixer).toHaveBeenCalledTimes(1);
    expect(autoprefixer).toHaveBeenCalledWith({});
    
    // Verify the CSS was processed 
    const writeFileCalls = vi.mocked(fs.promises.writeFile).mock.calls;
    expect(writeFileCalls.length).toBeGreaterThan(0);
    
    const cssContent = writeFileCalls[0][1].toString();
    expect(cssContent).toContain('display: -webkit-flex;');
  });

  it('should accept custom browserslist configuration via environment variable', async () => {
    const scssFilePath = path.join(tempDir, 'source', 'style.scss');
    
    // Set browserslist environment variable
    process.env.BROWSERSLIST = 'last 1 chrome version';
    
    await scssBuilder.buildFile(scssFilePath);
    
    // Verify autoprefixer was called with empty options (still uses env variable)
    expect(autoprefixer).toHaveBeenCalledWith({});
    expect(vi.mocked(fs.promises.writeFile).mock.calls.length).toBeGreaterThan(0);
  });
});
