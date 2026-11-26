# rust-vs-node-benchmark

Head-to-head speed benchmark: the same simple REST API service implemented
twice — in **Rust (axum)** and in **Node.js (built-in `http`, zero
dependencies)** — measured with a small zero-dependency benchmark client.

## What the service does

Both implementations expose the same four endpoints on their own port
(Node: 3000, Rust: 3001):

| Method | Path            | Description                          |
| ------ | --------------- | ------------------------------------ |
| GET    | `/health`       | Returns `{ "status": "ok" }`         |
| GET    | `/json`         | Returns a fixed ~1 KB JSON payload   |
| GET    | `/compute?n=30` | Returns `fib(n)` (CPU-bound work)    |
| POST   | `/echo`         | Returns the request body unchanged   |

## Layout

```
node-service/   The Node.js service (plain http, no dependencies, tested)
rust-service/   The Rust service (axum + tokio, tested)
bench/          The benchmark client and runner script
docs/           Measured results
```

## Run it

Node service:

```bash
cd node-service
npm test          # runs the test suite (node:test)
npm start         # serves on http://localhost:3000
```

Rust service:

```bash
cd rust-service
cargo test
cargo run --release   # serves on http://localhost:3001
```

Benchmark both, back to back (builds the Rust release binary, starts both
services, measures every endpoint, and prints JSON reports):

```bash
bash bench/run.sh            # defaults: 20000 requests, 50 workers
bash bench/run.sh 50000 100  # custom load
```

Or measure one target by hand:

```bash
node bench/bench.js --url http://localhost:3000/json --requests 20000 --workers 50
```

## Results

See [docs/RESULTS.md](docs/RESULTS.md). The Node.js side was measured on
x86_64, 2 cores, Node v22; the Rust numbers are filled in by running
`bash bench/run.sh` on a machine with a Rust toolchain.

## Notes

- The Node service deliberately uses the built-in `http` module so the
  comparison has no framework-versus-framework noise.
- Both Fibonacci implementations are iterative and capped at n = 90 (the
  largest result that fits in a u64 / a safe JS integer range for the
  tested values).
- The benchmark client uses keep-alive connections, so it measures server
  throughput rather than connection setup cost.
