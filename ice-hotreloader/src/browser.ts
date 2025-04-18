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
        const stylesheets = document.querySelectorAll(`link[rel="stylesheet"][href*="${path}"]`);
        console.debug('[HMR] Query:', `link[rel="stylesheet"][href*="${path}"]`);
        const timestamp = Date.now();

        if (stylesheets.length === 0) {
            console.warn('[HMR] No stylesheets found matching path:', path);
            return;
        }

        // Update each matching stylesheet
        stylesheets.forEach((stylesheet: Element) => {
            const link = stylesheet as HTMLLinkElement;
            const url = link.href.split('?')[0];
            console.log(`[HMR] Refreshing: ${url}`);
            link.href = `${url}?t=${timestamp}`;
        });

        console.log(`[HMR] Refreshed ${stylesheets.length} stylesheet(s)`);
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
