import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Set test environment for added safety
process.env.NODE_ENV = 'test';

// Mock fs and child_process
vi.mock('fs');
vi.mock('child_process');

// Import helper functions using CommonJS require
const testableModule = require('../update-version-testable.cjs');
const { getVersionedProjects, getNewVersion, updateChangelog } = testableModule;

describe('Version Update Helper Script', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getVersionedProjects', () => {
    it('should identify projects with changed package.json files', () => {
      // Mock execSync to return changed package.json files
      vi.mocked(execSync).mockReturnValueOnce(
        'ice-build/package.json\nsome-other-file.js\nice-hotreloader/package.json'
      );

      const projects = getVersionedProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0].path).toBe('ice-build');
      expect(projects[0].packageJsonPath).toBe('ice-build/package.json');
      expect(projects[1].path).toBe('ice-hotreloader');
    });

    it('should filter out package.json files in node_modules', () => {
      vi.mocked(execSync).mockReturnValueOnce(
        'ice-build/package.json\nnode_modules/some-lib/package.json'
      );

      const projects = getVersionedProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].path).toBe('ice-build');
    });

    it('should handle errors gracefully', () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Command failed');
      });

      const projects = getVersionedProjects();
      expect(projects).toEqual([]);
    });
  });

  describe('getNewVersion', () => {
    it('should extract version from package.json', () => {
      vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify({ version: '1.2.3' }));

      const version = getNewVersion('ice-build/package.json');
      expect(version).toBe('1.2.3');
    });

    it('should handle errors gracefully', () => {
      vi.mocked(fs.readFileSync).mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      const version = getNewVersion('nonexistent/package.json');
      expect(version).toBeNull();
    });
  });

  describe('updateChangelog', () => {
    it('should update existing changelog', () => {
      // Mock file existence
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);
      
      // Mock file content
      vi.mocked(fs.readFileSync).mockReturnValueOnce('# Changelog\n\nOld content');
      
      // Fix for Date object mocking
      const originalDate = global.Date;
      const mockDate = new Date('2023-04-15');
      
      // Mock Date constructor and methods
      global.Date = class extends Date {
        constructor() {
          super();
          return mockDate;
        }
        static toISOString() {
          return mockDate.toISOString();
        }
      } as any;
      
      // Call the function
      updateChangelog('ice-build', '1.2.3');
      
      // Verify that write was called with updated content
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'ice-build/CHANGELOG.md',
        expect.stringContaining('## 1.2.3 (2023-04-15)'),
        'utf8'
      );
      
      // Verify changelog content structure
      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain('# Changelog');
      expect(content).toContain('## 1.2.3 (2023-04-15)');
      expect(content).toContain('### Stable Release');
      expect(content).toContain('Old content');
      
      // Restore Date
      global.Date = originalDate;
    });

    it('should create a new changelog if none exists', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);
      
      // Fix for Date object mocking
      const originalDate = global.Date;
      const mockDate = new Date('2023-04-15');
      
      // Mock Date constructor and toISOString
      global.Date = class extends Date {
        constructor() {
          super();
          return mockDate;
        }
        static toISOString() {
          return mockDate.toISOString();
        }
      } as any;
      
      updateChangelog('ice-build', '1.2.3-alpha.1');
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'ice-build/CHANGELOG.md',
        expect.stringContaining('## 1.2.3-alpha.1 (2023-04-15)'),
        'utf8'
      );
      
      const content = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(content).toContain('# Changelog');
      expect(content).toContain('### Alpha Release');
      
      // Restore Date
      global.Date = originalDate;
    });
  });
});
