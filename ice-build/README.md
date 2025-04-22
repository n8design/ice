# Ice Build Tool

`@n8d/ice-build` is a command-line tool designed to simplify the build process for frontend projects. It integrates common tools like Sass, PostCSS (with Autoprefixer), esbuild (for JavaScript/TypeScript bundling), and ESLint.

![hTWOo Iced Logo](https://raw.githubusercontent.com/n8design/ice/refs/heads/main/assets/frozen-htwoo.webp)

## Features

- **Sass/SCSS Compilation:** Compiles `.scss` files to `.css`.
- **PostCSS Integration:** Applies PostCSS plugins, including Autoprefixer by default.
- **TypeScript Processing:** Compiles TypeScript files with full support for modern TS features.
- **ESLint Integration:** Lints code during the build process with support for both flat and legacy ESLint configs.
- **Reliable File Watching:** Multi-layered file monitoring system that works across various file systems.
- **Debounced Builds:** Prevents duplicate processing when multiple file changes are detected.
- **Hot Module Reloading:** Integrates with `@n8d/ice-hotreloader` for live updates without full page refreshes.
- **Zero Configuration:** Works out-of-the-box with conventional project structures.

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

By default, `ice-build` expects the following structure:

```
your-project/
├── public/             # Static assets and output directory
│   ├── css/            # CSS output
│   ├── js/             # JavaScript/TypeScript output
│   └── index.html      # Your main HTML file
├── source/             # Source files
│   ├── css/            # SCSS/SASS files
│   │   └── style.scss  # Main stylesheet
│   ├── ts/             # TypeScript files
│   │   └── index.ts    # Main entry point
│   └── index.html      # Template HTML
└── package.json
```

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

## Command Line Options

* `--watch`: Enables watch mode with automatic rebuilds on file changes.
* `--verbose`: Shows detailed output during building and file watching.
* `--project <path>`: Specifies the root directory of the project to build (defaults to current working directory).
* `--lint`: Enables ESLint during the build process.
* `--sourcemap`: Generates sourcemaps for JS and CSS files.
* `--production`: Creates a production build with minification.

## Advanced Features

### Reliable File Watching

ice-build implements a multi-layered file watching system that works reliably across:
- Local drives
- Network drives
- External volumes
- Virtual file systems

The system combines:
- Directory-based monitoring with chokidar
- File-specific watchers for critical files
- Native Node.js fs.watch as fallback

### ESLint Integration

ice-build automatically detects:
- Modern flat ESLint config (eslint.config.js)
- Legacy ESLint config (.eslintrc.js, .eslintrc.json, etc.)

Linting is performed automatically for TypeScript files and warnings/errors are reported in the console.

### Hot Module Reloading

When running in `--watch` mode:

1. ice-build automatically starts a WebSocket server on port 3001
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
4. If on network drives, ensure the polling interval is set appropriately
