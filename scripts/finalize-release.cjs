#!/usr/bin/env node

/**
 * Finalizes the release process with commit, tag and push
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get the package name from command line
const packageName = process.argv[2];
if (!packageName) {
  console.error('Error: Package name is required');
  process.exit(1);
}

try {
  // Read the version from package.json
  const packageJsonPath = path.join(packageName, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  
  // Create tag name
  const tagName = `${packageName}@${version}`;
  
  // Determine if this is an alpha release
  const isAlpha = version.includes('alpha');
  const releaseType = isAlpha ? 'alpha' : 'release';
  
  console.log(`Finalizing ${releaseType} for ${packageName} version ${version}`);
  
  // Create commit message
  const commitMsg = `chore(release): ${packageName} ${releaseType} ${version}`;
  
  // Commit changes
  console.log('Creating commit...');
  execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
  
  // Create tag
  console.log('Creating tag...');
  execSync(`git tag -f ${tagName}`, { stdio: 'inherit' });
  
  // Add npm publish step
  console.log('Publishing to npm registry...');
  execSync(`cd ${packageName} && npm publish`, { stdio: 'inherit' });
  
  // Push changes and tags
  console.log('Pushing to remote...');
  execSync('git push --follow-tags', { stdio: 'inherit' });
  
  console.log(`\n✅ Release finalized: ${tagName}`);
} catch (error) {
  console.error(`\n❌ Error finalizing release: ${error.message}`);
  process.exit(1);
}
