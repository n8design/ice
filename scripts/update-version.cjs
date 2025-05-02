#!/usr/bin/env node

/**
 * Version update helper script for Ice Tools
 * Handles changelog updates after NX has handled versioning
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get list of projects that have been versioned
const getVersionedProjects = () => {
  try {
    // Use git to find recently changed package.json files
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
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
  try {
    // Use conventional-changelog to update the changelog
    console.log(`Updating changelog for ${projectPath}...`);
    execSync(`npm run changelog:${path.basename(projectPath)}`, { stdio: 'inherit' });
    
    // Stage the changelog
    console.log(`Staging changelog for ${projectPath}...`);
    const changelogPath = path.join(projectPath, 'CHANGELOG.md');
    execSync(`git add ${changelogPath}`, { stdio: 'inherit' });
    
    return true;
  } catch (error) {
    console.error(`Error updating changelog for ${projectPath}:`, error.message);
    return false;
  }
};

// Main function
const main = () => {
  console.log('🔍 Looking for versioned projects...');
  
  const versionedProjects = getVersionedProjects();
  
  if (versionedProjects.length === 0) {
    console.log('No recently versioned projects found.');
    return;
  }
  
  console.log(`Found ${versionedProjects.length} versioned project(s).`);
  
  versionedProjects.forEach(project => {
    const version = getNewVersion(project.packageJsonPath);
    if (version) {
      console.log(`Project ${path.basename(project.path)} versioned to ${version}`);
      updateChangelog(project.path, version);
    }
  });
  
  console.log('\n✅ Version update process complete');
};

// Execute the main function
main();
