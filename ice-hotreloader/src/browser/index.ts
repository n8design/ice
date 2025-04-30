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

        // Query all stylesheets that match the path
        const stylesheets = document.querySelectorAll(`link[rel="stylesheet"]`);
        console.debug('[HMR] Query:', `link[rel="stylesheet"]`);
        const timestamp = Date.now();

        if (stylesheets.length === 0) {
            console.warn('[HMR] No stylesheets found matching path:', path);
            return;
        }

        // Count how many are updated
        let updatedCount = 0;

        // Update each matching stylesheet
        stylesheets.forEach((stylesheet: Element) => {
            const link = stylesheet as HTMLLinkElement;
            const url = new URL(link.href);
            
            // Only update stylesheets that actually match the path
            if (url.pathname.includes(path)) {
                console.log(`[HMR] Refreshing: ${link.href}`);
                
                // Add or update the timestamp parameter
                url.searchParams.set('t', timestamp.toString());
                link.href = url.toString();
                updatedCount++;
            }
        });

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
