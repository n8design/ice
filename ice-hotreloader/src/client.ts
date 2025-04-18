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
                const link = document.querySelector(`link[href*="${message.path}"]`) as HTMLLinkElement;
                if (link) {
                    const newLink = link.cloneNode() as HTMLLinkElement;
                    newLink.href = `${message.path}?t=${new Date().getTime()}`;
                    link.parentNode?.insertBefore(newLink, link.nextSibling);
                    link.remove();
                }
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

    connect();
})();