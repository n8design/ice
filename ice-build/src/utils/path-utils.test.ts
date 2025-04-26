// filepath: /Volumes/Code/n8design/projects/ice/ice-build/src/utils/path-utils.test.ts
import { describe, it, expect } from 'vitest';
import { normalizePath } from './path-utils.js'; // Use .js extension

describe('normalizePath', () => {
  it('should replace backslashes with forward slashes', () => {
    expect(normalizePath('path\\to\\file')).toBe('path/to/file');
  });

  it('should handle mixed slashes', () => {
    expect(normalizePath('path/to\\file')).toBe('path/to/file');
  });

  it('should return unchanged path if no backslashes', () => {
    expect(normalizePath('path/to/file')).toBe('path/to/file');
  });

  it('should handle empty string', () => {
    expect(normalizePath('')).toBe('');
  });

  it('should handle single backslash', () => {
    expect(normalizePath('\\')).toBe('/');
  });

  it('should handle Windows drive letters', () => {
    expect(normalizePath('C:\\Users\\Test')).toBe('C:/Users/Test');
  });
});