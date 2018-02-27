const http = require('http');

// TODO: Make compatible with https.Server, probably by making it a simple
// function addFallbackToHttpServer().
class FallbackHttpServer extends http.Server {
  constructor(...args) {
    super(...args);

    // The idea is to only fallback when an parsing error occurs on new
    // connections. If an HTTP connection is already established (i.e. it has
    // already produced a request or an upgrade), a parsing error will produce
    // the default action of closing the connection.
    this.httpConnectedSockets = new WeakSet();
    this.on('request', (request) => {
      this.httpConnectedSockets.add(request.socket);
    })

    // Let the default implementation close connections that receive an
    // upgrade header if the event is not being listened for.
    // https://nodejs.org/api/http.html#http_event_upgrade
    if (this.listenerCount('upgrade') > 0) {
      this.on('upgrade', (_, socket) => {
        this.httpConnectedSockets.add(socket);
      });
    }

    // When an invalid HTTP request is made.
    this.on('clientError', this.onClientError);

    // We will decide whether or not a clientError gets passed down to our
    // users: only when no fallback has ocurred.
    this.on = (type, ...args) => {
      if (type === 'clientError')
        super.on('noFallbackClientError', ...args);
      else
        super.on(type, ...args);
    }
  }

  onClientError(err, socket) {
    if (!this.httpConnectedSockets.has(socket) &&
        this.listenerCount('fallbackConnection') > 0) {
      // Fallback! But first clean up the socket.
      // https://github.com/nodejs/node/blob/master/lib/_http_server.js#L503
      socket.removeAllListeners('data');
      socket.removeAllListeners('end');
      socket.removeAllListeners('close');
      socket.removeAllListeners('drain');
      socket.removeAllListeners('error');

      // Now fallback.
      this.emit('fallbackConnection', socket);
      socket.emit('data', socket.parser.getCurrentBuffer());
      return;
    }

    // Let the user handle clientError if they wish.
    // https://nodejs.org/api/http.html#http_event_clienterror
    if (!this.emit('noFallbackClientError', err, socket)) {
      // If the user didn't handle it, perform the default action.
      // https://github.com/nodejs/node/blob/master/lib/_http_server.js#L489
      if (socket.writable)
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      else
        socket.destroy(err);
    }
  }
}

module.exports = FallbackHttpServer;
