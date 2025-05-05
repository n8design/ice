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
*   **Dependency Visualization:** Exports SCSS dependency graphs in various formats for analysis and visualization.
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
    *   `--export-graph`: Export CSS dependency graph after build.
    *   `--graph-format <format>`: Specify graph output format (json, dot, nx, all). Default: json.
    *   `--graph-output <path>`: Specify output path for graph files.

*   **`ice-build watch`**: Starts the build process in watch mode with hot reloading.
    *   `--config <path>`: Specify a custom path to the configuration file. Defaults to `./ice.config.js`.
    *   `--verbose`: Enable verbose logging.

*   **`ice-build export-graph`**: Export the CSS dependency graph.
    *   `-f, --format <format>`: Output format (json, dot, nx, all). Default: json.
    *   `-o, --output <path>`: Output path for the graph files.

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
  // CSS dependency graph export options
  graph: {
    // format: 'json', // Output format: 'json', 'dot', 'nx', or 'all'
    // outputPath: './graphs' // Custom output path for graph files
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

## CSS Dependency Graph

Ice Build can generate a visual representation of your SCSS dependencies, helping you understand relationships between your stylesheets.

### Export Formats

- **JSON**: Simple format for programmatic use (`scss-dependency-graph.json`)
- **DOT**: Graphviz format for visual graph representation (`scss-dependency-graph.dot`)
- **NX**: Compatible with NX dependency visualization tools (`scss-dependency-graph-nx.json`)

### Visualizing the Graph

#### Using DOT Graph (Graphviz)

1. Install Graphviz:
   ```bash
   # macOS
   brew install graphviz
   
   # Ubuntu/Debian
   sudo apt-get install graphviz
   
   # Windows
   # Download from https://graphviz.org/download/
   ```

2. Generate a visual representation:
   ```bash
   # Generate an SVG
   dot -Tsvg public/graphs/scss-dependency-graph.dot -o scss-graph.svg
   
   # Generate a PNG
   dot -Tpng public/graphs/scss-dependency-graph.dot -o scss-graph.png
   ```

3. Online alternatives:
   - [Graphviz Online](https://dreampuf.github.io/GraphvizOnline/)
   - [Viz-js.com](http://viz-js.com/)
   - [Edotor.net](https://edotor.net/)

#### Using NX Format

1. Create a simple HTML viewer:
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>SCSS Dependency Graph</title>
     <script src="https://unpkg.com/d3@7"></script>
     <style>
       body { margin: 0; font-family: Arial; }
       svg { width: 100vw; height: 100vh; }
     </style>
   </head>
   <body>
     <script>
       // Load and render the NX graph file
       fetch('public/graphs/scss-dependency-graph-nx.json')
         .then(response => response.json())
         .then(data => {
           // Create a simple D3 force-directed graph
           // ... See documentation for implementation details
         });
     </script>
   </body>
   </html>
   ```

2. Or use with an NX workspace:
   ```bash
   npx nx graph --file=scss-dependency-graph-nx.json
   ```

### Example Workflow

```bash
# Export only the graph
npx ice-build export-graph

# Export in multiple formats
npx ice-build export-graph --format all

# Build and export graph in one step
npx ice-build build --export-graph
````
