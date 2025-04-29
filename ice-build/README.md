# Ice Build

`@n8d/ice-build` is a lightweight, modern frontend build tool designed for TypeScript and SCSS projects with built-in hot reload support.

![hTWOo Iced Logo](https://raw.githubusercontent.com/n8design/ice/refs/heads/main/assets/frozen-htwoo.webp)

## Overview

Ice Build simplifies frontend development with a fast, efficient build system that includes:

- TypeScript/TSX compilation with esbuild
- SCSS compilation with Dart Sass
- PostCSS processing with Autoprefixer
- Smart dependency tracking for partial SCSS files
- Hot Module Reloading via integration with ice-hotreloader
- Live reload for instant CSS updates without page refreshes

## Installation

Install the package and its peer dependencies:

```bash
# Install ice-build and its required hot-reloader
npm install --save-dev @n8d/ice-build @n8d/ice-hotreloader

# Install required peer dependencies
npm install --save-dev esbuild sass postcss autoprefixer

# Optional peer dependencies for enhanced functionality
npm install --save-dev eslint typescript
```

## Quick Start

### Basic Usage

1. Create your project with the following structure:
   ```
   project/
   ├── source/         # Source files
   │   ├── index.ts    # TypeScript entry point
   │   └── styles.scss # SCSS styles
   ├── public/         # Output directory (created automatically)
   └── package.json    # Project configuration
   ```

2. Add scripts to your `package.json`:
   ```json
   "scripts": {
     "start": "ice-build --watch",
     "build": "ice-build --clean",
     "clean": "rimraf public/*.js public/*.css public/*.map"
   }
   ```

3. Run development mode:
   ```bash
   npm start
   ```

4. Build for production:
   ```bash
   npm run build
   ```

### Custom Configuration

Create an `ice.config.js` file in your project root to customize the build:

```js
// ice.config.js
export default {
  input: {
    ts: ['source/**/*.ts', 'source/**/*.tsx'],
    scss: ['source/**/*.scss']
  },
  output: {
    path: 'public'
  },
  watch: {
    paths: ['source'],
    ignored: ['node_modules', '.git', 'public']
  },
  hotreload: {
    port: 3001,
    debounceTime: 300
  },
  esbuild: {
    bundle: true,
    minify: true,
    sourcemap: true,
    target: 'es2018'
  },
  sass: {
    style: 'expanded',
    sourceMap: true
  }
}
```

## CLI Options

```
ice-build [options]

Options:
  -V, --version        output the version number
  -c, --config <path>  Path to config file
  -w, --watch          Watch for changes and rebuild
  --clean              Clean output directory before building
  -v, --verbose        Enable verbose logging
  -h, --help           display help for command
```

## Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `input.ts` | `string[]` | `['src/**/*.ts', 'src/**/*.tsx']` | TypeScript source globs |
| `input.scss` | `string[]` | `['src/**/*.scss', 'src/**/*.sass']` | SCSS source globs |
| `input.html` | `string[]` | `['src/**/*.html']` | HTML source globs |
| `output.path` | `string` | `'dist'` | Output directory path |
| `watch.paths` | `string[]` | `['src']` | Directories to watch for changes |
| `watch.ignored` | `string[]` | `['node_modules', '.git', 'dist']` | Patterns to ignore when watching |
| `hotreload.port` | `number` | `3001` | WebSocket server port |
| `hotreload.debounceTime` | `number` | `300` | Debounce time for reload events (ms) |
| `esbuild` | `object` | See below | esbuild configuration |
| `sass` | `object` | See below | Sass compiler configuration |
| `postcss` | `object` | See below | PostCSS configuration |

### Default esbuild Configuration

```js
{
  bundle: true,
  minify: true,
  sourcemap: true,
  target: 'es2018'
}
```

### Default Sass Configuration

```js
{
  style: 'expanded',
  sourceMap: true
}
```

### Default PostCSS Configuration

```js
{
  plugins: [] // Autoprefixer is added automatically
}
```

## Integration with ice-hotreloader

Ice Build integrates seamlessly with ice-hotreloader to provide live reload capabilities:

- CSS changes are injected without a full page reload
- TypeScript/HTML changes trigger a full page reload
- SCSS partial changes trigger rebuilds of all dependent files

To enable hot reloading, simply add the following to your HTML:

```html
<script>
  (function() {
    const socket = new WebSocket(`ws://${location.hostname}:3001`);
    
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'css') {
        // CSS hot reload
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          const url = new URL(link.href);
          url.searchParams.set('t', Date.now());
          link.href = url.toString();
        });
      } else if (message.type === 'full') {
        // Full page reload
        window.location.reload();
      }
    });
  })();
</script>
```

## SCSS Dependency Tracking

Ice Build includes intelligent SCSS dependency tracking:

- When a partial file (e.g., `_variables.scss`) is changed, all files that import it are automatically rebuilt
- Supports both `@import` and `@use` syntax
- Handles nested dependencies

## Node.js API

You can also use Ice Build programmatically:

```js
import { ConfigManager, BuildManager } from '@n8d/ice-build';

const configManager = new ConfigManager();
const config = configManager.getConfig();
const outputPath = configManager.getOutputPath();

const buildManager = new BuildManager(config, outputPath);

// Build all files
await buildManager.buildAll();

// Clean output directory
await buildManager.cleanAll();
```

## Requirements

- Node.js 18 or later
- Project using TypeScript and/or SCSS/SASS

## License

MIT
