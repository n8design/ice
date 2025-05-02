import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'; // Import Mock type
import * as path from 'path';
import { promises as fsPromises } from 'fs'; 
import * as os from 'os';
import autoprefixer from 'autoprefixer'; // Import autoprefixer
import { SCSSBuilder } from '../../src/builders/scss.js';
import { IceConfig } from '../../src/types.js';
import { EventEmitter } from 'events'; 
// Import the *mocked* logger and the exported instance
// @ts-ignore - mockLoggerInstance is added dynamically by vi.mock
import { Logger, mockLoggerInstance as importedMockLoggerInstance } from '../../src/utils/logger.js'; 

// Define the expected type for the mock instance
type MockLoggerInstanceType = {
    info: Mock;
    warn: Mock;
    error: Mock;
    debug: Mock;
    success: Mock;
};

// Cast the imported value to the defined type
const mockLoggerInstance = importedMockLoggerInstance as MockLoggerInstanceType;

// Mock the logger module, define the instance inside, and export it
vi.mock('../../src/utils/logger.js', async (importOriginal) => {
    const actual = await importOriginal() as any; // Import actual if needed, though not here
    // Define the instance *inside* the factory
    const instance = {
      info: vi.fn((...args) => console.log('🧊 [scss]', ...args)),
      warn: vi.fn((...args) => console.warn('⚠️ [scss]', ...args)),
      error: vi.fn((...args) => console.error('🔥 [scss]', ...args)),
      debug: vi.fn(),
      success: vi.fn((...args) => console.log('✅ [scss]', ...args)),
    };
    const MockLogger = vi.fn().mockImplementation(() => {
        // Return the instance created within this factory scope
        return instance;
    });
    return { 
        ...actual, // Spread actual exports if needed
        Logger: MockLogger, 
        mockLoggerInstance: instance // Export the instance
    };
});

// Helper function to wait for a specific build event
function waitForBuildEvent(builder: EventEmitter, expectedPath: string, timeout = 10000): Promise<void> { // Increased timeout
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            builder.off('css', listener); // Clean up listener
            reject(new Error(`Timeout waiting for build event for ${expectedPath}`));
        }, timeout);

        const listener = (event: { path: string }) => {
            if (path.normalize(event.path) === path.normalize(expectedPath)) {
                clearTimeout(timer);
                builder.off('css', listener); // Clean up listener
                resolve();
            }
        };

        builder.on('css', listener);
    });
}

