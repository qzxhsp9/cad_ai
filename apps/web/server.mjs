import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve(process.cwd());
const port = Number.parseInt(process.env.PORT ?? "8080", 10);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"]
]);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let pathname = url.pathname;
    if (pathname === "/") {
      pathname = "/index.html";
    }

    const filePath = resolve(join(root, pathname));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    let fileStat;
    try {
      fileStat = statSync(filePath);
    } catch {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const resolvedPath = fileStat.isDirectory()
      ? join(filePath, "index.html")
      : filePath;
    const data = await readFile(resolvedPath);
    const ext = extname(resolvedPath).toLowerCase();

    res.setHeader("Content-Type", mimeTypes.get(ext) ?? "application/octet-stream");
    res.writeHead(200);
    res.end(data);
  } catch (error) {
    res.writeHead(500);
    res.end(error instanceof Error ? error.message : "Server error");
  }
});

server.listen(port, () => {
  console.log(`Web app running on http://localhost:${port}`);
});
