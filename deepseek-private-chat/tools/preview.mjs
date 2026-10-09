import http from "node:http";
import { readFile } from "node:fs/promises";
const root = new URL("../docs/", import.meta.url);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const files = new Set(["index.html", "app.js", "config.js", "style.css", "favicon.svg"]);
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const name = path === "/" ? "index.html" : path.slice(1);
  if (!["GET", "HEAD"].includes(req.method) || !files.has(name)) { res.writeHead(404).end(); return; }
  try {
    const data = await readFile(new URL(name, root));
    res.writeHead(200, { "Content-Type": mime[name.slice(name.lastIndexOf("."))], "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch { res.writeHead(404).end(); }
});
server.listen(4173, "127.0.0.1", () => console.log("Preview: http://127.0.0.1:4173 (real chat requires the configured Worker)"));
