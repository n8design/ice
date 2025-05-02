import { vi } from 'vitest';

// Mock glob to avoid path-scurry dependency issues
vi.mock('glob', () => {
  return {
    glob: vi.fn().mockResolvedValue([]),
    globSync: vi.fn().mockReturnValue([]),
    globStream: vi.fn(),
    globIterateSync: vi.fn(function* () {}),
    globIterate: vi.fn(),
    Glob: vi.fn(),
    default: {
      glob: vi.fn().mockResolvedValue([]),
      globSync: vi.fn().mockReturnValue([]),
      globStream: vi.fn(),
      globIterateSync: vi.fn(function* () {}),
      globIterate: vi.fn(),
      Glob: vi.fn(),
    }
  };
});
