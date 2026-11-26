'use strict';

/**
 * Simple REST API service in plain Node.js (zero dependencies).
 *
 * The same four endpoints exist in the Rust service (rust-service/),
 * so the benchmark compares the runtimes, not the feature sets.
 *
 * Endpoints:
 *   GET  /health          -> { "status": "ok" }
 *   GET  /json            -> a fixed JSON payload (~1 KB)
 *   GET  /compute?n=30    -> { "n": 30, "fib": 832040 }  (CPU-bound)
 *   POST /echo            -> returns the request body unchanged
 */

const http = require('node:http');

const PORT = process.env.PORT || 3000;

/** Iterative Fibonacci: fast, deterministic, and safe for large n. */
function fib(n) {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i += 1) {
    [a, b] = [b, a + b];
  }
  return a;
}

/** Fixed ~1 KB payload, built once at startup. */
const JSON_PAYLOAD = JSON.stringify({
  service: 'node',
  items: Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: `item-${i + 1}`,
    price: Math.round((i + 1) * 9.99 * 100) / 100,
    inStock: i % 2 === 0,
  })),
});

function sendJson(res, status, body) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Tiny route table: keeps request handling flat and explicit. */
const routes = {
  'GET /health': (req, res) => sendJson(res, 200, { status: 'ok' }),

  'GET /json': (req, res) => sendJson(res, 200, JSON_PAYLOAD),

  'GET /compute': (req, res, url) => {
    const n = Number.parseInt(url.searchParams.get('n') || '30', 10);
    if (!Number.isInteger(n) || n < 0 || n > 90) {
      return sendJson(res, 400, { error: 'n must be an integer between 0 and 90' });
    }
    return sendJson(res, 200, { n, fib: fib(n) });
  },
};

function handlePostEcho(req, res) {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    res.writeHead(200, {
      'Content-Type': req.headers['content-type'] || 'application/octet-stream',
      'Content-Length': body.length,
    });
    res.end(body);
  });
}

function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/echo') {
    return handlePostEcho(req, res);
  }

  const route = routes[`${req.method} ${url.pathname}`];
  if (!route) {
    return sendJson(res, 404, { error: 'not found' });
  }
  return route(req, res, url);
}

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Node service listening on http://localhost:${PORT}`);
  });
}

module.exports = { server, fib };
