class BrowserHMR {
    private ws: WebSocket | null = null;
    private port: number;
    private reconnectTimer: NodeJS.Timeout | null = null;

    constructor(port: number = 3001) {
        this.port = port;
        this.connect();
    }

    private connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.hostname}:${this.port}`;

        console.log('[HMR] Connecting to:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.addEventListener('open', () => {
            console.log('[HMR] Connection established');
        });

        this.ws.addEventListener('message', (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('[HMR] Received message:', message);

                switch (message.type) {
                    case 'css':
                        this.refreshCSS(message.path);
                        break;
                    case 'full':
                        location.reload();
                        break;
                }
            } catch (e) {
                console.error('[HMR] Failed to parse message:', e);
            }
        });

        this.ws.addEventListener('close', () => {
            console.log('[HMR] Connection closed. Retrying in 5s...');
            this.scheduleReconnect();
        });

        this.ws.addEventListener('error', (error) => {
            console.error('[HMR] Connection error:', error);
            this.ws?.close();
        });
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }

    private refreshCSS(path: string) {
        console.log('[HMR] Refreshing CSS for path:', path);

        // Query all stylesheets
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        const timestamp = Date.now();
        
        // Check if there are any stylesheets at all
        if (stylesheets.length === 0) {
            console.warn('[HMR] No stylesheets found on page');
            return;
        }
        
        // Try to find specific stylesheet matches first
        let updatedCount = 0;
        let foundMatch = false;

        // First pass: check for direct matches
        stylesheets.forEach((stylesheet: Element) => {
            const link = stylesheet as HTMLLinkElement;
            const url = new URL(link.href);
            
            // Only update stylesheets that match the path
            if (url.pathname.includes(path)) {
                console.log(`[HMR] Direct match found: ${link.href}`);
                
                // Add or update the timestamp parameter
                url.searchParams.set('t', timestamp.toString());
                link.href = url.toString();
                updatedCount++;
                foundMatch = true;
            }
        });

        // If no direct matches were found, refresh all stylesheets as fallback
        if (!foundMatch) {
            console.warn(`[HMR] No stylesheets found matching path: ${path}, refreshing ALL stylesheets as fallback`);
            
            // Reset the counter for the fallback approach
            updatedCount = 0;
            
            stylesheets.forEach((stylesheet: Element) => {
                const link = stylesheet as HTMLLinkElement;
                const url = new URL(link.href);
                
                console.log(`[HMR] Refreshing (fallback): ${link.href}`);
                
                // Add or update the timestamp parameter for all stylesheets
                url.searchParams.set('t', timestamp.toString());
                link.href = url.toString();
                updatedCount++;
            });
        }

        console.log(`[HMR] Refreshed ${updatedCount} stylesheet(s)`);
    }
}

// Initialize HMR when DOM is loaded
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        console.debug('[HMR] DOMContentLoaded');
        new BrowserHMR();
    });
}

export { BrowserHMR };
