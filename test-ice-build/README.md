# Ice Build Tool

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
