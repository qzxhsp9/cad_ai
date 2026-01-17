#![cfg(target_arch = "wasm32")]

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn schema_version() -> String {
    "v0".to_string()
}

#[wasm_bindgen]
pub fn add(a: f64, b: f64) -> f64 {
    a + b
}
