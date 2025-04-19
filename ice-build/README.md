# Ice Build Tool

`@n8d/ice-build` is a command-line tool designed to streamline the build process for frontend projects, integrating Sass compilation, JavaScript bundling with esbuild, and optional hot module reloading via `@n8d/ice-hotreloader`.

![hTWOo Iced Logo](https://raw.githubusercontent.com/n8design/ice/refs/heads/main/assets/frozen-htwoo.webp)

## Overview

This utility simplifies common frontend build tasks:

-   **Sass Compilation:** Compiles `.scss` or `.sass` files into CSS using `esbuild-sass-plugin`.
-   **PostCSS Integration:** Applies PostCSS transformations, including `autoprefixer`.
-   **JavaScript Bundling:** Uses `esbuild` for fast JavaScript/TypeScript bundling and minification.
-   **ESLint Integration:** Lints source files during the build process.
-   **File Watching:** Monitors source files for changes and triggers rebuilds automatically.
-   **Hot Module Reloading (HMR):** Integrates with `@n8d/ice-hotreloader` to push changes to connected clients without full page reloads (when watching).

## Installation

Install the tool as a development dependency in your project:

```bash
npm install --save-dev @n8d/ice-build @n8d/ice-hotreloader
# or
yarn add --dev @n8d/ice-build @n8d/ice-hotreloader
```

You might also need peer dependencies like `esbuild`, `sass`, `postcss`, `autoprefixer`, etc., depending on your specific configuration needs.

## Usage

You can run the build tool via the command line or npm scripts.

**Command Line:**

```bash
# Run a single build
npx ice-build --project=/path/to/your/project

# Run in watch mode with HMR
npx ice-build --project=/path/to/your/project --watch
```

**npm Scripts (Recommended):**

Add scripts to your project's `package.json`:

```json
{
  "scripts": {
    "build": "ice-build",
    "watch": "ice-build --watch"
  }
}
```

Then run:

```bash
# Run a single build
npm run build

# Run in watch mode
npm run watch
```

**Configuration:**

The tool typically looks for source files within a `source` directory and outputs to a `dist` directory relative to the project path specified (or the current working directory if `--project` is omitted). Specific input/output paths and other options might be configurable via command-line arguments or a configuration file in future versions.
