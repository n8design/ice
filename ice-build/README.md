# Ice Build Tool

Ice Build is a modern, fast, and efficient build tool designed for TypeScript and SCSS projects. It leverages esbuild for TypeScript compilation and Dart Sass for SCSS compilation, providing a streamlined development experience with built-in watch mode and hot reloading capabilities.

![hTWOo Iced Logo](https://raw.githubusercontent.com/n8design/ice/refs/heads/main/assets/frozen-htwoo.webp)

## Features

*   **Fast Builds:** Utilizes esbuild and Dart Sass for rapid compilation.
*   **TypeScript Support:** Compiles TypeScript (`.ts`, `.tsx`) files efficiently.
*   **Modern SCSS:** Compiles SCSS/SASS (`.scss`, `.sass`) using the modern Dart Sass implementation.
*   **Watch Mode:** Monitors files for changes and automatically rebuilds.
*   **Hot Reloading:** Integrates with `@n8d/ice-hotreloader` for seamless CSS injection and page reloads.
*   **PostCSS Integration:** Includes Autoprefixer for CSS vendor prefixes.
*   **Configurable:** Uses an `ice.config.js` file for project-specific settings.

## Installation

```bash
npm install @n8d/ice-build --save-dev
# or
yarn add @n8d/ice-build --dev
```

## Usage

### CLI Commands

*   **`ice-build build`**: Compiles the project based on the configuration.
    *   `--config <path>`: Specify a custom path to the configuration file. Defaults to `./ice.config.js`.
    *   `--clean`: Clean the output directory before building.
    *   `--verbose`: Enable verbose logging.
*   **`ice-build watch`**: Starts the build process in watch mode with hot reloading.
    *   `--config <path>`: Specify a custom path to the configuration file. Defaults to `./ice.config.js`.
    *   `--verbose`: Enable verbose logging.

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

### Hot Reloading Client Script

Include this script in your main HTML file to enable hot reloading:

```html
<!-- ... other head elements ... -->
<script>
  const socket = new WebSocket('ws://localhost:8080'); // Use the port from your config

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    console.log('Hot Reload:', message);

    if (message.type === 'css_update') {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      links.forEach(link => {
        const url = new URL(link.href);
        // Check if the updated file matches the stylesheet's name
        if (url.pathname.includes(message.file)) {
          // Append a timestamp to force browser refresh
          url.searchParams.set('v', Date.now());
          link.href = url.toString();
          console.log(`Injected CSS update for: ${message.file}`);
        }
      });
    } else if (message.type === 'full_reload') {
      console.log('Performing full page reload.');
      window.location.reload();
    }
  });

  socket.addEventListener('open', () => {
    console.log('Hot Reload WebSocket connected.');
  });

  socket.addEventListener('close', () => {
    console.log('Hot Reload WebSocket disconnected. Attempting to reconnect...');
    // Optional: Implement reconnection logic
    setTimeout(() => {
      // Re-run the script or relevant connection part
    }, 5000);
  });

  socket.addEventListener('error', (error) => {
    console.error('Hot Reload WebSocket error:', error);
  });
</script>
<!-- ... rest of body ... -->
```

## Development

*   **Build:** `npm run build` or `yarn build`
*   **Watch:** `npm run watch` or `yarn watch`
*   **Lint:** `npm run lint` or `yarn lint`
*   **Test:** `npm test` or `yarn test` (Uses **vitest**)

## Contributing

Contributions are welcome! Please follow standard fork-and-pull-request workflow. Ensure tests pass and linting is clean before submitting pull requests.

## License

MIT
