#!/usr/bin/env node

import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { rmSync } from 'fs';

// Helper to run shell commands and log them
function runCommand(command: string, options: Record<string, any> = {}): Buffer {
  console.log(`Running: ${command}`);
  return execSync(command, { stdio: 'inherit', ...options });
}

// Create a test project in a temp directory
function createTestProject(): string {
  try {
    // Create temp directory with platform-independent function
    const testDir = mkdtempSync(join(tmpdir(), 'ice-build-test-'));
    console.log(`Created temporary test directory: ${testDir}`);

    // Create the project structure
    const sourcePath = join(testDir, 'source');
    runCommand(`${process.platform === 'win32' ? 'mkdir' : 'mkdir -p'} "${sourcePath}"`);

    // Create sample TypeScript file
    writeFileSync(
      join(sourcePath, 'index.ts'),
      `import './styles.scss';\nconsole.log('Hello from TypeScript');`
    );

    // Create sample SCSS file
    writeFileSync(
      join(sourcePath, 'styles.scss'),
      `body {\n  background-color: #f0f0f0;\n  h1 {\n    color: blue;\n  }\n}`
    );

    // Create a cross-platform compatible ice.config.js
    writeFileSync(
      join(testDir, 'ice.config.js'),
      `// ice-build configuration
export default {
  input: {
    ts: ['source/**/*.ts', 'source/**/*.tsx'],
    scss: ['source/**/*.scss'],
    html: ['source/**/*.html']
  },
  output: {
    path: 'public'
  },
  // Use platform-independent path syntax
  watch: {
    paths: ['source'],
    ignored: ['node_modules', '.git', 'public']
  },
  hotreload: {
    port: 3001,
    debounceTime: 300
  },
  esbuild: {
    bundle: true,
    minify: false,
    sourcemap: true
  },
  sass: {
    style: 'expanded',
    sourceMap: true
  }
};`
    );

    // Update package.json to explicitly pass all needed arguments
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'ice-build-test',
        type: 'module',
        version: '1.0.0',
        scripts: {
          // Add explicit --clean flag to ensure non-interactive mode
          build: "ice-build --clean",
          "test:integration": "npx ts-node tests/integration/run.ts"
        }
      }, null, 2)
    );

    return testDir;
  } catch (error) {
    console.error('Failed to create test project:', error);
    process.exit(1);
  }
}

// Main integration test function
async function runIntegrationTest(): Promise<void> {
  let testDir: string | null = null;

  try {
    // Create the test project
    testDir = createTestProject();
    
    // Get the absolute path to the project root
    const projectRoot = resolve(process.cwd());
    
    // Navigate to the test directory
    process.chdir(testDir);
    console.log(`Changed to test directory: ${testDir}`);

    // Link the local package
    runCommand(`npm link "${projectRoot}"`);
    console.log('Linked ice-build package');

    // Run the build with platform-aware debugging
    console.log('Running ice-build command...');
    try {
      // Add special handling for Windows
      if (process.platform === 'win32') {
        console.log('Running on Windows platform, using appropriate configuration');
      }
      
      // Capture and log stdout to see what's happening
      const output = execSync('npm run build -- --verbose', { 
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8'
      });
      console.log('Build command output:', output);
    } catch (buildError) {
      console.error('Build command failed with output:', buildError.stdout?.toString());
      console.error('Build command error:', buildError.stderr?.toString());
      throw buildError;
    }
    console.log('Build completed');

    // List directory contents to verify what was created
    try {
      const publicDir = join(testDir, 'public');
      console.log(`Contents of public directory (${publicDir}):`);
      if (existsSync(publicDir)) {
        const files = execSync(`ls -la "${publicDir}"`, { encoding: 'utf-8' });
        console.log(files);
      } else {
        console.log('Public directory does not exist');
      }
    } catch (e) {
      console.log('Could not list directory contents:', e);
    }

    // Verify output files exist - FIX: Updated path from 'dist' to 'public'
    const outputJsPath = join(testDir, 'public', 'index.js');
    const outputCssPath = join(testDir, 'public', 'styles.css');

    // Add more verbose output
    console.log(`Checking for output files in directory: ${join(testDir, 'public')}`);
    
    if (!existsSync(outputJsPath)) {
      throw new Error(`Output JS file not found: ${outputJsPath}`);
    } else {
      console.log(`✅ JS output file exists at: ${outputJsPath}`);
    }

    if (!existsSync(outputCssPath)) {
      throw new Error(`Output CSS file not found: ${outputCssPath}`);
    } else {
      console.log(`✅ CSS output file exists at: ${outputCssPath}`);
    }

    console.log('✅ Integration test passed!');
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  } finally {
    // Clean up - remove the test directory
    if (testDir) {
      // Go back to the original directory before removing
      process.chdir(process.cwd());
      try {
        rmSync(testDir, { recursive: true, force: true });
        console.log(`Cleaned up test directory: ${testDir}`);
      } catch (error) {
        console.warn(`Warning: Could not clean up test directory: ${error.message}`);
      }
    }
  }
}

// Run the test
runIntegrationTest();