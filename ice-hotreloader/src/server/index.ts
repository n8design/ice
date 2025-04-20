import { createServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';

// Define and export your HotReloadServer class
export class HotReloadServer {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    
    constructor(port: number = 3001) {
        const server = createServer();
        this.wss = new WebSocketServer({ server });
        
        this.wss.on('connection', (ws) => {
            console.log(`[${new Date().toLocaleTimeString()}] 🟢 HMR Client connected`);
            this.clients.add(ws);
            
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`[${new Date().toLocaleTimeString()}] 🔴 HMR Client disconnected`);
            });

            ws.on('error', (error) => {
                console.error(`[${new Date().toLocaleTimeString()}] 🔴 HMR Client error:`, error);
                ws.close();
            });
        });
        
        server.listen(port);
        console.log(`[${new Date().toLocaleTimeString()}] 🚀 HMR Server started on ws://localhost:${port}`);
    }
    
    // Methods like notifyClients, etc.
    notifyClients(type: string, path: string) {
        const message = JSON.stringify({ type, path });
        console.log(`[${new Date().toLocaleTimeString()}] 📤 Sending message: ${message}`);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    
    // Other methods
}// Test comment for changelog
// Another test comment
// Final test comment
// Final test comment
