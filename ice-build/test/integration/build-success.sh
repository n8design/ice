#!/bin/bash

# filepath: /Volumes/Code/n8design/projects/ice/ice-build/test/integration/build-success.sh

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Starting Integration Test: Build Success ---"

# Define paths relative to the script location (ice-build/test/integration)
ICE_BUILD_ROOT_DIR=$(pwd)/../..
TEST_PROJECT_DIR="$ICE_BUILD_ROOT_DIR/test-ice-build"
ICE_BUILD_CLI="$ICE_BUILD_ROOT_DIR/ice-build/bin/cli.js"
OUTPUT_DIR="$TEST_PROJECT_DIR/public/dist"
EXPECTED_JS="$OUTPUT_DIR/index.js"
EXPECTED_CSS="$OUTPUT_DIR/styles.css"

echo "Test Project Directory: $TEST_PROJECT_DIR"
echo "Ice Build CLI: $ICE_BUILD_CLI"
echo "Expected Output Directory: $OUTPUT_DIR"

# Navigate to the test project directory
cd "$TEST_PROJECT_DIR"

# Clean previous build output
echo "Cleaning output directory: $OUTPUT_DIR"
rm -rf "$OUTPUT_DIR"

# Run the ice-build command
echo "Running ice-build..."
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