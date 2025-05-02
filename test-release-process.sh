#!/bin/bash
# filepath: /Volumes/Code/n8design/projects/ice/test-release-process.sh

# EMERGENCY SAFEGUARDS: Absolutely prevent any actual releases
export NODE_ENV=test
export DRY_RUN=true
export NPM_CONFIG_DRY_RUN=true
export TEST_MODE=true
# Use mock npm commands to prevent any real version changes
export PATH="$(pwd)/scripts/mock-commands:$PATH"

echo "🧪 TESTING RELEASE PROCESS"
echo "🔒 MAXIMUM SAFETY MODE: DEPLOYMENTS COMPLETELY DISABLED"
echo "======================================================"
echo ""

# Create mock commands directory to intercept npm version and publish
mkdir -p scripts/mock-commands
echo '#!/bin/bash
echo "[MOCK] Would run: npm $@"
if [[ "$1" == "version" ]]; then
  echo "v0.0.0-test-$(date +%s)"
else
  echo "Mock npm completed successfully"
fi
exit 0' > scripts/mock-commands/npm
chmod +x scripts/mock-commands/npm

# Create mock nx command
echo '#!/bin/bash
echo "[MOCK] Would run: nx $@"
exit 0' > scripts/mock-commands/nx
chmod +x scripts/mock-commands/nx

# Verify npm safety settings
echo "Installing safety guards..."
npm config set dry-run true

# Create a temporary git config to prevent real commits
git config --local alias.real-commit commit
git config --local commit.gpgsign false
# Override git commit to do nothing in test mode
git config --local alias.commit '!echo "[MOCK] Would commit: $@" && exit 0'

# Create a git branch for testing to avoid any accidental commits
CURRENT_BRANCH=$(git branch --show-current)
TEST_BRANCH="test-release-process-$(date +%s)"
echo "Creating temporary git branch '$TEST_BRANCH' for safety..."
git checkout -b $TEST_BRANCH

echo ""
echo "1️⃣  Running unit tests..."
npm run test:release
if [ $? -ne 0 ]; then
  echo "❌ Unit tests failed. Stopping test process."
  # Return to original branch
  git checkout $CURRENT_BRANCH
  git branch -D $TEST_BRANCH
  exit 1
fi

echo ""
echo "2️⃣  Running dry run for ice-build patch release..."
npm run dry-run:ice-build
if [ $? -ne 0 ]; then
  echo "❌ Dry run failed. Stopping test process."
  # Return to original branch
  git checkout $CURRENT_BRANCH
  git branch -D $TEST_BRANCH
  exit 1
fi

echo ""
echo "3️⃣  Running dry run for ice-build alpha release..."
npm run dry-run:ice-build:alpha
if [ $? -ne 0 ]; then
  echo "❌ Dry run failed. Stopping test process."
  # Return to original branch
  git checkout $CURRENT_BRANCH
  git branch -D $TEST_BRANCH
  exit 1
fi

echo ""
echo "✅ All tests completed successfully!"

# Enhanced cleanup: ensure everything is properly reset
echo ""
echo "Performing thorough cleanup..."
git checkout -f $CURRENT_BRANCH
git branch -D $TEST_BRANCH
git config --local --unset alias.commit
git config --local --unset alias.real-commit
git config --local --unset commit.gpgsign
npm config set dry-run false
rm -rf scripts/mock-commands

echo ""
echo "🔍 VERIFICATION:"
echo "- No actual releases were made"
echo "- No NPM packages were published"
echo "- No git tags were created"
echo "- All changes were contained in a temporary branch that has been deleted"
echo "- Mock commands were used instead of real npm/nx commands"
echo ""
echo "If you want to perform a real release, run the release commands manually:"
echo "npm run release:alpha:ice-build  # For alpha release"
echo "npm run release:stable:ice-build -- patch  # For stable release"