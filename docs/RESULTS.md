# Benchmark results

Each run fires 10,000 requests at 50 concurrent keep-alive workers.

## Environment

- Machine: x86_64, 2 vCPU
- Node.js: v22.23.5
- Rust: not measured yet (run `bash bench/run.sh` with a Rust toolchain)

## Node.js service (measured)

| Endpoint            | Requests/sec | Avg latency | p95    | p99     |
| ------------------- | ------------ | ----------- | ------ | ------- |
| GET /health         | 12,000.87    | 4.07 ms     | 9.65   | 25.97   |
| GET /json           | 12,258.29    | 3.97 ms     | 7.83   | 19.17   |
| GET /compute?n=30   | 12,605.21    | 3.86 ms     | 8.62   | 15.55   |
| POST /echo          | 11,894.62    | 4.10 ms     | 10.37  | 18.19   |

## Rust service

Pending. To measure:

```bash
bash bench/run.sh 10000 50
```

and copy the Rust sections of the output here next to the Node numbers
above. The runner benchmarks both services in the same session, so the
comparison stays apples-to-apples.

## Reading the numbers

- Throughput (requests/sec) is the headline metric: higher is better.
- Latency percentiles matter more than averages under load; compare p95/p99.
- `/compute?n=30` is the CPU-bound endpoint; the others are mostly I/O and
  framework overhead.
