import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { normalizePath, removeOutputDirPrefix } from '../utils/path-utils.js';
import { HotReloaderOptions, mergeWithDefaults } from '../utils/config.js';

// Helper function for getting the current time
function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString();
}

// Define and export your HotReloadServer class
export class HotReloadServer {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    private options: Required<HotReloaderOptions>;
    
    constructor(portOrOptions: number | HotReloaderOptions = {}, legacyOptions: HotReloaderOptions = {}) {
        // Handle both new and legacy constructor formats
        let options: HotReloaderOptions = {};
        
        if (typeof portOrOptions === 'number') {
            // Legacy format: port, { outputDir }
            options = { 
                port: portOrOptions,
                ...legacyOptions
            };
        } else {
            // New format: { port, outputDir, ... }
            options = portOrOptions;
        }
        
        this.options = mergeWithDefaults(options);
        
        const server = createServer();
        this.wss = new WebSocketServer({ server });
        
        this.wss.on('connection', (ws) => {
            console.log(`🔥 [${getCurrentTime()}] Connected client`);
            this.clients.add(ws);
            
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`🔥 [${getCurrentTime()}] Client disconnected`);
            });

            ws.on('error', (error) => {
                console.error(`🔥 [${getCurrentTime()}] Client error:`, error);
                try {
                    ws.close();
                } catch (closeError) {
                    console.error(`🔥 [${getCurrentTime()}] Error closing connection:`, closeError);
                }
            });
        });
        
        server.listen(this.options.port);
        console.log(`🔥 [${getCurrentTime()}] HMR running on port ${this.options.port}`);
    }
    
    notifyClients(type: string, path: string) {
        // Normalize and clean path using utility functions
        const normalizedPath = normalizePath(path);
        const cleanPath = removeOutputDirPrefix(normalizedPath, this.options.outputDir);
        
        try {
            const message = JSON.stringify({ type, path: cleanPath });
            
            // Get the filename from the path for more concise messaging
            const filename = cleanPath.split('/').pop() || cleanPath;
            
            if (type === 'css') {
                console.log(`🔥 [${getCurrentTime()}] 📤 Refresh CSS: ${filename}`);
            } else if (type === 'full') {
                console.log(`🔥 [${getCurrentTime()}] 📤 Refresh code${filename ? ': ' + filename : ''}`);
            } else {
                console.log(`🔥 [${getCurrentTime()}] 📤 Refresh ${type}: ${filename}`);
            }
            
            this.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    try {
                        client.send(message);
                    } catch (error) {
                        console.error(`🔥 [${getCurrentTime()}] Failed to send message to client:`, error);
                    }
                }
            });
        } catch (error) {
            console.error(`🔥 [${getCurrentTime()}] Error creating notification:`, error);
        }
    }
    
    // Legacy method for backward compatibility
    setOutputDir(dir: string): void {
        // Make sure we properly normalize the path
        this.options.outputDir = normalizePath(dir);
    }
}
