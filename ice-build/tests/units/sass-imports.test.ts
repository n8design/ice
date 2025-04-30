import { describe, it, expect, vi, beforeEach } from 'vitest'; // Added beforeEach import
import path from 'path';
import { SCSSBuilder } from '../../src/builders/scss.js';

// Mock necessary dependencies
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn()
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

const mockConfig = {
  input: {
    scss: ['src/**/*.scss'],
    ts: ['src/**/*.ts'],
    html: ['src/**/*.html']
  },
  output: { path: 'public' },
  watch: { paths: ['src'] },
  sass: { style: 'expanded', sourceMap: true },
  postcss: { plugins: [] },
  hotreload: { port: 3001 },
  esbuild: { bundle: true, sourcemap: true }
};

describe('SCSS Import Detection', () => {
  let scssBuilder;
  
  beforeEach(() => {
    scssBuilder = new SCSSBuilder(mockConfig);
  });
  
  it('should extract @import statements', () => {
    const content = `
      // Regular import
      @import 'variables';
      @import "mixins";
      
      // Multiple imports on one line
      @import 'reset', 'typography';
      
      // Import with relative path
      @import '../shared/colors';
      
      // Import with extension
      @import 'components/button.scss';
    `;
    
    const imports = scssBuilder['extractImports'](content);
    
    expect(imports).toContain('variables');
    expect(imports).toContain('mixins');
    expect(imports).toContain('reset');
    expect(imports).toContain('typography');
    expect(imports).toContain('../shared/colors');
    expect(imports).toContain('components/button.scss');
  });
  
  it('should extract @use statements', () => {
    const content = `
      // Basic use
      @use 'variables';
      
      // With namespace
      @use 'mixins' as m;
      
      // With * namespace
      @use 'colors' as *;
      
      // With relative path
      @use '../shared/typography';
      
      // With extension
      @use 'components/button.scss';
    `;
    
    const imports = scssBuilder['extractImports'](content);
    
    expect(imports).toContain('variables');
    expect(imports).toContain('mixins');
    expect(imports).toContain('colors');
    expect(imports).toContain('../shared/typography');
    expect(imports).toContain('components/button.scss');
  });
  
  it('should extract @forward statements', () => {
    const content = `
      // Basic forward
      @forward 'variables';
      
      // Forward with path
      @forward '../shared/mixins';
      
      // Forward with extension
      @forward 'components/index.scss';
      
      // Forward with show/hide
      @forward 'theme' show $primary, $secondary;
      @forward 'layout' hide $gutter;
      
      // Forward with prefix
      @forward 'breakpoints' as bp-*;
    `;
    
    const imports = scssBuilder['extractImports'](content);
    
    expect(imports).toContain('variables');
    expect(imports).toContain('../shared/mixins');
    expect(imports).toContain('components/index.scss');
    expect(imports).toContain('theme');
    expect(imports).toContain('layout');
    expect(imports).toContain('breakpoints');
  });
  
  it('should handle complex mixed imports', () => {
    const content = `
      // Mix of all import styles
      @import 'legacy/reset';
      @use 'modern/colors' as colors;
      @forward 'modern/typography';
      
      // Comments and nested imports
      /*
        @import 'should-not-match';
      */
      
      .nested {
        /* @use 'also-should-not-match'; */
        color: red;
      }
      
      // URL imports should not be matched
      .background {
        background: url('@image/not-an-import.jpg');
      }
    `;
    
    const imports = scssBuilder['extractImports'](content);
    
    expect(imports).toContain('legacy/reset');
    expect(imports).toContain('modern/colors');
    expect(imports).toContain('modern/typography');
    
    // These should not be matched
    expect(imports).not.toContain('should-not-match');
    expect(imports).not.toContain('also-should-not-match');
    expect(imports).not.toContain('@image/not-an-import.jpg');
  });
});
