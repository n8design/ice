# Ice Build Tool

`@n8d/ice-build` is a command-line tool designed to simplify the build process for frontend projects. It integrates common tools like Sass, PostCSS (with Autoprefixer), esbuild (for JavaScript/TypeScript bundling), and ESLint.

![hTWOo Iced Logo](https://raw.githubusercontent.com/n8design/ice/refs/heads/main/assets/frozen-htwoo.webp)

## Features

-   **Sass/SCSS Compilation:** Compiles `.scss` files to `.css`.
-   **PostCSS Integration:** Applies PostCSS plugins, including Autoprefixer by default.
-   **esbuild Bundling:** Bundles JavaScript and TypeScript files efficiently.
-   **ESLint Integration:** Lints code during the build process (optional).
-   **Watch Mode:** Monitors files for changes and triggers rebuilds, integrating with `@n8d/ice-hotreloader` for live updates.
-   **Simple Configuration:** Convention-over-configuration approach, typically looking for `source` and `public` directories.

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

*   `@n8d/ice-hotreloader`: Used for communication during watch mode.
*   `esbuild`: Core bundler.
*   `sass`: Required by `esbuild-sass-plugin` for SCSS compilation.
*   `postcss`: Required if PostCSS transformations (like autoprefixer) are used.
*   `autoprefixer`: Required if PostCSS transformations are used.

**Optional Peer Dependencies:**

*   `eslint`: If linting during the build is desired.
*   `typescript`: If advanced TypeScript features or configuration loading from the host project are needed.

## Usage

Add scripts to your project's `package.json`:

```json
{
  "scripts": {
    "build": "ice-build",
    "watch": "ice-build --watch"
  }
}
```

Then run the scripts:

```bash
# Run a single build
npm run build

# Run in watch mode
npm run watch
```

## Configuration (Default)

By default, `ice-build` expects the following structure:

```
your-project/
├── public/             # Static assets and output directory
│   └── index.html      # Your main HTML file
├── source/             # Source files
│   ├── index.ts        # Main JS/TS entry point
│   └── styles.scss     # Main SCSS entry point
└── package.json
```

-   It processes `source/index.ts` and outputs `public/dist/index.js`.
-   It processes `source/styles.scss` and outputs `public/dist/styles.css`.

## Command Line Options

*   `--watch`: Enables watch mode. Requires `@n8d/ice-hotreloader` to be running separately or integrated.
*   `--project <path>`: Specifies the root directory of the project to build (defaults to the current working directory).
*   `--lint`: Enables ESLint during the build (requires `eslint` peer dependency).
*   `--sourcemap`: Generates sourcemaps for JS and CSS.
*   `--production`: Creates a production build (e.g., enables minification).

## How it Works with Hot Reloader

When running in `--watch` mode:

1.  `ice-build` watches for file changes in the `source` directory.
2.  Upon detecting a change, it rebuilds the necessary assets (JS/CSS).
3.  After a successful rebuild, it attempts to send a message (e.g., `{ type: 'reloadPage' }` or `{ type: 'reloadCSS' }`) to a running `@n8d/ice-hotreloader` WebSocket server (typically expected on `ws://localhost:3001`).
4.  The hot reloader server broadcasts this message to connected browser clients.
5.  Client-side JavaScript (which you need to include in your `public/index.html`) listens for these messages and performs actions like `window.location.reload()` or dynamically updating stylesheets.
