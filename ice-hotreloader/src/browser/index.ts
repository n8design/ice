import { createCacheBustedUrl } from '../utils/path-utils.js';
import { HotReloaderOptions, mergeWithDefaults } from '../utils/config.js';

class BrowserHMR {
    private ws: WebSocket | null = null;
    private options: Required<HotReloaderOptions>;
    private reconnectTimer: NodeJS.Timeout | null = null;

    constructor(portOrOptions: number | HotReloaderOptions = {}) {
        // Handle both new and legacy constructor formats
        let options: HotReloaderOptions = {};
        
        if (typeof portOrOptions === 'number') {
            options = { port: portOrOptions };
        } else {
            options = portOrOptions;
        }
        
        this.options = mergeWithDefaults(options);
        this.connect();
    }

    private connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.hostname}:${this.options.port}`;

        console.log('[HMR] Connecting to:', wsUrl);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.addEventListener('open', () => {
                console.log('[HMR] Connection established');
            });

            this.ws.addEventListener('message', (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (this.options.debug) {
                        console.log('[HMR] Received message:', message);
                    }

                    switch (message.type) {
                        case 'css':
                            this.refreshCSS(message.path);
                            break;
                        case 'full':
                            location.reload();
                            break;
                        default:
                            console.warn(`[HMR] Unknown message type: ${message.type}`);
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
                try {
                    this.ws?.close();
                } catch (closeError) {
                    console.error('[HMR] Error closing connection:', closeError);
                }
            });
        } catch (error) {
            console.error('[HMR] Error establishing connection:', error);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }

    private refreshCSS(path: string) {
        if (this.options.debug) {
            console.log('[HMR] Refreshing CSS for path:', path);
        }

        // Query all stylesheets
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        const timestamp = Date.now();

        if (stylesheets.length === 0) {
            console.warn('[HMR] No stylesheets found on page');
            return;
        }

        // Count how many are updated
        let updatedCount = 0;

        // First pass: check for direct matches
        stylesheets.forEach((stylesheet: Element) => {
            const link = stylesheet as HTMLLinkElement;
            try {
                const url = new URL(link.href);
                
                // Only update stylesheets that actually match the path
                if (url.pathname.includes(path)) {
                    if (this.options.debug) {
                        console.log(`[HMR] Direct match found: ${link.href}`);
                    }
                    
                    // Add or update the timestamp parameter using our utility
                    link.href = createCacheBustedUrl(link.href, timestamp).toString();
                    updatedCount++;
                }
            } catch (error) {
                console.error(`[HMR] Error processing stylesheet ${link.href}:`, error);
            }
        });

        // If no direct matches were found and the fallback option is enabled,
        // refresh all stylesheets
        if (updatedCount === 0 && this.options.refreshAllStylesheetsOnNoMatch) {
            console.warn(`[HMR] No stylesheets found matching path: ${path}, refreshing ALL stylesheets as fallback`);
            
            // Reset the counter for the fallback approach
            updatedCount = 0;
            
            stylesheets.forEach((stylesheet: Element) => {
                const link = stylesheet as HTMLLinkElement;
                try {
                    if (this.options.debug) {
                        console.log(`[HMR] Refreshing (fallback): ${link.href}`);
                    }
                    
                    // Add or update the timestamp parameter for all stylesheets
                    link.href = createCacheBustedUrl(link.href, timestamp).toString();
                    updatedCount++;
                } catch (error) {
                    console.error(`[HMR] Error refreshing stylesheet ${link.href}:`, error);
                }
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
