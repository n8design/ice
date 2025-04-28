import { HotReloadServer } from '@n8d/ice-hotreloader';
import { getCurrentTime } from '../utils/console.js';

export function createHmrServer(port: number): HotReloadServer {
  // The constructor only accepts the port parameter
  const hmr = new HotReloadServer(port);
  console.log(`🔥 [${getCurrentTime()}] HMR running on port ${port}`);
  return hmr;
}

// Helper function for consistent messaging
export function formatHmrMessage(type: string, path: string): string {
  const filename = path.split('/').pop() || path;
  
  if (type === 'css') {
    return `Refresh CSS: ${filename}`;
  } else if (type === 'full') {
    return `Refresh code${filename ? ': ' + filename : ''}`;
  } else {
    return `Refresh ${type}: ${filename}`;
  }
}