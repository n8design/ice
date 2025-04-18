# Core Build Tool

A Node.js tool for building and managing core components of your project.

## Overview

This utility helps you streamline the build process for core components by:
- Compiling source files
- Bundling assets
- Minifying code
- Generating source maps
- Running tests

## Installation

```bash
npm install --save-dev @n8d/core-build
```

## Directory Structure

```
core-build/
├── src/               # Source files
│   ├── components/
│   ├── styles/
│   └── scripts/
├── dist/              # Distribution files
├── build.js           # Build script
├── package.json       # Project configuration
└── README.md          # Project documentation
```

## Usage

```bash
core-build [options]
```

### Options

| Option          | Description                                              |
|-----------------|----------------------------------------------------------|
| `-s, --source <path>` | Source directory (defaults to ./src)                     |
| `-d, --dist <path>`   | Distribution directory (defaults to ./dist)              |
| `-w, --watch`         | Watch files for changes and rebuild automatically        |
| `-m, --minify`        | Minify the output files                                   |
| `--sourcemaps`        | Generate source maps                                      |
| `-h, --help`          | Show help message                                         |

### Examples

**Build the project:**
```bash
core-build --source ./src --dist ./dist
```

**Watch files for changes and rebuild automatically:**
```bash
core-build --watch
```

**Minify the output files:**
```bash
core-build --minify
```

**Generate source maps:**
```bash
core-build --sourcemaps
```

## Features

### Source Compilation

The tool compiles source files from the specified source directory and outputs them to the distribution directory.

### Asset Bundling

Bundles assets such as JavaScript, CSS, and images into optimized files for production.

### Code Minification

Minifies the output files to reduce file size and improve load times.

### Source Maps

Generates source maps to help with debugging minified code.

### File Watching

Watches files for changes and automatically rebuilds the project when changes are detected.

## License

MIT