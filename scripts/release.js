#!/usr/bin/env node

/**
 * Release script for Ice Tools
 * Handles versioning, changelog updates, git operations, and publishing
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
let packageName = null;
let releaseType = null;

// Parse arguments
args.forEach(arg => {
  if (arg.startsWith('--package=')) {
    packageName = arg.split('=')[1];
  } else if (arg.startsWith('--type=')) {
    releaseType = arg.split('=')[1];
  } else if (arg === '--type') {
    // When used like: npm run release:stable:ice-build -- patch
    releaseType = args[args.indexOf(arg) + 1];
  }
});

// Validate inputs
if (!packageName) {
  console.error('Error: Package name is required (--package=ice-build or --package=ice-hotreloader)');
  process.exit(1);
}

if (!releaseType) {
  console.error('Error: Release type is required (--type=alpha, --type=patch, --type=minor, or --type=major)');
  process.exit(1);
}

// Map of known packages and their directories
const packageDirs = {
  'ice-build': 'ice-build',
  'ice-hotreloader': 'ice-hotreloader'
};

if (!packageDirs[packageName]) {
  console.error(`Error: Unknown package "${packageName}"`);
  process.exit(1);
}

const packageDir = path.join(process.cwd(), packageDirs[packageName]);

// Ensure package directory exists
if (!fs.existsSync(packageDir)) {
  console.error(`Error: Package directory not found: ${packageDir}`);
  process.exit(1);
}

// Determine the npm version command based on release type
let versionCmd = '';
if (releaseType === 'alpha') {
  versionCmd = 'npm version prerelease --preid=alpha';
} else if (['patch', 'minor', 'major'].includes(releaseType)) {
  versionCmd = `npm version ${releaseType}`;
} else {
  console.error(`Error: Invalid release type "${releaseType}"`);
  process.exit(1);
}

try {
  console.log(`\n🚀 Starting release process for ${packageName} (${releaseType})\n`);
  
  // Step 1: Build the package
  console.log('Building package...');
  execSync(`cd ${packageDir} && npm run build`, { stdio: 'inherit' });
  
  // Step 2: Run tests
  console.log('\nRunning tests...');
  execSync(`cd ${packageDir} && npm test`, { stdio: 'inherit' });
  
  // Step 3: Update version
  console.log('\nUpdating version...');
  const versionOutput = execSync(`cd ${packageDir} && ${versionCmd}`, { encoding: 'utf8' });
  const newVersion = versionOutput.trim();
  console.log(`New version: ${newVersion}`);
  
  // Step 4: Update changelog
  console.log('\nUpdating changelog...');
  const date = new Date().toISOString().split('T')[0];
  
  // Read existing changelog or create a new one
  const changelogPath = path.join(packageDir, 'CHANGELOG.md');
  let changelogContent = '';
  
  if (fs.existsSync(changelogPath)) {
    changelogContent = fs.readFileSync(changelogPath, 'utf8');
  } else {
    changelogContent = `# Changelog\n\nAll notable changes to the ${packageName} package will be documented in this file.\n\n`;
  }
  
  // Add new version section at the top
  const newSection = `## ${newVersion} (${date})\n\n### Changes\n\n- Release ${releaseType} version\n\n`;
  changelogContent = changelogContent.replace('# Changelog', '# Changelog\n\n' + newSection);
  
  fs.writeFileSync(changelogPath, changelogContent, 'utf8');
  
  // Step 5: Commit changelog update
  console.log('Committing changelog update...');
  execSync(`cd ${packageDir} && git add CHANGELOG.md`, { stdio: 'inherit' });
  execSync(`cd ${packageDir} && git commit -m "docs: update changelog for ${newVersion}"`, { stdio: 'inherit' });
  
  // Step 6: Publish to npm
  console.log('\nPublishing to npm...');
  execSync(`cd ${packageDir} && npm publish`, { stdio: 'inherit' });
  
  // Step 7: Push git changes and tags
  console.log('\nPushing git changes and tags...');
  execSync(`cd ${packageDir} && git push --follow-tags`, { stdio: 'inherit' });
  
  console.log(`\n✅ Successfully released ${packageName} version ${newVersion}\n`);
} catch (error) {
  console.error(`\n❌ Release process failed: ${error.message}`);
  process.exit(1);
}
