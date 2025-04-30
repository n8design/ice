import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';

// Helper function for getting the current time
function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString();
}

// Define and export your HotReloadServer class
export class HotReloadServer {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    private baseOutputDir: string = 'public'; // Default output directory
    
    constructor(port: number = 3001, options: { outputDir?: string } = {}) {
        if (options.outputDir) {
            this.baseOutputDir = options.outputDir.replace(/\\/g, '/').replace(/\/$/, '');
        }
        
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
                ws.close();
            });
        });
        
        server.listen(port);
        console.log(`🔥 [${getCurrentTime()}] HMR running on port ${port}`);
    }
    
    // Methods like notifyClients, etc.
    notifyClients(type: string, path: string) {
        // Normalize path for URLs: convert backslashes to forward slashes
        const normalizedPath = path.replace(/\\/g, '/');
        
        // Remove output directory prefix if it exists (configured dynamically)
        const outputDirPattern = new RegExp(`^${this.baseOutputDir}/`);
        const cleanPath = normalizedPath.replace(outputDirPattern, '');
        
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
                client.send(message);
            }
        });
    }
    
    // Allow updating the output directory
    setOutputDir(dir: string): void {
        this.baseOutputDir = dir.replace(/\\/g, '/').replace(/\/$/, '');
    }
}
