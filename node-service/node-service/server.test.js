'use strict';

/**
 * Tests for the Node service, using the built-in node:test runner.
 * Run with: npm test  (or: node --test)
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { server, fib } = require('./server');

let baseUrl;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('fib computes correct values', () => {
  assert.equal(fib(0), 0);
  assert.equal(fib(1), 1);
  assert.equal(fib(10), 55);
  assert.equal(fib(30), 832040);
});

test('GET /health returns ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('GET /json returns the payload', async () => {
  const res = await fetch(`${baseUrl}/json`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.service, 'node');
  assert.equal(body.items.length, 25);
});

test('GET /compute returns fib(n)', async () => {
  const res = await fetch(`${baseUrl}/compute?n=30`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { n: 30, fib: 832040 });
});

test('GET /compute rejects bad n', async () => {
  const res = await fetch(`${baseUrl}/compute?n=500`);
  assert.equal(res.status, 400);
});

test('POST /echo returns the body unchanged', async () => {
  const payload = JSON.stringify({ hello: 'world' });
  const res = await fetch(`${baseUrl}/echo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), payload);
});

test('unknown route returns 404', async () => {
  const res = await fetch(`${baseUrl}/nope`);
  assert.equal(res.status, 404);
});