describe('SCSS Dependency Graph Integration', () => {
  let tempDir: string;
  let builder: SCSSBuilder;
  let config: IceConfig;

  beforeEach(async () => {
    vi.clearAllMocks(); // Clear overall mock state first

    // Clear the specific mock instance's calls using the typed reference
    // Add type assertion for mockFn
    Object.values(mockLoggerInstance).forEach(mockFn => (mockFn as Mock).mockClear());

    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'ice-scss-test-'));
    const sourceDir = path.join(tempDir, 'src');
    const outputDir = path.join(tempDir, 'public');
    const variablesPath = path.join(sourceDir, '_variables.scss');
    const layoutPath = path.join(sourceDir, '_layout.scss');
    const stylePath = path.join(sourceDir, 'style.scss');
    const alternatePath = path.join(sourceDir, 'alternate.scss');
    await fsPromises.mkdir(sourceDir, { recursive: true });
    await fsPromises.mkdir(outputDir, { recursive: true }); 
    
    // --- Define File Contents ---
    const variablesContent = `$primary: blue; $secondary: green;`;
    const layoutContent = `@forward "./variables"; @use "./variables" as var; .container { color: var.$primary; user-select: none; }`; // Add user-select
    const styleContent = `@use "./layout" as layout; body { color: layout.$secondary; }`; 
    const alternateContent = `@use "./variables" as v; .alternate { color: v.$secondary; }`; 
    // --- End File Contents ---

    // Write files using the defined contents
    await fsPromises.writeFile(variablesPath, variablesContent);
    await fsPromises.writeFile(layoutPath, layoutContent); 
    await fsPromises.writeFile(stylePath, styleContent); 
    await fsPromises.writeFile(alternatePath, alternateContent); 

    config = {
      input: { 
        ts: [], // Add missing ts property
        scss: [sourceDir],
        html: [] // Add optional html property for completeness
      },
      output: { path: outputDir },
      watch: { 
        paths: [sourceDir],
        ignored: [] // Add missing ignored property
      }, 
      sass: { style: 'expanded', sourceMap: true }, // ENABLE source maps
      postcss: { plugins: [autoprefixer] }, // Add autoprefixer here
      hotreload: { port: 3001, debounceTime: 300 }, // Example default
      esbuild: { bundle: true, minify: true, sourcemap: true, target: 'es2018' } // Example default
    };

    // Instantiate the builder, which will now receive the mockLoggerInstance via the mock
    builder = new SCSSBuilder(config);
  });

  afterEach(async () => {
    if (tempDir) {
      try {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error(`Failed to remove temp dir ${tempDir}:`, e);
      }
    }
    vi.restoreAllMocks(); // Restore logger mock if kept
  });

  it('should compile all SCSS files and run PostCSS', async () => { // Updated test description slightly
    await builder.build();

    const styleOutputPath = path.join(config.output.path, 'style.css');
    const alternateOutputPath = path.join(config.output.path, 'alternate.css');

    await fsPromises.access(styleOutputPath);
    await fsPromises.access(alternateOutputPath);

    const styleContent = await fsPromises.readFile(styleOutputPath, 'utf-8');
    const alternateContent = await fsPromises.readFile(alternateOutputPath, 'utf-8');

    // Check for original SCSS content
    expect(styleContent).toContain('.container');
    expect(styleContent).toContain('color: blue;'); 
    expect(styleContent).toContain('body');
    expect(styleContent).toContain('color: green;'); 

    // Check for autoprefixer output (e.g., -webkit-user-select)
    expect(styleContent).toContain('-webkit-user-select: none;'); 
    expect(styleContent).toContain('user-select: none;'); 

    expect(alternateContent).toContain('.alternate');
    expect(alternateContent).toContain('color: green;'); 
    // Add check for source map reference (PostCSS should handle this)
    expect(styleContent).toContain('/*# sourceMappingURL=style.css.map */');
    expect(alternateContent).toContain('/*# sourceMappingURL=alternate.css.map */');

  }, 10000);

  it('should rebuild dependent files when a partial changes', async () => {
    await builder.build();

    const styleOutputPath = path.join(config.output.path, 'style.css');
    const alternateOutputPath = path.join(config.output.path, 'alternate.css');
    const variablesPath = path.join(config.input.scss[0], '_variables.scss');

    const newVariablesContent = '$primary: purple !important; $secondary: orange !important;';
    
    const styleRebuildPromise = waitForBuildEvent(builder, styleOutputPath);
    const alternateRebuildPromise = waitForBuildEvent(builder, alternateOutputPath);
    
    await fsPromises.writeFile(variablesPath, newVariablesContent);
    await builder.processChange(variablesPath);

    await Promise.all([styleRebuildPromise, alternateRebuildPromise]);

    const styleContent = await fsPromises.readFile(styleOutputPath, 'utf-8');
    const alternateContent = await fsPromises.readFile(alternateOutputPath, 'utf-8');

    expect(styleContent).toContain('color: purple !important;');
    expect(styleContent).toContain('color: orange !important;'); 
    expect(alternateContent).toContain('color: orange !important;');
  }, 15000);

  it('should handle nested partial dependencies', async () => {
    await builder.build();

    const styleOutputPath = path.join(config.output.path, 'style.css');
    const layoutPath = path.join(config.input.scss[0], '_layout.scss');

    const newLayoutContent = '@forward "./variables"; @use "./variables" as var; .container { max-width: 1400px !important; color: var.$primary; padding: 2rem !important; }';
    
    const styleRebuildPromise = waitForBuildEvent(builder, styleOutputPath);

    await fsPromises.writeFile(layoutPath, newLayoutContent);
    await builder.processChange(layoutPath);

    await styleRebuildPromise;

    const styleContent = await fsPromises.readFile(styleOutputPath, 'utf-8');

    expect(styleContent).toContain('max-width: 1400px !important;');
    expect(styleContent).toContain('padding: 2rem !important;');
    expect(styleContent).toContain('color: blue;'); 
    expect(styleContent).toContain('color: green;'); 
  }, 15000);

  it('should handle multi-level partial dependencies', async () => {
    // --- Setup for multi-level test ---
    const sourceDir = config.input.scss[0];
    const outputDir = config.output.path;

    // Define additional file contents
    const mixinsContent = `@use "./variables" as v; @mixin important-text { color: v.$secondary !important; font-weight: bold; }`;
    const newLayoutContent = `
      @forward "./variables"; 
      @use "./variables" as var; 
      @use "./mixins"; 
      .container { color: var.$primary; } 
      .important { @include mixins.important-text; }
    `;
    const widgetContent = `@use "./mixins"; .widget { @include mixins.important-text; }`;

    // Write additional/modified files
    const mixinsPath = path.join(sourceDir, '_mixins.scss');
    const layoutPath = path.join(sourceDir, '_layout.scss'); // Overwrite previous layout
    const widgetPath = path.join(sourceDir, 'widget.scss');
    await fsPromises.writeFile(mixinsPath, mixinsContent);
    await fsPromises.writeFile(layoutPath, newLayoutContent);
    await fsPromises.writeFile(widgetPath, widgetContent);

    // Re-run initial build to include new files and dependencies
    await builder.build(); 
    // --- End Setup ---

    // Paths for verification
    const styleOutputPath = path.join(outputDir, 'style.css');
    const widgetOutputPath = path.join(outputDir, 'widget.css');
    const variablesPath = path.join(sourceDir, '_variables.scss');

    // Verify initial state (optional but good practice)
    let initialStyleContent = await fsPromises.readFile(styleOutputPath, 'utf-8');
    let initialWidgetContent = await fsPromises.readFile(widgetOutputPath, 'utf-8');
    expect(initialStyleContent).toContain('color: green;'); // From layout -> style
    expect(initialWidgetContent).toContain('color: green !important;'); // From mixins -> widget

    // Change the base variable file
    const newVariablesContent = '$primary: magenta; $secondary: cyan;';
    
    // Setup promises to wait for rebuilds
    const styleRebuildPromise = waitForBuildEvent(builder, styleOutputPath);
    const widgetRebuildPromise = waitForBuildEvent(builder, widgetOutputPath);
    
    // Trigger the change
    await fsPromises.writeFile(variablesPath, newVariablesContent);
    await builder.processChange(variablesPath);

    // Wait for both files to be rebuilt
    await Promise.all([styleRebuildPromise, widgetRebuildPromise]);

    // Verify updated content
    const updatedStyleContent = await fsPromises.readFile(styleOutputPath, 'utf-8');
    const updatedWidgetContent = await fsPromises.readFile(widgetOutputPath, 'utf-8');

    expect(updatedStyleContent).toContain('color: cyan;'); // Updated via layout -> style
    expect(updatedWidgetContent).toContain('color: cyan !important;'); // Updated via mixins -> widget
  }, 15000); // Increased timeout for potentially more complex build

  it('should generate source maps when enabled', async () => {
    await builder.build();

    const styleOutputPath = path.join(config.output.path, 'style.css');
    const styleMapPath = path.join(config.output.path, 'style.css.map');
    const alternateOutputPath = path.join(config.output.path, 'alternate.css');
    const alternateMapPath = path.join(config.output.path, 'alternate.css.map');

    // Check if map files exist
    await expect(fsPromises.access(styleMapPath)).resolves.toBeUndefined();
    await expect(fsPromises.access(alternateMapPath)).resolves.toBeUndefined();

    // Check content of map files (basic check for source file references)
    const styleMapContent = await fsPromises.readFile(styleMapPath, 'utf-8');
    const alternateMapContent = await fsPromises.readFile(alternateMapPath, 'utf-8');
    const styleMapData = JSON.parse(styleMapContent);
    const alternateMapData = JSON.parse(alternateMapContent);

    // Verify that the source map includes references to the original SCSS files
    // Note: With @use/@forward, Dart Sass often only lists the entry point file and possibly
    // files directly used/forwarded by it in the top-level 'sources' array.
    // The detailed mappings within the map still point to the correct original files.
    expect(styleMapData.sources.some((s: string) => s.includes('style.scss'))).toBe(true);
    expect(styleMapData.sources.some((s: string) => s.includes('_layout.scss'))).toBe(true);

    // Check that the entry point for the alternate file is listed.
    expect(alternateMapData.sources.some((s: string) => s.includes('alternate.scss'))).toBe(true);

    // Check if the CSS file references the map file
    const styleContent = await fsPromises.readFile(styleOutputPath, 'utf-8');
    expect(styleContent).toContain('/*# sourceMappingURL=style.css.map */');
    const alternateContent = await fsPromises.readFile(alternateOutputPath, 'utf-8');
    expect(alternateContent).toContain('/*# sourceMappingURL=alternate.css.map */');

  }, 10000);

  it('should report Sass compilation errors', async () => {
    const sourceDir = config.input.scss[0];
    const errorFilePath = path.join(sourceDir, 'error.scss');
    const errorFileContent = `body { color: $undefined-variable; }`; // Invalid SCSS

    await fsPromises.writeFile(errorFilePath, errorFileContent);

    // Expect the build process to throw an error or reject
    // We need to catch the rejection as the builder itself might not throw synchronously
    try {
      await builder.build();
      // If build() doesn't reject, fail the test
      expect.fail('Builder build() should have rejected due to Sass error.');
    } catch (error) {
       // Error is expected, proceed to check logger
    }

    // Check if the logger's error method was called (using the imported reference)
    expect(mockLoggerInstance.error).toHaveBeenCalled();

    // Check if the error message contains relevant info (using the imported reference)
    const errorCallArgs = mockLoggerInstance.error.mock.calls[0];
    const errorMessage = errorCallArgs.join(' '); // Combine args into a single string
    expect(errorMessage).toContain('Sass compilation error for'); // Updated assertion
    expect(errorMessage).toContain('error.scss');
    expect(errorMessage).toContain('Undefined variable'); // Specific Sass error
  }, 10000);

});
