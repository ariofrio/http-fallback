// bzfs-proxy
//
// A hybrid web server and proxy for bzfs, the server for the venerable BZFlag
// game.
//
// This was written as a proof of concept for an (unimplemented)
// WebSockets/WebRTC proxy running on the same port as a regular TCP/UDP
// proxy, in an attempt to make compatibility with an (work-in-progress)
// Emscripten-based web client require as little reconfiguration on the server
// as possible.
//
// Start bzfs (or just use a server from [the public listing]), then run:
//
//   node bzfs-proxy localhost 8000 <bzfs-address> <bzfs-port>
//
// Now connect to 127.0.0.1:8000 using the bzflag client. It works!
//
// Now visit http://localhost:8000/ on your web browser. Golly, it works!
//
//   [the public listing]: http://my.bzflag.org/db/ "Click on Post entry"
//
// Note: Currently this is causing jitter warnings when proxying to a public
// server, even with `debug` console output disabled. Otherwise it seems to
// work fine. (Tested by running bzfs on Windows, bzfs-proxy on WSL, and
// connecting to bzfs-proxy with the bzflag client on Windows.)
//

const assert = require('assert');
const dgram = require('dgram');
const net = require('net');

const FallbackHttpServer = require('../src/FallbackHttpServer');

assert(process.argv.length === 6);
const source = { // bzfs-proxy (this file)
  host: process.argv[2],
  port: process.argv[3],
};
const target = { // bzfs
  host: process.argv[4],
  port: process.argv[5],
};

// TCP

const tcpServer = new FallbackHttpServer();
tcpServer.on('fallbackConnection', (clientSocket) => {
  const tcpClient = {
    port: clientSocket.remotePort,
    host: clientSocket.remoteAddress,
  };
  const debug = (...args) => {};
  // const debug = (...args) =>
  //   console.log(tcpClient.port, ...args);

  debug('tcp client connection');
  const targetSocket = net.createConnection(target);

  clientSocket.on('error', (err) => console.error('tcp client socket', err));
  targetSocket.on('error', (err) => console.error('tcp target socket', err));

  targetSocket.on('data', (data) => {
    debug('tcp target', data);
    clientSocket.write(data);
  });
  let dataForTarget = [];
  clientSocket.on('data', (data) => {
    debug('tcp client', data);
    if (targetSocket.connecting)
      return dataForTarget.push(data);
    targetSocket.write(data);
  });
  targetSocket.once('connect', () => {
    dataForTarget.forEach((data) =>
      targetSocket.write(data));
    dataForTarget = [];
  });

  targetSocket.on('end', () => {
    debug('tcp target end');
    clientSocket.end();
  });
  clientSocket.on('end', () => {
    debug('tcp client end');
    targetSocket.end();
  });

  // UDP

  const udpTargetSocket = dgram.createSocket({type: 'udp4'});
  udpTargetSocket.on('error', (err) => console.error('udp target socket', err));
  udpTargetSocket.on('message', (msg) => {
    debug('udp target', msg);
    udpClientSocket.send(msg, tcpClient.port, tcpClient.host);
  });
  udpClientSocket.on('message', (msg, udpClient) => {
    if (udpClient.port === tcpClient.port && udpClient.address === tcpClient.host) {
      debug('udp client', msg);
      udpTargetSocket.send(msg, target.port, target.host);
    }
  });

  // The port is not actually checked by bzfs. This gives any rogue web client
  // the ability to spoof as a different web user, since they all have the
  // same address from the point of view of bzfs. We should probably check the
  // port, not just the address, in bzfs in NetHandler::udpReceive.
  targetSocket.on('connect', () =>
    udpTargetSocket.bind(targetSocket.localPort, targetSocket.localAddress));
});

// HTTP

tcpServer.on('request', (request, response) => {
  console.log('http request', request.method, request.url);
  response.writeHead(200, {'Content-Type': 'text/html'});
  response.end('<h1>Hello, World Wide Web</h1>');
});

//// Listen & Bind

tcpServer.listen(source);

const udpClientSocket = dgram.createSocket({type: 'udp4'});
udpClientSocket.on('error', (err) => console.error('udp client socket', err));
udpClientSocket.bind({
  port: source.port,
  address: source.host,
  exclusive: false,
});

/**************************************

NOTES FOR POSSIBLE FUTURE WEBSOCKETS/WEBRTC PROXY:

WebSockets:

- https://dimitrisfousteris.wordpress.com/2014/12/07/websocket-udp-proxy-with-node-js/
- https://github.com/mittorn/websockify-c/tree/udp
- https://github.com/novnc/websockify
- https://github.com/novnc/websockify/blob/master/other/js/websockify.js

WebRTC:

- https://github.com/feross/simple-peer.

      new Peer({
        channelConfig: {
          // Mimic UDP semantics.
          // https://www.html5rocks.com/en/tutorials/webrtc/datachannels/#just-show-me-the-action
          ordered: false,
          maxRetransmits: 0,
        }
      });

***************************************/
