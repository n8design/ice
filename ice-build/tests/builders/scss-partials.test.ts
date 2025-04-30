import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SCSSBuilder } from '../../src/builders/scss.js';
import path from 'path';
import * as fsSync from 'fs';

// Mock dependencies
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined)
  }
}));

// Fix the fs module mock
vi.mock('fs', () => {
  return {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn()
  };
});

// Update sass mock to use modern API
vi.mock('sass', () => ({
  compile: vi.fn().mockReturnValue({
    css: 'body { color: blue; }',
    sourceMap: 'sourcemap-content'
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

// Fix the sass-graph mock to properly return the expected structure
vi.mock('sass-graph', () => {
  return {
    default: {
      parseDir: vi.fn().mockReturnValue({
        index: {
          '/source/_variables.scss': {
            imports: [],
            importedBy: ['/source/style.scss', '/source/_partial.scss']
          },
          '/source/_partial.scss': {
            imports: ['/source/_variables.scss'],
            importedBy: ['/source/style.scss']
          },
          '/source/style.scss': {
            imports: ['/source/_variables.scss', '/source/_partial.scss'],
            importedBy: []
          },
          // Add windows-style path for cross-platform test
          'C:/source/_variables.scss': {
            imports: [],
            importedBy: ['/source/style.scss']
          }
        },
        visitAncestors: function(file) {
          const normalizedFile = file.toLowerCase().replace(/\\/g, '/');
          
          const result = {};
          if (normalizedFile.includes('_variables')) {
            result['/source/style.scss'] = true;
          } else if (normalizedFile.includes('_partial')) {
            result['/source/style.scss'] = true;
          }
          return result;
        }
      })
    }
  };
});

vi.mock('../../src/utils/logger.js', () => ({
  Logger: class {
    info() {}
    warn() {}
    error() {}
    success() {}
    debug() {}
  }
}));

describe('SCSS Partials and Dependency Graph', () => {
  const mockConfig = {
    input: {
      scss: ['source/**/*.scss'],
      ts: ['source/**/*.ts'],
      html: ['source/**/*.html']
    },
    output: { path: 'public' },
    watch: { paths: ['source'], ignored: ['node_modules'] },
    sass: { style: 'expanded', sourceMap: true },
    postcss: { plugins: [] },
    hotreload: { port: 3001, debounceTime: 300 },
    esbuild: { bundle: true, minify: false, sourcemap: true, target: 'es2018' }
  };
  
  let scssBuilder;
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    scssBuilder = new SCSSBuilder(mockConfig, 'public');
    
    // Setup mock for readFileSync with correct mocking pattern
    const readFileSyncMock = vi.fn((file: any) => {
      const filePath = file.toString();
      
      if (filePath.includes('style.scss')) {
        return '@use "./variables" as *; @use "./partial" as *; body { color: $primary; }';
      }
      else if (filePath.includes('_partial.scss')) {
        return '@use "./variables" as *; .partial { background: $secondary; }';
      }
      else if (filePath.includes('_variables.scss')) {
        return '$primary: blue; $secondary: green;';
      }
      
      return '';
    });
    
    // Correct way to mock the fs module's readFileSync function
    vi.mocked(fsSync.readFileSync).mockImplementation(readFileSyncMock);
    
    // Important: Set up the dependency graph explicitly 
    // This is required because SCSSBuilder caches the graph
    scssBuilder['dependencyGraph'] = {
      index: {
        '/source/_variables.scss': {
          imports: [],
          importedBy: ['/source/style.scss', '/source/_partial.scss']
        },
        '/source/_partial.scss': {
          imports: ['/source/_variables.scss'],
          importedBy: ['/source/style.scss']
        },
        '/source/style.scss': {
          imports: ['/source/_variables.scss', '/source/_partial.scss'],
          importedBy: []
        },
        'C:/source/_variables.scss': {
          imports: [],
          importedBy: ['/source/style.scss']
        }
      },
      visitAncestors: function(file) {
        const normalizedFile = file.toLowerCase().replace(/\\/g, '/');
        
        const result = {};
        if (normalizedFile.includes('_variables')) {
          result['/source/style.scss'] = true;
        } else if (normalizedFile.includes('_partial')) {
          result['/source/style.scss'] = true;
        }
        return result;
      }
    };
    
    // Also directly mock the buildDependencyGraph method to avoid it being called
    vi.spyOn(scssBuilder, 'buildDependencyGraph' as any).mockImplementation(() => {
      // Do nothing - we already set the dependency graph above
    });
  });

  it('should correctly identify parent files of partials', async () => {
    // Test the getParentFiles method
    const parentFiles = await scssBuilder.getParentFiles('/source/_variables.scss');
    expect(parentFiles).toContain('/source/style.scss');
    // Partial files shouldn't be included in parent files
    expect(parentFiles).not.toContain('/source/_partial.scss');
  });

  it('should process partials and rebuild dependent files', async () => {
    // Mock processScssFile to track calls
    const processScssFileSpy = vi.spyOn(scssBuilder, 'processScssFile' as any)
      .mockImplementation((filePath) => Promise.resolve()); // Add implementation that accepts an argument
    
    // Process a partial file
    await scssBuilder.buildFile('/source/_variables.scss');
    
    // Should process the main file that depends on the partial
    expect(processScssFileSpy).toHaveBeenCalledWith('/source/style.scss');
    // Shouldn't process other partials
    expect(processScssFileSpy).not.toHaveBeenCalledWith('/source/_partial.scss');
  });
  
  it('should handle cross-platform path formats', async () => {
    // Test with Windows-style paths
    const windowsPath = 'C:\\source\\_variables.scss';
    const parentFiles = await scssBuilder.getParentFiles(windowsPath);
    
    expect(parentFiles.length).toBeGreaterThan(0);
    // Should still find the parent files despite different path format
    expect(parentFiles[0].replace(/\\/g, '/')).toContain('/source/style.scss');
  });

  it('should rebuild transitive dependencies', async () => {
    // Mock processScssFile to track calls
    const processScssFileSpy = vi.spyOn(scssBuilder, 'processScssFile' as any)
      .mockImplementation((filePath) => Promise.resolve()); // Add implementation that accepts an argument
    
    // Process a partial that's imported by another partial
    await scssBuilder.buildFile('/source/_variables.scss');
    
    // Should process the main file that depends on it (even through another partial)
    expect(processScssFileSpy).toHaveBeenCalledWith('/source/style.scss');
  });
});
