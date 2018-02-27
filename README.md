# HTTP Fallback

[![Linux Build Status](https://img.shields.io/travis/ariofrio/http-fallback.svg?label=linux+build)](https://travis-ci.org/ariofrio/http-fallback)
[![Windows Build Status](https://img.shields.io/appveyor/ci/ariofrio/http-fallback.svg?label=windows+build)](https://ci.appveyor.com/project/ariofrio/http-fallback)
[![Maintainability](https://img.shields.io/codeclimate/maintainability/ariofrio/http-fallback.svg)](https://codeclimate.com/github/ariofrio/http-fallback/maintainability)
[![Test Coverage](https://img.shields.io/codeclimate/c/ariofrio/http-fallback.svg)](https://codeclimate.com/github/ariofrio/http-fallback/test_coverage)
[![NPM version](https://img.shields.io/npm/v/http-fallback.svg)](https://www.npmjs.com/package/http-fallback)
[![GitHub license](https://img.shields.io/github/license/ariofrio/http-fallback.svg)](https://github.com/ariofrio/http-fallback/blob/master/LICENSE)

This little library can be used to provide two TCP services on the same port, as long as one is HTTP and the other is anything but HTTP.

## Installation

```
npm install --save http-fallback
```

## Usage

```
const FallbackHttpServer = require('http-fallback');
const server = new FallbackHttpServer();

// You can also use Express, etc.
server.on('request', (req, res) => {
  response.writeHead(200, {'Content-Type': 'text/html'});
  res.end('<h1>Hello, World Wide Web!</h1>');
});

// On non-HTTP connections, act like a TCP echo service.
server.on('fallbackConnection', (socket) => {
  socket.on('data', (data) => {
    socket.write(data);
  });
  socket.on('end', () => socket.end());
});

// One port, two services!
server.listen(8000);

```

Also see [examples/bzfs-proxy.js](https://github.com/ariofrio/http-proxy/blob/master/examples/bzfs-proxy.js).

## API

### Class: FallbackHttpServer

This class inherits from [`http.Server`] (and forwards all constructor arguments). It has the following additional event:

#### Event: 'fallbackConnection'

- `socket` [`<net.Socket>`][`net.Socket`]

Emitted when the HTTP parser encounters an invalid HTTP request at the beginning of a connection. The socket connection is not managed anymore by [`http.Server`].

The first chunk of data, which the HTTP parser rejected, will be emitted as a [`'data'`] event on `socket` synchronously after this event is emitted.

This event will not be emitted after a valid HTTP request has been processed. Instead, [`'clientError'`] will be emitted or a 400 code will be sent to the client like a normal [`http.Server`].

## Limitations

This will work as long as your TCP service always begins by sending a string that is not an HTTP method name from the client to the server.

There is no way for the server side of your TCP service to begin communication because [`'fallbackConnection'`] is only emitted after the HTTP parser has received invalid data.

This will not work either if the beginning of the data sent by the client to the server can be mistaken as an HTTP request. If this occurs, all the normal HTTP events and behavior will be emitted and [`'fallbackConnection'`] will not be.

## Contributing

Just [submit an issue](https://github.com/ariofrio/http-fallback/issues) or, better yet, fork and [open a pull request](https://github.com/ariofrio/http-fallback/pulls).

Some unimplemented features that might pique your interest:

- [ ] Support for [`https.Server`].
- [ ] Support for [`readable.pipe()`].
- [ ] Support for [`'readable'`], and [`readable.read()`].


  [`http.Server`]: https://nodejs.org/docs/latest-v8.x/api/http.html#http_class_http_server
  [`https.Server`]: https://nodejs.org/docs/latest-v8.x/api/https.html#https_class_https_server
  [`net.Socket`]: https://nodejs.org/docs/latest-v8.x/api/net.html#net_class_net_socket

  [`readable.pipe()`]: https://nodejs.org/docs/latest-v8.x/api/stream.html#stream_readable_pipe_destination_options
  [`readable.read()`]: https://nodejs.org/docs/latest-v8.x/api/stream.html#stream_readable_read_size

  [`'clientError'`]: https://nodejs.org/docs/latest-v8.x/api/http.html#http_event_clienterror
  [`'data'`]: https://nodejs.org/docs/latest-v8.x/api/net.html#net_event_data
  [`'readable'`]: https://nodejs.org/docs/latest-v8.x/api/stream.html#stream_event_readable

  [`'fallbackConnection'`]: #event-fallbackconnection
