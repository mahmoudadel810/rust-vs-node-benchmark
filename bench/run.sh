#!/usr/bin/env bash
#
# Runs the same benchmark against both services, back to back.
#
# Prerequisites:
#   - Node.js >= 18
#   - Rust toolchain (https://rustup.rs) for the Rust service
#
# Usage: bash bench/run.sh [requests] [workers]

set -euo pipefail

REQUESTS="${1:-20000}"
WORKERS="${2:-50}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENDPOINTS=("/health" "/json" "/compute?n=30")

echo "== Building the Rust service (release) =="
(cd "$ROOT/rust-service" && cargo build --release --quiet)

echo "== Starting services =="
(cd "$ROOT/node-service" && PORT=3000 node server.js) &
NODE_PID=$!
("$ROOT/rust-service/target/release/rust-service") &
RUST_PID=$!
trap 'kill $NODE_PID $RUST_PID 2>/dev/null || true' EXIT
sleep 2

run_endpoint() {
  local endpoint="$1"
  echo
  echo "== Endpoint: $endpoint (requests=$REQUESTS, workers=$WORKERS) =="
  echo "-- Node.js (port 3000)"
  node "$ROOT/bench/bench.js" --url "http://localhost:3000$endpoint" \
    --requests "$REQUESTS" --workers "$WORKERS"
  echo "-- Rust (port 3001)"
  node "$ROOT/bench/bench.js" --url "http://localhost:3001$endpoint" \
    --requests "$REQUESTS" --workers "$WORKERS"
}

for endpoint in "${ENDPOINTS[@]}"; do
  run_endpoint "$endpoint"
done

echo
echo "== Endpoint: POST /echo =="
echo "-- Node.js (port 3000)"
node "$ROOT/bench/bench.js" --url "http://localhost:3000/echo" \
  --requests "$REQUESTS" --workers "$WORKERS" --method POST --body '{"hello":"world"}'
echo "-- Rust (port 3001)"
node "$ROOT/bench/bench.js" --url "http://localhost:3001/echo" \
  --requests "$REQUESTS" --workers "$WORKERS" --method POST --body '{"hello":"world"}'

echo
echo "Done."
