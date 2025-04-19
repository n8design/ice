# Ice Hot Reloader

`@n8d/ice-hotreloader` provides a lightweight WebSocket server designed to facilitate Hot Module Reloading (HMR) or live reloading for frontend development environments. It works in conjunction with build tools like `@n8d/ice-build` or other systems that can trigger reload messages.

![hTWOo Iced Logo](./asset/frozen.htwoo.webp)

## Overview

This utility offers a simple way to push updates to connected browser clients when source files change:

-   **WebSocket Server:** Starts a basic WebSocket server on a specified port.
-   **Client Broadcasting:** Provides methods to send messages (e.g., "reload", "updateCSS") to all connected clients.
-   **Integration:** Designed to be integrated into build pipelines or watch processes that detect file changes.

## Installation

Install the package as a development dependency:

```bash
npm install --save-dev @n8d/ice-hotreloader
# or
yarn add --dev @n8d/ice-hotreloader
```

It typically requires a WebSocket implementation like `ws`:

```bash
npm install --save-dev ws
# or
yarn add --dev ws
```

## Usage

The primary way to use this package is programmatically within a build script or watch process.

**Example Integration (Conceptual):**

```javascript
import { HotReloadServer } from '@n8d/ice-hotreloader';
import chokidar from 'chokidar'; // Example file watcher

// Initialize the HMR server (e.g., on port 3001)
const hmrServer = new HotReloadServer(3001);
console.log(`Hot Reload Server listening on port ${hmrServer.port}`);

// Example: Watch for CSS file changes
chokidar.watch('path/to/your/css/**/*.css').on('change', (filePath) => {
  console.log(`CSS file changed: ${filePath}. Sending reload signal.`);
  // Send a message to clients to reload CSS or the whole page
  hmrServer.broadcast({ type: 'reloadCSS', path: filePath });
  // Or for a full page reload:
  // hmrServer.broadcast({ type: 'reloadPage' });
});

// Example: Watch for JS file changes
chokidar.watch('path/to/your/js/**/*.js').on('change', (filePath) => {
  console.log(`JS file changed: ${filePath}. Sending reload signal.`);
  // Send a message to clients to reload the page
  hmrServer.broadcast({ type: 'reloadPage' });
});

// Client-side JavaScript would need to connect to ws://localhost:3001
// and listen for these message types to perform the appropriate action.
```

## API

### `new HotReloadServer(port: number)`

Creates and starts a new WebSocket server instance on the given `port`.

### `hmrServer.broadcast(message: object)`

Sends the `message` object (serialized as JSON) to all currently connected WebSocket clients.

### `hmrServer.port`

Returns the port number the server is listening on.

### `hmrServer.close()`

Closes the WebSocket server and disconnects all clients.

## Client-Side Implementation

You need corresponding client-side JavaScript to connect to the WebSocket server and handle the messages sent by `broadcast`. A simple example:

```javascript
const socket = new WebSocket('ws://localhost:3001'); // Use the correct port

socket.addEventListener('open', (event) => {
  console.log('Connected to Hot Reload server.');
});

socket.addEventListener('message', (event) => {
  try {
    const message = JSON.parse(event.data);
    console.log('HMR message received:', message);

    if (message.type === 'reloadPage') {
      console.log('Reloading page...');
      window.location.reload();
    } else if (message.type === 'reloadCSS') {
      console.log('Reloading CSS...');
      // Logic to find and reload the specific stylesheet or all stylesheets
      // Example: Find link tags and append a timestamp to the href
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const url = new URL(link.href);
        url.searchParams.set('_', Date.now());
        link.href = url.toString();
      });
    }
    // Add handlers for other message types as needed
  } catch (e) {
    console.error('Failed to parse HMR message:', e);
  }
});

socket.addEventListener('close', (event) => {
  console.log('Disconnected from Hot Reload server.');
});

socket.addEventListener('error', (event) => {
  console.error('WebSocket error:', event);
});