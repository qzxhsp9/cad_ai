# OCCT Integration Options

This doc summarizes common OpenCascade (OCCT) integration approaches for a web-first CAD viewer/editor.

## Option A: Native OCCT (C++ desktop or local service)
- Runs OCCT directly as a native library.
- Typical usage: desktop app, plugin, or local helper service.
- Strengths: full OCCT feature set, best performance, easiest access to all APIs.
- Tradeoffs: platform-specific builds, larger binaries, not browser-native.

## Option B: OCCT compiled to WebAssembly (WASM)
- Runs OCCT in the browser via Emscripten.
- Typical usage: fully client-side modeling and STEP import.
- Strengths: offline-capable, data never leaves client, no backend required.
- Tradeoffs: large WASM payload, slower startup, memory limits, more complex build toolchain.

## Option C: Server-side OCCT service
- Runs OCCT on a server and returns geometry to the client.
- Typical usage: upload STEP -> server converts -> client renders mesh/lines.
- Strengths: full OCCT feature set, heavy compute on server, small client bundle.
- Tradeoffs: network latency, data transfer cost, requires backend infra, data leaves client.

## Summary comparison
- Feature coverage: A and C usually have full OCCT; B depends on the WASM build.
- Performance: A and C are usually fastest for heavy operations; B can be slower for large models.
- Deployment: A and C need native runtime; B is browser-only but with heavier build steps.
- Privacy/offline: B is best for offline/private use; C requires data upload.

## Recommendation guide
- If you need quickest STEP import validation in a web app: start with C (server-side conversion).
- If you need offline or air-gapped usage: choose B (WASM).
- If you are building a desktop-class app or local tool: choose A (native).

## Related docs
- Native OCCT STEP import plan: `docs/engineering/step_import_native_occt.md`
