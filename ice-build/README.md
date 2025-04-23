# Ice Build Tool

`@n8d/ice-build` is a command-line tool designed to simplify the build process for frontend projects. It integrates common tools like Sass, PostCSS (with Autoprefixer), esbuild (for JavaScript/TypeScript bundling), and ESLint.

![hTWOo Iced Logo](https://raw.githubusercontent.com/n8design/ice/refs/heads/main/assets/frozen-htwoo.webp)

## Features

- **Sass/SCSS Compilation:** Compiles `.scss` files to `.css` with intelligent partial detection.
- **PostCSS Integration:** Applies PostCSS plugins, including Autoprefixer by default.
- **TypeScript Processing:** Compiles TypeScript files with full support for project-specific `tsconfig.json`.
- **ESLint Integration:** Lints code during the build process with support for both flat and legacy ESLint configs.
- **Smart Partial Handling:** When SCSS partials change, only recompiles files that import them.
- **Optimized Output Structure:** TypeScript files in `source/ts/` are automatically placed in `public/js/`.
- **Reliable File Watching:** Multi-layered file monitoring system that works across various file systems, including mounted volumes.
- **Selective Rebuilds:** Only processes affected files when changes are detected.
- **Hot Module Reloading:** Integrates with `@n8d/ice-hotreloader` for live updates without full page refreshes.
- **Zero Configuration:** Works out-of-the-box with conventional project structures.
- **Advanced Import Detection:** Accurately detects which files import SCSS partials by parsing content.
- **Path Alias Support:** Resolves TypeScript path aliases defined in tsconfig.json.
- **Performance Caching:** Skips writing unchanged files for faster builds.
- **Custom Configuration:** Optional config file for advanced customization.

## Installation

Install the tool and its required peer dependencies in your project:

```bash
# Install ice-build and its required hot-reloader
npm install --save-dev @n8d/ice-build @n8d/ice-hotreloader

# Install other required peer dependencies (adjust versions as needed)
npm install --save-dev esbuild sass postcss autoprefixer

# Optional peer dependencies (if using linting or specific TS features)
# npm install --save-dev eslint typescript
```
```bash
# Using Yarn
yarn add --dev @n8d/ice-build @n8d/ice-hotreloader
yarn add --dev esbuild sass postcss autoprefixer
# yarn add --dev eslint typescript # Optional
```

**Required Peer Dependencies:**

* `@n8d/ice-hotreloader`: Used for communication during watch mode.
* `esbuild`: Core bundler.
* `sass`: Required by `esbuild-sass-plugin` for SCSS compilation.
* `postcss`: Required if PostCSS transformations (like autoprefixer) are used.
* `autoprefixer`: Required if PostCSS transformations are used.

**Optional Peer Dependencies:**

* `eslint`: If linting during the build is desired.
* `typescript`: If advanced TypeScript features or configuration loading from the host project are needed.

## Usage

Add scripts to your project's `package.json`:

```json
{
  "scripts": {
    "build": "ice-build",
    "watch": "ice-build --watch",
    "dev": "ice-build --watch --verbose"
  }
}
```

Then run the scripts:

```bash
# Run a single build
npm run build

# Run in watch mode
npm run watch

# Run with verbose output
npm run dev
```

## Project Structure

By default, `ice-build` works with the following directory structures:

```
your-project/
├── public/               # Output directory (configurable)
│   ├── css/              # CSS output
│   ├── js/               # JavaScript/TypeScript output 
├── source/ OR src/       # Source files (either name works)
│   ├── css/              # SCSS/SASS files
│   ├── styles/           # Alternative location for styles
│   ├── ts/               # TypeScript files (outputs directly to js/)
│   └── ...
├── ice-build.config.js   # Optional configuration file
├── tsconfig.json         # TypeScript configuration (optional)
└── package.json
```

The tool automatically detects whether your project uses a `source/` or `src/` directory and adapts accordingly.

## Custom Configuration

Create an `ice-build.config.js` file in your project root for advanced configuration:

```javascript
export default {
  // Source directory (default: auto-detected 'source' or 'src')
  sourceDir: 'source',
  
  // Output directory (default: 'public')
  outputDir: 'public',
  
  // HMR server port (default: 3001)
  port: 3001,
  
  // Sass options passed to esbuild-sass-plugin
  sassOptions: {
    includePaths: ['node_modules']
  },
  
  // PostCSS plugins (default: [autoprefixer])
  postcssPlugins: [
    require('autoprefixer'),
    require('cssnano')({ preset: 'default' })
  ],
  
  // Override TypeScript options (merges with tsconfig.json if present)
  typescriptOptions: {
    target: "es2020",
    module: "es2020"
  }
}
```

You can also use `.json` or `.mjs` file formats.

## TypeScript Configuration

Create a `tsconfig.json` file in your project root:

```json
{
  "compilerOptions": {
    "rootDir": "source/ts",
    "outDir": "public/js",
    "baseUrl": ".",
    "paths": {
      "@/*": ["source/*"],
    },
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": [
    "./source",
  ],
  "exclude": [
    "node_modules",
    "public"
  ]
}
```

ice-build will automatically detect and use your project's `tsconfig.json` settings, including:

- `target`: Determines the ECMAScript target version
- `module`: Sets the module format (ESM, CommonJS)
- `sourceMap`: Controls source map generation
- `paths`: Supports TypeScript path aliases
- Other relevant compiler options

If no `tsconfig.json` is found, sensible defaults are used.

## Command Line Options

* `--watch`: Enables watch mode with automatic rebuilds on file changes.
* `--verbose`: Shows detailed output during building and file watching.
* `--project <path>`: Specifies the root directory of the project to build (defaults to current working directory).
* `--no-lint`: Disables ESLint during the build process.
* `--help`: Shows help information and available commands.

## Advanced Features

### Enhanced SCSS Partial Handling

ice-build now intelligently detects SCSS imports by parsing file content:

- **Smart Parsing**: Detects @import, @use, and @forward statements with accurate path resolution
- **Selective Rebuilds**: When a partial changes, only rebuilds files that actually import it
- **Multiple Import Syntaxes**: Supports various import methods and path styles

### Path Alias Resolution

Automatically resolves TypeScript path aliases from tsconfig.json:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["source/*"],
      "@components/*": ["source/components/*"]
    }
  }
}
```

This allows you to use imports like:

```typescript
import { Button } from '@components/button';
```

### File Caching

Files are only rewritten when their content changes, improving build speed.

### Custom PostCSS Plugins

Add your own PostCSS plugins via configuration:

```javascript
export default {
  postcssPlugins: [
    require('autoprefixer'),
    require('cssnano')({ preset: 'default' }),
    require('postcss-preset-env')()
  ]
}
```

### TypeScript File Flattening

Files in `source/ts/` directory (including subdirectories) are automatically placed directly in the root of `public/js/`, creating a simplified output structure.

### Hot Module Reloading

When running in `--watch` mode:

1. ice-build automatically starts a WebSocket server on port 3001 (configurable)
2. When CSS changes, only stylesheets are refreshed (no page reload)
3. When TS/JS changes, the page receives a reload notification
4. Add this script tag to your HTML to enable HMR:

```html
<script src="http://localhost:3001/client.js"></script>
```

## Troubleshooting

If files aren't being watched correctly:

1. Use `--verbose` flag to see detailed file watching information
2. Check that your directory structure matches the expected structure
3. Try running with `--project=path/to/project` to explicitly set the project root
4. For mounted volumes or network drives, the system should automatically adapt its watching strategy
