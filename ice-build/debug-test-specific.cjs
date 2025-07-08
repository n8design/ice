const path = require('path');

// Simulate the normalizePath method from scss.ts
function normalizePath(filePath) {
  // Convert all backslashes to forward slashes for cross-platform compatibility
  let normalized = filePath.replace(/\\/g, '/');
  
  // Handle the special case of ./../ patterns - preserve them as-is after backslash conversion
  if (normalized.includes('./..')) {
    // Don't normalize paths that contain ./../ - preserve them as-is after backslash conversion
    // Just clean up any consecutive slashes
    normalized = normalized.replace(/\/+/g, '/');
  } else {
    // Track if this was originally a relative path starting with ./
    const wasRelativeWithDot = normalized.startsWith('./');
    
    // For regular paths, use posix normalization to handle ../ properly
    normalized = path.posix.normalize(normalized);
    
    // If the original was './something' and normalize removed the './', restore it
    // This maintains compatibility with existing tests that expect relative paths to start with ./
    if (wasRelativeWithDot && !normalized.startsWith('./') && !normalized.startsWith('../') && !path.isAbsolute(normalized)) {
      normalized = './' + normalized;
    }
  }
  
  return normalized;
}

// Test the failing case
const input = '.\\..\\styles\\variables.scss';
const expected = './../styles/variables.scss';
const result = normalizePath(input);

console.log('Input:', JSON.stringify(input));
console.log('Expected:', JSON.stringify(expected));
console.log('Result:', JSON.stringify(result));
console.log('Are they equal?', result === expected);
console.log('Result length:', result.length);
console.log('Expected length:', expected.length);

// Check character by character
for (let i = 0; i < Math.max(result.length, expected.length); i++) {
  if (result[i] !== expected[i]) {
    console.log(`Difference at position ${i}: result="${result[i]}" (${result.charCodeAt(i)}) vs expected="${expected[i]}" (${expected.charCodeAt(i)})`);
  }
}
