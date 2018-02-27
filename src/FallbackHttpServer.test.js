const FallbackHttpServer = require('./FallbackHttpServer');
const net = require('net');
const http = require('http');

let server = null;
let port = null;
beforeEach((done) => {
  server = new FallbackHttpServer();
  server.listen(() => {
    port = server.address().port;
    done();
  });
});

const cleanup = {
  agents: [],
  sockets: [],
  requests: [],
}
afterEach((done) => {
  cleanup.agents.forEach((agent) => agent.destroy());
  cleanup.sockets.forEach((socket) => socket.destroy());
  cleanup.requests.forEach((request) => request.abort());
  cleanup.agents = [];
  cleanup.sockets = [];
  cleanup.requests = [];
  if (server)
    server.close((err) => {
      if (err) throw err;
      server = null;
      port = null;
      done();
    });
});

jest.setTimeout(500);

test('receives valid HTTP requests', (done) => {
  server.on('request', () => done());
  server.on('clientError', () => 
    done.fail('expected no client error event'));
  server.on('fallbackConnection', () =>
    done.fail('expected no fallback connection event'));

  const request = http.get({port, url: '/index.html'});
  request.on('error', (err) => {});
    // Will probably produce 'socket hang up' error because the server
    // produces no response, on purpose. We test responses in the next test.
  cleanup.requests.push(request);
});
test('responds to valid HTTP requests', (done) => {
  server.on('request', (req, res) => {
    res.end('Success');
  });
  server.on('clientError', () => 
    done.fail('expected no client error event'));
  server.on('fallbackConnection', () =>
    done.fail('expected no fallback connection event'));

  const request = http.get({port, url: '/index.html'}, (res) => {
    let data = Buffer.alloc(0);
    res.on('data', (chunk) =>
      data = Buffer.concat([data, chunk]));
    res.on('end', () => {
      expect(data.toString()).toEqual('Success');
      done();
    });
  });
  cleanup.requests.push(request);
});
test('does not fallback on invalid HTTP requests after an HTTP connection is established', (done) => {
  server.on('request', (req, res) => res.end());
  server.on('clientError', () => done());
  server.on('fallbackConnection', () =>
    done.fail('expected no fallback connection event'));

  const agent = new http.Agent({keepAlive: true});
  const request = http.get({agent, port, url: '/index.html'}, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      res.socket.write('BZFLAG\n\n');
    });
  });
  cleanup.agents.push(agent);
  cleanup.requests.push(request);
});

test('fallbacks on non-HTTP connections', (done) => {
  server.on('fallbackConnection', (s) => {
    s.destroy();
    done();
  });
  server.on('request', () =>
    done.fail('expected no HTTP request event'));
  server.on('clientError', () => 
    done.fail('expected no client error event'));

  const socket = net.createConnection(port, () => {
    socket.write('BZFLAG\n\n');
  });
  cleanup.sockets.push(socket);
});
test('receives the first data chunk of non-HTTP connections', (done) => {
  // i.e. it is not consumed by the HTTP parser and lost
  server.on('fallbackConnection', (socket) => {
    let data = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
      // Fail if at any point the data doesn't match.
      expect(data.toString()).toBeIncludedIn('BZFLAG\n\n', 0);
      // End when we have received all the data we expect.
      if (data.toString().indexOf('BZFLAG\n\n') === 0)
        done();
    });
    cleanup.sockets.push(socket);
  });
  server.on('request', () =>
    done.fail('expected no HTTP request event'));
  server.on('clientError', () => 
    done.fail('expected no client error event'));

  const socket = net.createConnection(port, () => {
    socket.write('BZFLAG\n\n');
  });
  cleanup.sockets.push(socket);
});

expect.extend({
  toBeIncludedIn(received, string, index = null) {
    const receivedIndex = string.indexOf(received);
    const pass = (index === null)
      ? receivedIndex !== -1
      : receivedIndex === index;
    // const atMessage = (index === null) ? '' : ` at index ${index}`;
    return {
      message: () =>
        this.utils.matcherHint(
          (this.isNot ? '.not' : '') + '.toBeIncludedIn',
          'received', 'string', 'index') +
        '\n\n' +
        `Expected string${this.isNot ? ' not' : ''} to be included inside of:\n` +
        `  ${this.utils.printExpected(string)}\n` +
        (index === null ? '' :
          `Expected index${this.isNot ? ' not to found at' : ''}: ` +
          `${this.utils.printExpected(index)}\n`) +
        `Received string:\n` +
        `  ${this.utils.printReceived(received)}`,
      pass,
    };
  }
});

////

/*
expect.extend({
  toEmitEvent(received, type) {
    return new Promise((resolve, reject) => {
      received.once('type', this.isNot
        ? reject(() => `expected ${received} to emit ${type}`)
        : resolve(() => `expected ${received} not to emit ${type}`));
    });
  }
});
expect.extend({
  toEmitEvent(received, type) {
    return new Promise((resolve) => {
      received.once('type', this.isNot ?
        resolve({
          message: () => `expected ${received} to emit ${type}`,
          pass: false,
        }) :
        resolve({
          message: () => `expected ${received} not to emit ${type}`,
          pass: true,
        }));
    });
  }
});
*/

