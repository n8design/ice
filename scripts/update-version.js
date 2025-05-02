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
    
    // Commit the changelog update
    execSync(`git add ${changelogPath}`, { stdio: 'inherit' });
    execSync(`git commit -m "docs: update changelog for ${version}"`, { stdio: 'inherit' });
    
    console.log(`✅ Updated changelog for ${path.basename(projectPath)} to version ${version}`);
  } catch (error) {
    console.error(`Error updating changelog for ${projectPath}:`, error.message);
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

// Execute script
main();
