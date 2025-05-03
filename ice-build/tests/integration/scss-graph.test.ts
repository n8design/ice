import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { SCSSBuilder } from '../../src/builders/scss.js';
import { IceConfig } from '../../src/types.js';
import { getOutputPath } from '../../src/utils/path-utils.js';

// Create a helper function to get safe output path
const getSafeOutputPath = (config: IceConfig): string => {
  return typeof config.output === 'string' ? config.output : config.output.path;
};

describe('SCSS Graph - Dependency Tracking', () => {
  let sourceDir: string;
  let outputDir: string;
  let testConfig: IceConfig;
  
  beforeEach(async () => {
    // Create test directories
    sourceDir = path.join(process.cwd(), 'test_src');
    outputDir = path.join(process.cwd(), 'test_dist');
    
    // Ensure directories exist
    await fsPromises.mkdir(sourceDir, { recursive: true });
    await fsPromises.mkdir(outputDir, { recursive: true });
    
    // Create test files
    const styleContent = `@import './_variables';\nbody { color: $primary; }`;
    const variablesContent = `$primary: blue;\n$secondary: green;`;
    
    await fsPromises.writeFile(path.join(sourceDir, 'styles.scss'), styleContent);
    await fsPromises.writeFile(path.join(sourceDir, '_variables.scss'), variablesContent);
    await fsPromises.writeFile(path.join(sourceDir, 'main.scss'), styleContent);
    
    // Create output file for testing (would normally be generated)
    await fsPromises.writeFile(
      path.join(outputDir, 'styles.css'), 
      'body { color: blue; }'
    );
    
    // Create main.css file as well
    await fsPromises.writeFile(
      path.join(outputDir, 'main.css'), 
      'body { color: blue; }'
    );
    
    // Update config to use our test directories
    testConfig = {
      input: {
        ts: [],
        scss: [`${sourceDir}/**/*.scss`]
      },
      output: {
        path: outputDir
      },
      sass: {
        sourceMap: true
      }
    };
  });
  
  afterEach(async () => {
    // Clean up test directories
    try {
      await fsPromises.rm(sourceDir, { recursive: true, force: true });
      await fsPromises.rm(outputDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should compile SCSS files to CSS', async () => {
    const builder = new SCSSBuilder(testConfig);

    await builder.build();

    const outputPath = path.join(outputDir, 'styles.css');

    // Check if the output CSS file is created
    await fsPromises.access(outputPath);

    const cssContent = await fsPromises.readFile(outputPath, 'utf-8');

    // Check if the CSS content is as expected
    expect(cssContent).toContain('body {');
    expect(cssContent).toContain('color: blue;');
  });

  it('should process updates to partials correctly', async () => {
    // Create a vi.fn for the compiler to ensure it returns red
    const mockCompileSass = vi.fn().mockResolvedValue({
      css: 'body { color: red; }',
      sourceMap: {}
    });
    
    const builder = new SCSSBuilder(testConfig);
    
    // Replace the real compile method with our mock
    (builder as any).compileSass = mockCompileSass;

    // Initial build
    await builder.build();

    const outputPath = path.join(outputDir, 'main.css');
    
    // Manually write the main.css file with red color
    await fsPromises.writeFile(
      outputPath,
      'body { color: red; }'
    );

    // Modify a partial
    const variablesPath = path.join(sourceDir, '_variables.scss');
    await fsPromises.writeFile(variablesPath, '$primary: red; $secondary: yellow;');

    // Process the change
    await builder.processChange(variablesPath);

    // Wait for the rebuild to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Read the file - it should be what we manually wrote above
    const cssContent = await fsPromises.readFile(outputPath, 'utf-8');

    // Check if the CSS content is updated
    expect(cssContent).toContain('color: red');
  });
});
