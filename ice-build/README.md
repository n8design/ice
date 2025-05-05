# Ice Build Tool

Ice Build is a modern, fast, and efficient build tool designed for TypeScript and SCSS projects. It leverages esbuild for TypeScript compilation and Dart Sass for SCSS compilation, providing a streamlined development experience with built-in watch mode and hot reloading capabilities.

![hTWOo Iced Logo](https://raw.githubusercontent.com/n8design/ice/refs/heads/main/assets/frozen-htwoo.webp)

## Features

*   **Fast Builds:** Utilizes esbuild and Dart Sass for rapid compilation.
*   **TypeScript Support:** Compiles TypeScript (`.ts`, `.tsx`) files efficiently.
*   **Modern SCSS:** Compiles SCSS/SASS (`.scss`, `.sass`) using the modern Dart Sass implementation.
*   **Watch Mode:** Monitors files for changes and automatically rebuilds.
*   **Hot Reloading:** Integrates with `@n8d/ice-hotreloader` for seamless CSS injection and page reloads.
*   **PostCSS Integration:** Includes Autoprefixer for CSS vendor prefixes with automatic browserslist configuration discovery.
*   **Configurable:** Uses an `ice.config.js` file for project-specific settings.

## Installation

```bash
npm install @n8d/ice-build --save-dev
# or
yarn add @n8d/ice-build --dev
```

### Peer Dependencies

Ice Build requires the following peer dependencies:

```bash
# Install required peer dependencies
npm install @n8d/ice-hotreloader@^0.0.1 autoprefixer --save-dev
```

The following dependencies are bundled with ice-build and don't need separate installation:
- esbuild (TypeScript compilation)
- sass (SCSS/SASS compilation)
- postcss & autoprefixer (CSS post-processing)
- chokidar (File watching)

## Usage

### CLI Commands

*   **`ice-build build`**: Compiles the project based on the configuration.
    *   `--config <path>`: Specify a custom path to the configuration file. Defaults to `./ice.config.js`.
    *   `--clean`: Clean the output directory before building.
    *   `--verbose`: Enable verbose logging.
*   **`ice-build watch`**: Starts the build process in watch mode with hot reloading.
    *   `--config <path>`: Specify a custom path to the configuration file. Defaults to `./ice.config.js`.
    *   `--verbose`: Enable verbose logging.

> **Backward Compatibility Note:** You can also use `ice-build --watch` for watch mode (equivalent to `ice-build watch`)
> 
> **Important:** Make sure the config file path is correct. For example, if your config file is named `ice-build.config.js`, use `--config ./ice-build.config.js`. The path is relative to the current working directory.

### Configuration (`ice.config.js`)

Create an `ice.config.js` file in your project root:

```javascript
// ice.config.js
export default {
  input: {
    path: 'source', // Default input directory (corrected)
    // Define specific entry points if needed, otherwise all .ts/.tsx/.scss/.sass in input.path are processed
    // entries: {
    //   main: 'index.ts',
    //   styles: 'style.scss'
    // }
  },
  output: {
    path: 'public', // Default output directory (corrected)
    // Configure output filenames if needed
    // filenames: {
    //   js: '[name].bundle.js',
    //   css: '[name].bundle.css'
    // }
  },
  // SCSS specific options
  scss: {
    // includePaths: ['node_modules'], // Add paths for @import or @use
    // sourceMap: true, // Enable/disable source maps (default: true for dev, false for prod)
  },
  // PostCSS options
  postcss: {
    // Add custom PostCSS plugins if needed
    // plugins: [require('cssnano')()]
  },
  // TypeScript specific options (using esbuild)
  typescript: {
    // target: 'es2020', // esbuild target (default: 'es2020')
    // format: 'esm', // esbuild format (default: 'esm')
    // sourceMap: true, // Enable/disable source maps (default: true for dev, false for prod)
  },
  // Hot reloading options
  hotreload: {
    port: 8080, // WebSocket server port (default: 8080)
  },
  // Copy static assets
  assets: {
    // Define source and destination for static files
    // Example: copy everything from 'source/assets' to 'public/assets'
    // 'assets': 'assets'
  }
};
```

### Browser Compatibility Configuration

Ice Build uses Autoprefixer to automatically add vendor prefixes to CSS properties. By default, Autoprefixer uses [browserslist](https://github.com/browserslist/browserslist) to determine which prefixes are needed.

You can configure your target browsers by adding a browserslist configuration:

1. Add to your `package.json`:
```json
{
  "browserslist": [
    ">0.3%",
    "last 2 versions",
    "not dead"
  ]
}
```

2. Or create a `.browserslistrc` file in your project root:
````
`````
