// Tiny static server for the exported app in out/ (no dependencies).
// Serves /todos as out/todos.html, like a real static host.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.env.PORT ?? 5010);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function resolveFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const base = path.join(root, clean);
  if (!base.startsWith(root)) return null;
  for (const candidate of [base, `${base}.html`, path.join(base, "index.html")]) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

createServer(async (request, response) => {
  const urlPath = new URL(request.url ?? "/", "http://localhost").pathname;
  const file = (await resolveFile(urlPath)) ?? path.join(root, "404.html");
  const status = file.endsWith("404.html") && urlPath !== "/404" ? 404 : 200;
  try {
    const body = await readFile(file);
    response.writeHead(status, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(500).end("Static server error. Did you run `pnpm e2e:build`?");
  }
}).listen(port, () => {
  console.log(`Serving ${root} on http://localhost:${port}`);
});
