/**
 * Custom NX executor for releasing packages (testable version)
 */
const { execSync } = require('child_process');

const handler = async (args) => {
  const { releaseType, preid, projectName } = args;
  
  if (!projectName) {
    console.error('No project specified');
    process.exit(1);
  }
  
  console.log(`🚀 Starting release process for ${projectName}...`);
  
  try {
    // Step 1: Build the package
    console.log(`\nBuilding ${projectName}...`);
    execSync(`nx build ${projectName}`, { stdio: 'inherit' });
    
    // Step 2: Run tests
    console.log(`\nRunning tests for ${projectName}...`);
    execSync(`nx test ${projectName}`, { stdio: 'inherit' });
    
    // Step 3: Update version
    console.log(`\nUpdating version for ${projectName}...`);
    
    let versionCmd = `npm version ${releaseType}`;
    if (releaseType === 'prerelease' && preid) {
      versionCmd = `npm version ${releaseType} --preid=${preid}`;
    }
    
    const projectPath = `${projectName}`;
    const versionOutput = execSync(`cd ${projectPath} && ${versionCmd}`, { encoding: 'utf8' });
    const newVersion = versionOutput.trim();
    console.log(`New version: ${newVersion}`);
    
    // Step 4: Publish to npm
    console.log(`\nPublishing ${projectName} to npm...`);
    execSync(`cd ${projectPath} && npm publish`, { stdio: 'inherit' });
    
    // Step 5: Push git changes and tags
    console.log('\nPushing git changes and tags...');
    execSync(`git push --follow-tags`, { stdio: 'inherit' });
    
    console.log(`\n✅ Successfully released ${projectName} version ${newVersion}`);
    return { success: true };
  } catch (error) {
    console.error(`\n❌ Release process failed: ${error.message}`);
    return { success: false };
  }
};

const builder = (yargs) => {
  return yargs
    .option('releaseType', {
      type: 'string',
      description: 'Release type (patch, minor, major, prerelease)',
      required: true
    })
    .option('preid', {
      type: 'string',
      description: 'Pre-release identifier (alpha, beta, etc.)',
      required: false
    });
};

// Export for NX
module.exports = {
  name: 'release',
  builder,
  handler
};

// Export for testing
if (typeof exports !== 'undefined') {
  exports.handler = handler;
  exports.builder = builder;
}
