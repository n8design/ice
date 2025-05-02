/**
 * Type declarations for update-version-testable.cjs
 */

/**
 * Project version information
 */
export interface ProjectInfo {
  path: string;
  packageJsonPath: string;
}

/**
 * Get list of projects that have been versioned
 */
export function getVersionedProjects(): ProjectInfo[];

/**
 * Read the new version from package.json
 */
export function getNewVersion(packageJsonPath: string): string | null;

/**
 * Update changelog for a project
 */
export function updateChangelog(projectPath: string, version: string): boolean;

/**
 * Main function to update changelogs for all versioned projects
 */
export function main(): void;
