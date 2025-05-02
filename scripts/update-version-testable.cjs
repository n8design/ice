#!/usr/bin/env node

/**
 * Version update helper script for Ice Tools (testable version)
 * Functions exported for testing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Environment check to prevent actual deployment during tests
const isTestEnvironment = process.env.NODE_ENV === 'test';
const isDryRun = process.env.DRY_RUN === 'true';

// Get list of projects that have been versioned
const getVersionedProjects = () => {
  try {
    // Safety check: Don't run actual git commands in test environment
    if (isTestEnvironment || isDryRun) {
      console.log('[TEST MODE] Would check git for changed package.json files');
      return [{ path: 'ice-build', packageJsonPath: 'ice-build/package.json' }]; // Mock data for testing
    }

    // Use git to find recently changed package.json files
    const output = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' });
    return output
      .split('\n')
      .filter(file => file.includes('package.json') && !file.includes('node_modules'))
      .map(file => ({
        path: path.dirname(file),
        packageJsonPath: file
      }));
  } catch (error) {
    console.error('Error getting versioned projects:', error.message);
    return [];
  }
};

// Read the new version from package.json
const getNewVersion = (packageJsonPath) => {
  try {
    // Safety check: Don't read actual files in test mode
    if (isTestEnvironment || isDryRun) {
      console.log(`[TEST MODE] Would read version from ${packageJsonPath}`);
      return '0.0.0-test';
    }

    const content = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);
    return packageJson.version;
  } catch (error) {
    console.error(`Error reading version from ${packageJsonPath}:`, error.message);
    return null;
  }
};

// Update changelog for a project
const updateChangelog = (projectPath, version) => {
  const changelogPath = path.join(projectPath, 'CHANGELOG.md');
  const date = new Date().toISOString().split('T')[0];
  
  try {
    // Safety check: Don't modify files in test environment
    if (isTestEnvironment || isDryRun) {
      console.log(`[TEST MODE] Would update changelog for ${projectPath} to version ${version}`);
      return true;
    }

    let changelogContent;
    
    if (fs.existsSync(changelogPath)) {
      changelogContent = fs.readFileSync(changelogPath, 'utf8');
    } else {
      const projectName = path.basename(projectPath);
      changelogContent = `# Changelog\n\nAll notable changes to the ${projectName} package will be documented in this file.\n\n`;
    }
    
    // Determine if this is an alpha release
    const isAlpha = version.includes('alpha');
    const releaseType = isAlpha ? 'Alpha' : 'Stable';
    
    // Add new version section at the top
    const newSection = `## ${version} (${date})\n\n### ${releaseType} Release\n\n- Update package version to ${version}\n\n`;
    changelogContent = changelogContent.replace('# Changelog', '# Changelog\n\n' + newSection);
    
    fs.writeFileSync(changelogPath, changelogContent, 'utf8');
    
    // Commit the changelog update - but not in test environment
    execSync(`git add ${changelogPath}`, { stdio: 'inherit' });
    execSync(`git commit -m "docs: update changelog for ${version}"`, { stdio: 'inherit' });
    
    console.log(`✅ Updated changelog for ${path.basename(projectPath)} to version ${version}`);
    return true;
  } catch (error) {
    console.error(`Error updating changelog for ${projectPath}:`, error.message);
    return false;
  }
};

// Main function
const main = () => {
  // Safety check: Extra warning in test environment
  if (isTestEnvironment || isDryRun) {
    console.warn('⚠️ TEST MODE ACTIVE - No actual changes will be made');
  }

  console.log('🔍 Looking for versioned projects...');
  
  const versionedProjects = getVersionedProjects();
  
  if (versionedProjects.length === 0) {
    console.log('No recently versioned projects found.');
    return;
  }
  
  console.log(`Found ${versionedProjects.length} recently versioned project(s).`);
  
  versionedProjects.forEach(project => {
    const version = getNewVersion(project.packageJsonPath);
    if (version) {
      console.log(`Updating changelog for ${path.basename(project.path)} (${version})...`);
      updateChangelog(project.path, version);
    }
  });
  
  console.log('\n✅ Version update process complete');
};

// Only execute script if it's being run directly
if (require.main === module) {
  main();
}

// Export functions for testing
module.exports = {
  getVersionedProjects,
  getNewVersion,
  updateChangelog,
  main
};