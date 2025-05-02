import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';

// Set test environment for added safety
process.env.NODE_ENV = 'test';

// Mock child_process
vi.mock('child_process');

// Import the handler using CommonJS require
const releaseModule = require('../release-testable.cjs');
const { handler } = releaseModule;

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation(vi.fn() as any);

describe('NX Release Executor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Prevent process.exit from ending tests
    mockExit.mockImplementation(vi.fn() as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handler', () => {
    it('should execute all release steps for patch release', async () => {
      // Mock execSync to simulate successful commands
      vi.mocked(execSync).mockImplementation(() => 'v1.0.1');

      const result = await handler({
        releaseType: 'patch',
        projectName: 'ice-build'
      });

      // Verify all steps were executed
      expect(vi.mocked(execSync)).toHaveBeenCalledWith('nx build ice-build', { stdio: 'inherit' });
      expect(vi.mocked(execSync)).toHaveBeenCalledWith('nx test ice-build', { stdio: 'inherit' });
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(expect.stringContaining('npm version patch'), expect.anything());
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(expect.stringContaining('npm publish'), expect.anything());
      expect(vi.mocked(execSync)).toHaveBeenCalledWith('git push --follow-tags', { stdio: 'inherit' });
      
      expect(result.success).toBe(true);
    });

    it('should execute all release steps for alpha release', async () => {
      vi.mocked(execSync).mockImplementation(() => 'v1.0.1-alpha.1');

      const result = await handler({
        releaseType: 'prerelease',
        preid: 'alpha',
        projectName: 'ice-build'
      });

      // Verify the version command includes preid
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(
        expect.stringContaining('npm version prerelease --preid=alpha'),
        expect.anything()
      );
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Simulate a failed build
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Build failed');
      });

      const result = await handler({
        releaseType: 'patch',
        projectName: 'ice-build'
      });

      // Verify error was handled
      expect(result.success).toBe(false);
    });

    it('should fail if no project is specified', async () => {
      await handler({
        releaseType: 'patch',
        projectName: ''
      });

      // Verify process.exit was called
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
