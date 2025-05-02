/**
 * Helper script to ensure test directories exist
 */
const fs = require('fs');
const path = require('path');

// Ensure directories exist
const dirs = [
  'scripts/tests',
  'tools/nx-plugin',
  'tools/nx-plugin/tests'
];

dirs.forEach(dir => {
  const fullPath = path.resolve(__dirname, '../../', dir);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`Creating directory: ${fullPath}`);
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

console.log('Directory structure created successfully');
