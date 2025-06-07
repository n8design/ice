/**
 * Test script to verify source map exclusion in OutputWatcher
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import the built JavaScript files
const { OutputWatcher } = require('./dist/watcher/output-watcher.js');
const { mkdir } = require('fs/promises');
const { writeFileSync, existsSync } = require('fs');
const path = require('path');

// Create a test directory and files
const testDir = './test-output-sourcemap';
const outputDir = path.join(testDir, 'public');

// Clean up and setup test directory
if (existsSync(testDir)) {
  await import('fs/promises').then(fs => fs.rm(testDir, { recursive: true, force: true }));
}

await mkdir(outputDir, { recursive: true });

// Create test files
writeFileSync(path.join(outputDir, 'styles.css'), '/* test css */');
writeFileSync(path.join(outputDir, 'styles.css.map'), '{"version":3,"sources":["../source/styles.scss"],"names":[],"mappings":""}');
writeFileSync(path.join(outputDir, 'app.js'), 'console.log("test");');
writeFileSync(path.join(outputDir, 'app.js.map'), '{"version":3,"sources":["../source/app.ts"],"names":[],"mappings":""}');

console.log('✅ Created test files');

// Mock hot reload server with tracking
const mockNotifications = [];
const mockHotReloadServer = {
  notifyClients: (type, filePath) => {
    mockNotifications.push({ type, filePath });
    console.log(`🔥 HotReload notification: ${type} - ${filePath}`);
  }
};

// Test config
const testConfig = {
  hotreload: {
    enabled: true,
    port: 3001
  }
};

// Create OutputWatcher
console.log('🚀 Starting OutputWatcher test...');
const outputWatcher = new OutputWatcher(outputDir, mockHotReloadServer, testConfig);

// Start the watcher
outputWatcher.start();

// Give it a moment to initialize
await new Promise(resolve => setTimeout(resolve, 100));

console.log('\n📝 Testing file changes...');

// Simulate file changes by manually calling the handleFileChange method
// We need to access the private method for testing
const triggerChange = (filePath) => {
  console.log(`\n🔄 Triggering change for: ${path.basename(filePath)}`);
  // Access the private method through the instance
  outputWatcher['handleFileChange'](filePath);
};

// Test 1: CSS file should trigger notification
console.log('\n=== Test 1: CSS file ===');
triggerChange(path.join(outputDir, 'styles.css'));

// Test 2: CSS.MAP file should NOT trigger notification  
console.log('\n=== Test 2: CSS.MAP file ===');
triggerChange(path.join(outputDir, 'styles.css.map'));

// Test 3: JS file should trigger notification
console.log('\n=== Test 3: JS file ===');
triggerChange(path.join(outputDir, 'app.js'));

// Test 4: JS.MAP file should NOT trigger notification
console.log('\n=== Test 4: JS.MAP file ===');
triggerChange(path.join(outputDir, 'app.js.map'));

// Wait a moment for processing
await new Promise(resolve => setTimeout(resolve, 200));

// Stop the watcher
outputWatcher.stop();

// Report results
console.log('\n📊 Test Results:');
console.log(`Total notifications: ${mockNotifications.length}`);
mockNotifications.forEach((notif, i) => {
  console.log(`  ${i + 1}. ${notif.type} - ${path.basename(notif.filePath)}`);
});

// Verify expectations
const cssNotifications = mockNotifications.filter(n => path.basename(n.filePath) === 'styles.css');
const cssMapNotifications = mockNotifications.filter(n => path.basename(n.filePath) === 'styles.css.map');
const jsNotifications = mockNotifications.filter(n => path.basename(n.filePath) === 'app.js');
const jsMapNotifications = mockNotifications.filter(n => path.basename(n.filePath) === 'app.js.map');

console.log('\n✅ Expected Results:');
console.log(`CSS file notifications: ${cssNotifications.length} (should be 1)`);
console.log(`CSS.MAP file notifications: ${cssMapNotifications.length} (should be 0)`);
console.log(`JS file notifications: ${jsNotifications.length} (should be 1)`);
console.log(`JS.MAP file notifications: ${jsMapNotifications.length} (should be 0)`);

// Determine if test passed
const testPassed = 
  cssNotifications.length === 1 &&
  cssMapNotifications.length === 0 &&
  jsNotifications.length === 1 &&
  jsMapNotifications.length === 0;

console.log(`\n${testPassed ? '🎉 TEST PASSED' : '❌ TEST FAILED'}: Source map exclusion is ${testPassed ? 'working correctly' : 'NOT working'}`);

// Cleanup
await import('fs/promises').then(fs => fs.rm(testDir, { recursive: true, force: true }));

if (!testPassed) {
  process.exit(1);
}
