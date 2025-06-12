import { HotReloaderOptions } from '../utils/config.js';

class BrowserHMR {
    private ws: WebSocket | null = null;
    private port: number;
    private host: string;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private refreshAllStylesheetsOnNoMatch: boolean;

    constructor(portOrOptions: number | HotReloaderOptions = 3001) {
        // Handle both number (legacy) and options object (new)
        if (typeof portOrOptions === 'number') {
            this.port = portOrOptions;
            this.host = 'localhost';
            this.refreshAllStylesheetsOnNoMatch = true;
        } else {
            this.port = portOrOptions.port || 3001;
            this.host = portOrOptions.host || 'localhost';
            this.refreshAllStylesheetsOnNoMatch = portOrOptions.refreshAllStylesheetsOnNoMatch ?? true;
        }
        this.connect();
    }

    private connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${this.host}:${this.port}`;

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
            } catch (error: unknown) {
                console.error('[HMR] Failed to parse message:', error);
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

        // Create multiple path variations to try matching against
        const pathVariations = this.generatePathVariations(path);
        console.debug('[HMR] Path variations to try:', pathVariations);

        // Query all stylesheets
        const allStylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        
        // Filter to find matching stylesheets using multiple strategies
        const matchingStylesheets = Array.from(allStylesheets).filter((stylesheet: Element) => {
            const link = stylesheet as HTMLLinkElement;
            return this.doesStylesheetMatch(link.href, pathVariations);
        });
        
        const timestamp = Date.now();

        if (matchingStylesheets.length === 0) {
            console.warn('[HMR] No stylesheets found matching path:', path);
            console.warn('[HMR] Available stylesheets:', Array.from(allStylesheets).map(s => (s as HTMLLinkElement).href));
            
            // If no matching stylesheets found and fallback is enabled, refresh all
            if (this.refreshAllStylesheetsOnNoMatch) {
                console.warn('[HMR] Refreshing all stylesheets as fallback');
                const allStylesheets = document.querySelectorAll('link[rel="stylesheet"]');
                allStylesheets.forEach((stylesheet: Element) => {
                    const link = stylesheet as HTMLLinkElement;
                    try {
                        const url = new URL(link.href);
                        url.searchParams.set('t', timestamp.toString());
                        link.href = url.toString();
                    } catch {
                        // Fallback if URL constructor fails
                        const baseUrl = link.href.split('?')[0];
                        link.href = `${baseUrl}?t=${timestamp}`;
                    }
                });
                console.log(`[HMR] Refreshed ${allStylesheets.length} stylesheet(s) as fallback`);
            }
            return;
        }

        // Update each matching stylesheet
        matchingStylesheets.forEach((stylesheet: Element) => {
            const link = stylesheet as HTMLLinkElement;
            console.log(`[HMR] Refreshing: ${link.href}`);
            
            try {
                // Use URL constructor to preserve existing query parameters
                const url = new URL(link.href);
                url.searchParams.set('t', timestamp.toString());
                link.href = url.toString();
            } catch {
                // Fallback if URL constructor fails
                const baseUrl = link.href.split('?')[0];
                link.href = `${baseUrl}?t=${timestamp}`;
            }
        });

        console.log(`[HMR] Refreshed ${matchingStylesheets.length} stylesheet(s)`);
    }

    /**
     * Generate multiple path variations to improve matching chances
     */
    private generatePathVariations(path: string): string[] {
        const variations = new Set<string>();
        
        // Original path
        variations.add(path);
        
        // Remove leading slash if present
        if (path.startsWith('/')) {
            variations.add(path.substring(1));
        } else {
            // Add leading slash
            variations.add('/' + path);
        }
        
        // Extract just the filename
        const filename = path.split('/').pop();
        if (filename && filename !== path) {
            variations.add(filename);
        }
        
        // If path contains directories, try without the first directory
        const pathParts = path.split('/');
        if (pathParts.length > 1) {
            variations.add(pathParts.slice(1).join('/'));
        }
        
        return Array.from(variations);
    }

    /**
     * Check if a stylesheet href matches any of the path variations
     */
    private doesStylesheetMatch(href: string, pathVariations: string[]): boolean {
        try {
            const url = new URL(href);
            const pathname = url.pathname;
            
            // Try exact matches against different parts of the URL
            for (const variation of pathVariations) {
                // Check if href contains the variation
                if (href.includes(variation)) {
                    console.debug(`[HMR] Exact match: ${href} contains ${variation}`);
                    return true;
                }
                
                // Check if pathname contains the variation
                if (pathname.includes(variation)) {
                    console.debug(`[HMR] Pathname match: ${pathname} contains ${variation}`);
                    return true;
                }
                
                // Check if pathname ends with the variation
                if (pathname.endsWith(variation)) {
                    console.debug(`[HMR] Pathname ends with: ${pathname} ends with ${variation}`);
                    return true;
                }
            }
        } catch {
            // Fallback for relative URLs or malformed URLs
            for (const variation of pathVariations) {
                if (href.includes(variation)) {
                    console.debug(`[HMR] Fallback match: ${href} contains ${variation}`);
                    return true;
                }
            }
        }
        
        return false;
    }
}

// Extend window interface to avoid any types
interface WindowWithHMR extends Window {
    ICE_HOTRELOAD_CONFIG?: { port?: number; host?: string };
}

// Initialize HMR when DOM is loaded
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        console.debug('[HMR] DOMContentLoaded');
        // Check for global config, use port from config or default to 3001
        const globalConfig = (window as WindowWithHMR).ICE_HOTRELOAD_CONFIG;
        const port = globalConfig?.port || 3001;
        new BrowserHMR(port);
    });
}

export { BrowserHMR };
