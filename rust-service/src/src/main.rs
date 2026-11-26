//! Simple REST API service in Rust (axum).
//!
//! The same four endpoints exist in the Node service (node-service/),
//! so the benchmark compares the runtimes, not the feature sets.
//!
//! Endpoints:
//!   GET  /health          -> { "status": "ok" }
//!   GET  /json            -> a fixed JSON payload (~1 KB)
//!   GET  /compute?n=30    -> { "n": 30, "fib": 832040 }  (CPU-bound)
//!   POST /echo            -> returns the request body unchanged

use axum::{
    body::Body,
    extract::Query,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

#[derive(Serialize)]
struct Item {
    id: u32,
    name: String,
    price: f64,
    #[serde(rename = "inStock")]
    in_stock: bool,
}

#[derive(Serialize)]
struct JsonPayload {
    service: &'static str,
    items: Vec<Item>,
}

#[derive(Deserialize)]
struct ComputeParams {
    n: Option<u32>,
}

#[derive(Serialize)]
struct ComputeResult {
    n: u32,
    fib: u64,
}

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
}

/// Iterative Fibonacci: fast, deterministic, and safe for n up to 90
/// (the largest n whose result still fits in a u64, matching the JS limit).
fn fib(n: u32) -> u64 {
    let (mut a, mut b) = (0u64, 1u64);
    for _ in 0..n {
        let next = a + b;
        a = b;
        b = next;
    }
    a
}

/// Fixed ~1 KB payload, built once at startup.
static JSON_PAYLOAD: OnceLock<JsonPayload> = OnceLock::new();

fn json_payload() -> &'static JsonPayload {
    JSON_PAYLOAD.get_or_init(|| JsonPayload {
        service: "rust",
        items: (1..=25)
            .map(|i| Item {
                id: i,
                name: format!("item-{i}"),
                price: (i as f64 * 9.99 * 100.0).round() / 100.0,
                in_stock: i % 2 == 1,
            })
            .collect(),
    })
}

async fn health() -> Json<Health> {
    Json(Health { status: "ok" })
}

async fn json_endpoint() -> Json<&'static JsonPayload> {
    Json(json_payload())
}

async fn compute(
    Query(params): Query<ComputeParams>,
) -> Result<Json<ComputeResult>, (StatusCode, Json<ErrorBody>)> {
    let n = params.n.unwrap_or(30);
    if n > 90 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                error: "n must be an integer between 0 and 90",
            }),
        ));
    }
    Ok(Json(ComputeResult { n, fib: fib(n) }))
}

async fn echo(body: Body) -> Body {
    body
}

/// Route table: one router, same paths as the Node service.
fn app() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/json", get(json_endpoint))
        .route("/compute", get(compute))
        .route("/echo", post(echo))
}

#[tokio::main]
async fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .expect("failed to bind port");
    println!("Rust service listening on http://localhost:{port}");
    axum::serve(listener, app()).await.expect("server error");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fib_computes_correct_values() {
        assert_eq!(fib(0), 0);
        assert_eq!(fib(1), 1);
        assert_eq!(fib(10), 55);
        assert_eq!(fib(30), 832040);
    }

    #[test]
    fn payload_matches_node_shape() {
        let payload = json_payload();
        assert_eq!(payload.service, "rust");
        assert_eq!(payload.items.len(), 25);
        assert_eq!(payload.items[0].name, "item-1");
        assert!(payload.items[0].in_stock);
    }
}
