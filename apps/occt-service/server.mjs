import cors from "cors";
import express from "express";
import multer from "multer";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const port = Number.parseInt(process.env.PORT ?? "7071", 10);
const uploadDir = join(tmpdir(), "occt-uploads");
const upload = multer({ dest: uploadDir });

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));

const models = new Map();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/step/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Missing STEP file." });
      return;
    }
    const deflection = readNumber(req.body.deflection, 0.2);
    const angle = readNumber(req.body.angle, 0.5);
    const unit = readUnit(req.body.unit ?? "mm");

    const result = await runOcctCli(req.file.path, { deflection, angle, unit });
    const modelId = randomUUID();
    models.set(modelId, result);

    res.json({
      modelId,
      bounds: result.bounds,
      meshCount: result.meshes?.length ?? 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "STEP import failed."
    });
  } finally {
    if (req.file?.path) {
      await rm(req.file.path, { force: true });
    }
  }
});

app.get("/api/step/models/:id", (req, res) => {
  const model = models.get(req.params.id);
  if (!model) {
    res.status(404).json({ error: "Model not found." });
    return;
  }
  res.json(model);
});

app.listen(port, async () => {
  await mkdir(uploadDir, { recursive: true });
  console.log(`OCCT service listening on http://localhost:${port}`);
});

function readNumber(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readUnit(value) {
  if (value === "m" || value === "mm") {
    return value;
  }
  return "mm";
}

async function runOcctCli(filePath, options) {
  const cliPath = resolveOcctCliPath();

  const args = [
    filePath,
    "--deflection",
    String(options.deflection),
    "--angle",
    String(options.angle),
    "--unit",
    options.unit
  ];

  const { stdout, stderr } = await runCommand(cliPath, args);
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error(`OCCT CLI returned empty output. ${formatStdErr(stderr)}`);
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `Failed to parse OCCT CLI output. ${formatStdErr(stderr)} Output: ${truncate(trimmed, 400)}`
    );
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(formatStdErr(stderr) || `OCCT CLI exited with code ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function resolveOcctCliPath() {
  const candidates = [];
  const envPath = process.env.OCCT_CLI;
  if (envPath) {
    candidates.push(resolve(envPath));
    if (process.platform === "win32" && !envPath.endsWith(".exe")) {
      candidates.push(resolve(`${envPath}.exe`));
    }
  }
  const base = resolve(join(process.cwd(), "occt_cli", "build", "occt_step_export"));
  candidates.push(base);
  if (process.platform === "win32") {
    candidates.push(`${base}.exe`);
    candidates.push(resolve(join(process.cwd(), "occt_cli", "build", "Release", "occt_step_export.exe")));
  }

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`OCCT_CLI not found. Tried: ${candidates.join(", ")}`);
  }
  return found;
}

function formatStdErr(stderr) {
  const trimmed = stderr?.trim();
  if (!trimmed) {
    return "";
  }
  return `stderr: ${truncate(trimmed, 300)}`;
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...(${value.length} chars)`;
}
