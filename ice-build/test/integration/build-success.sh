#!/bin/bash

# filepath: /Volumes/Code/n8design/projects/ice/ice-build/test/integration/build-success.sh

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Starting Integration Test: Build Success ---"

# Get the directory where the script itself resides
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Calculate project root relative to the script's location
# SCRIPT_DIR = .../ice-build/test/integration
# ICE_PROJECT_ROOT_DIR = .../ice-build/test/integration/../../.. = root of the 'ice' project checkout
ICE_PROJECT_ROOT_DIR="$SCRIPT_DIR/../../.."

# Define paths relative to the project root
TEST_PROJECT_DIR="$ICE_PROJECT_ROOT_DIR/test-ice-build"
ICE_BUILD_CLI="$ICE_PROJECT_ROOT_DIR/ice-build/bin/cli.js" # Path to CLI within the project
OUTPUT_DIR="$TEST_PROJECT_DIR/public/dist"
EXPECTED_JS="$OUTPUT_DIR/index.js"
EXPECTED_CSS="$OUTPUT_DIR/styles.css"

echo "Project Root Directory: $ICE_PROJECT_ROOT_DIR"
echo "Test Project Directory: $TEST_PROJECT_DIR"
echo "Ice Build CLI: $ICE_BUILD_CLI"
echo "Expected Output Directory: $OUTPUT_DIR"

# Check if test project directory exists before trying to cd
if [ ! -d "$TEST_PROJECT_DIR" ]; then
  echo "❌ ERROR: Test project directory not found: $TEST_PROJECT_DIR"
  echo "Listing contents of project root ($ICE_PROJECT_ROOT_DIR):"
  ls -la "$ICE_PROJECT_ROOT_DIR"
  exit 1
fi

# Navigate to the test project directory
echo "Changing directory to: $TEST_PROJECT_DIR"
cd "$TEST_PROJECT_DIR"

# Clean previous build output
echo "Cleaning output directory: $OUTPUT_DIR"
rm -rf "$OUTPUT_DIR"

# Run the ice-build command using the calculated path to the CLI
echo "Running ice-build..."
# Use node to execute the CLI script directly from its path
node "$ICE_BUILD_CLI"

# Check if the build command exited successfully
if [ $? -ne 0 ]; then
  echo "❌ ERROR: ice-build command failed!"
  exit 1
fi
echo "✅ ice-build command finished successfully."

# Check if output files exist
echo "Checking for output files..."
if [ ! -f "$EXPECTED_JS" ]; then
  echo "❌ ERROR: Expected JS file not found: $EXPECTED_JS"
  exit 1
fi
echo "✅ Found JS file: $EXPECTED_JS"

if [ ! -f "$EXPECTED_CSS" ]; then
  echo "❌ ERROR: Expected CSS file not found: $EXPECTED_CSS"
  exit 1
fi
echo "✅ Found CSS file: $EXPECTED_CSS"

echo "--- Integration Test: Build Success PASSED ---"
exit 0