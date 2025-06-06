(function() {
    const socketUrl = `ws://${location.hostname}:3001`;
    let socket: WebSocket;

    function connect() {
        socket = new WebSocket(socketUrl);

        socket.onopen = function() {
            console.log('HMR WebSocket connection established');
        };

        socket.onmessage = function(event) {
            const message = JSON.parse(event.data);
            if (message.type === 'css') {
                console.log(`HMR: CSS update received for ${message.path}`);
                refreshCSS(message.path);
            } else if (message.type === 'full') {
                console.log('HMR: Full reload triggered');
                location.reload();
            }
        };

        socket.onclose = function() {
            console.log('HMR WebSocket connection closed, retrying in 1 second...');
            setTimeout(connect, 1000);
        };

        socket.onerror = function(error) {
            console.error('HMR WebSocket error:', error);
            socket.close();
        };
    }

    function refreshCSS(path: string) {
        console.log(`[HMR] Refreshing CSS for path: ${path}`);
        
        // Query all stylesheets
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
        const timestamp = Date.now();
        
        if (stylesheets.length === 0) {
            console.warn('[HMR] No stylesheets found on page');
            return;
        }
        
        let updatedCount = 0;
        
        // First pass: check for direct matches
        stylesheets.forEach((stylesheet) => {
            const link = stylesheet as HTMLLinkElement;
            try {
                const url = new URL(link.href);
                
                // Only update stylesheets that actually match the path
                if (url.pathname.includes(path)) {
                    console.log(`[HMR] Direct match found: ${link.href}`);
                    
                    // Create cache-busted URL while preserving the original URL structure
                    const newUrl = new URL(link.href);
                    newUrl.searchParams.set('t', timestamp.toString());
                    link.href = newUrl.toString();
                    updatedCount++;
                }
            } catch (error) {
                console.error(`[HMR] Error processing stylesheet ${link.href}:`, error);
            }
        });
        
        // If no direct matches were found, try refreshing all stylesheets as fallback
        if (updatedCount === 0) {
            console.warn(`[HMR] No stylesheets found matching path: ${path}, refreshing ALL stylesheets as fallback`);
            
            stylesheets.forEach((stylesheet) => {
                const link = stylesheet as HTMLLinkElement;
                try {
                    console.log(`[HMR] Refreshing (fallback): ${link.href}`);
                    
                    // Create cache-busted URL for all stylesheets
                    const newUrl = new URL(link.href);
                    newUrl.searchParams.set('t', timestamp.toString());
                    link.href = newUrl.toString();
                    updatedCount++;
                } catch (error) {
                    console.error(`[HMR] Error refreshing stylesheet ${link.href}:`, error);
                }
            });
        }
        
        console.log(`[HMR] Refreshed ${updatedCount} stylesheet(s)`);
    }

    connect();
})();