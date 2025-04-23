import { HotReloadServer } from '@n8d/ice-hotreloader';

export function createHmrServer(port: number): HotReloadServer {
  const hmr = new HotReloadServer(port);
  console.log(`[${new Date().toLocaleTimeString()}] 🚀 HMR Server started on ws://localhost:${port}`);
  return hmr;
}