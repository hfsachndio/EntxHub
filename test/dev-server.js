// Local server: static site + the /api function (in-memory store unless MONGODB_URI is set).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf" };

export function startServer(port = Number(process.env.PORT) || 8080) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname.startsWith("/api")) {
      req.url = `/api?path=${encodeURIComponent(url.pathname.replace(/^\/api\/?/, ""))}${url.search ? "&" + url.search.slice(1) : ""}`;
      return handler(req, res);
    }
    const file = normalize(join(root, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)));
    if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
    try { const body = await readFile(file); res.setHeader("Content-Type", types[extname(file).toLowerCase()] ?? "application/octet-stream"); res.end(body); }
    catch { res.statusCode = 404; res.end("Not found"); }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().then((s) => console.log(`EntXHub on http://localhost:${s.address().port}`));
}
