# cad_ai
A high-performance Web CAD engine powered by Rust (Wasm) and WebGPU. Engineered for "silky smooth" sub-16ms interaction latency, featuring a robust geometry kernel and native architecture for Generative AI integration.

## Google Sheets export
The project plan has been structured into CSV files that can be imported as tabs in Google Sheets:

- `docs/google_sheets/vision_goals.csv`
- `docs/google_sheets/tech_stack.csv`
- `docs/google_sheets/architecture.csv`
- `docs/google_sheets/performance_optimizations.csv`
- `docs/google_sheets/roadmap.csv`
- `docs/google_sheets/feasibility_extensibility.csv`
- `docs/google_sheets/next_steps.csv`
- `docs/google_sheets/requirements_constraints.csv`
- `docs/google_sheets/performance_budget.csv`
- `docs/google_sheets/data_model_interface.csv`
- `docs/google_sheets/command_system.csv`
- `docs/google_sheets/benchmark_plan.csv`
- `docs/google_sheets/risks.csv`
- `docs/google_sheets/dependencies.csv`
- `docs/google_sheets/deliverables.csv`
- `docs/google_sheets/issues.csv`

Import steps:
1. Open Google Sheets.
2. File -> Import -> Upload.
3. Upload each CSV and choose "Insert new sheet(s)".

## Data model
- JSON schema: `docs/schema/scene_graph_v0.json`
- TypeScript core types: `apps/web/src/core`

## POC renderer
The `poc` folder contains a minimal WebGPU/WebGL2 renderer and core math types.

Build and run:
1. `cd poc`
2. `npm install`
3. `npm run build`
4. Serve the folder with a local static server (for example `python -m http.server 8080`) and open `http://localhost:8080/poc/index.html`.
