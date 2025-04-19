# Ice Tools

This repository contains the `ice` project, a monorepo managed with Nx, housing tools designed to streamline frontend development workflows, particularly focusing on build processes and hot reloading.

![hTWOo Iced Logo](./asset/frozen.htwoo.webp)

## Workspace Structure

This workspace includes the following primary packages:

-   **`ice-build`**: A command-line tool for building frontend projects. It handles Sass compilation, PostCSS processing (like autoprefixing), JavaScript/TypeScript bundling via esbuild, and ESLint integration. It also includes a watch mode.
    -   [Go to ice-build README](./ice-build/README.md)
-   **`ice-hotreloader`**: A lightweight WebSocket server designed to facilitate Hot Module Reloading (HMR) or live page reloading. It listens for messages from build tools (like `ice-build`) and broadcasts them to connected browser clients.
    -   [Go to ice-hotreloader README](./ice-hotreloader/README.md)

## How They Work Together

-   When `ice-build` runs in watch mode (`--watch`), it can optionally integrate with `ice-hotreloader`.
-   After `ice-build` successfully rebuilds assets (like CSS or JS) due to a file change, it sends a message to the running `ice-hotreloader` server.
-   `ice-hotreloader` then broadcasts this message to all connected browser clients.
-   Client-side JavaScript (listening to the WebSocket connection) interprets the message and performs the appropriate action, such as injecting updated CSS without a full page refresh or triggering a full page reload.

## Getting Started

### Prerequisites

-   Node.js (Check `.nvmrc` or `package.json` engines for version)
-   npm (or Yarn/pnpm)

### Installation

Clone the repository and install dependencies from the root directory:

```bash
git clone https://github.com/n8design/ice.git
cd ice
npm install
```

### Building Packages

You can build individual packages or all packages using Nx commands or npm scripts defined in the root `package.json`:

```bash
# Build ice-build
nx build ice-build
# or potentially: npm run build:ice-build

# Build ice-hotreloader
nx build ice-hotreloader
# or potentially: npm run build:ice-hotreloader

# Build all packages (if configured)
# nx run-many --target=build --all
# or potentially: npm run build:all
```

### Development

Refer to the individual package READMEs for specific development workflows, such as running tests or watch modes.

### Releasing

This repository uses Nx for release management, including version bumping, changelog generation, and Git tagging. Release scripts are defined in the root `package.json`:

```bash
# Example: Create a new alpha release for ice-build
npm run release:alpha:ice-build

# Example: Create a new alpha release for ice-hotreloader
npm run release:alpha:ice-hotreloader
```

These scripts handle the version bump, changelog update, commit, tag, and push operations for the specified package.
