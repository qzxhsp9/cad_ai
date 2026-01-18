# OCCT STEP Import Service

Local native OCCT service for STEP import and mesh extraction.

## Setup
1. Build the OCCT CLI (`apps/occt-service/occt_cli`).
2. Set `OCCT_CLI` to the compiled binary path.
3. Run:
   - `npm install`
   - `npm run start`

## Environment
- `PORT` (default `7071`)
- `OCCT_CLI` path to `occt_step_export`
- `CORS_ORIGIN` (default `*`)

## API
POST `/api/step/import`
- multipart form: `file=<step>`
- optional fields: `deflection`, `angle`, `unit=mm|m`

GET `/api/step/models/:id`
- returns model meshes and bounds
