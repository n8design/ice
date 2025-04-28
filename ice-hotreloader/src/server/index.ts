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
    
    constructor(port: number = 3001) {
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
        const message = JSON.stringify({ type, path });
        
        // Get the filename from the path for more concise messaging
        const filename = path.split('/').pop() || path;
        
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
    
    // Other methods
}
