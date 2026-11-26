'use strict';

/**
 * Zero-dependency HTTP benchmark client.
 *
 * Fires a fixed number of requests at a target URL with a fixed number of
 * concurrent workers (keep-alive), then reports throughput and latency.
 *
 * Usage:
 *   node bench/bench.js --url http://localhost:3000/json [--requests 20000] [--workers 50]
 *   node bench/bench.js --url http://localhost:3000/echo --method POST --body '{"hello":"world"}'
 */

const http = require('node:http');

function parseArgs(argv) {
  const args = {
    url: null,
    requests: 20000,
    workers: 50,
    method: 'GET',
    body: null,
  };
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (key === 'requests' || key === 'workers') {
      args[key] = Number.parseInt(value, 10);
    } else {
      args[key] = value;
    }
  }
  if (!args.url) {
    console.error('Missing --url');
    process.exit(1);
  }
  return args;
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

/** One worker: issues `count` sequential requests on a keep-alive agent. */
async function runWorker(target, count, agent, latencies) {
  for (let i = 0; i < count; i += 1) {
    const start = performance.now();
    await new Promise((resolve, reject) => {
      const req = http.request(
        target.url,
        { agent, method: target.method, headers: target.headers },
        (res) => {
          res.resume(); // drain the body
          res.on('end', resolve);
        },
      );
      req.on('error', reject);
      if (target.body) req.write(target.body);
      req.end();
    });
    latencies.push(performance.now() - start);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const target = {
    url: args.url,
    method: args.method,
    body: args.body,
    headers: args.body ? { 'Content-Type': 'application/json' } : {},
  };

  const agent = new http.Agent({ keepAlive: true, maxSockets: args.workers });
  const perWorker = Math.ceil(args.requests / args.workers);
  const latencies = [];

  const started = performance.now();
  await Promise.all(
    Array.from({ length: args.workers }, () =>
      runWorker(target, perWorker, agent, latencies),
    ),
  );
  const elapsedMs = performance.now() - started;
  agent.destroy();

  const total = perWorker * args.workers;
  latencies.sort((a, b) => a - b);

  const result = {
    url: args.url,
    method: args.method,
    requests: total,
    concurrency: args.workers,
    elapsedSeconds: Math.round((elapsedMs / 1000) * 100) / 100,
    requestsPerSecond: Math.round((total / (elapsedMs / 1000)) * 100) / 100,
    latencyMs: {
      avg: Math.round((latencies.reduce((s, v) => s + v, 0) / total) * 100) / 100,
      p50: Math.round(percentile(latencies, 50) * 100) / 100,
      p95: Math.round(percentile(latencies, 95) * 100) / 100,
      p99: Math.round(percentile(latencies, 99) * 100) / 100,
      max: Math.round(latencies[total - 1] * 100) / 100,
    },
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
