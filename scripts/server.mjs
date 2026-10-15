// Tiny static + SPA-fallback + optional API-proxy server used by `dev` and `preview`.
//
// Routing rules mirror what a production host must do (see README "Routing"):
//   1. A GET/HEAD that matches a real file is served as a file.
//   2. A GET/HEAD that accepts text/html and is not an API path gets index.html
//      (so /login, /portal?x=1, /shared-cat?token=… all load the SPA).
//   3. Everything else (POST /login, GET /api/*, …) is NOT rewritten: it is sent
//      to the API (proxy target or the dev mock) and 404s otherwise.
import http from "node:http";
import https from "node:https";
import { createReadStream, existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function proxy(target, req, res) {
  const url = new URL(req.url, target);
  const client = url.protocol === "https:" ? https : http;
  const upstream = client.request(
    url,
    { method: req.method, headers: { ...req.headers, host: url.host } },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Dev proxy could not reach ${target}: ${error.message}` }));
  });
  req.pipe(upstream);
}

/**
 * @param {{ roots: string[]; getIndexHtml: () => string; apiTarget?: string; mockApi?: (req, res) => Promise<boolean>|boolean; onReloadClient?: (res) => void }} options
 */
export function createAppServer({ roots, getIndexHtml, apiTarget, mockApi, onReloadClient }) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = decodeURIComponent(url.pathname);
      const method = req.method ?? "GET";

      if (pathname === "/__reload" && onReloadClient) return onReloadClient(res);

      if (method === "GET" || method === "HEAD") {
        for (const dir of roots) {
          const file = path.join(dir, pathname);
          if (file.startsWith(dir) && existsSync(file) && statSync(file).isFile()) {
            res.writeHead(200, {
              "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
              "cache-control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
            });
            return method === "HEAD" ? res.end() : createReadStream(file).pipe(res);
          }
        }
      }

      const isApiPath = pathname.startsWith("/api/");
      const wantsHtml = (req.headers.accept ?? "").includes("text/html");
      if ((method === "GET" || method === "HEAD") && wantsHtml && !isApiPath) {
        res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-cache" });
        return res.end(method === "HEAD" ? undefined : getIndexHtml());
      }

      if (mockApi && (await mockApi(req, res))) return;
      if (apiTarget) return proxy(apiTarget, req, res);

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `No handler for ${method} ${pathname}` }));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Dev server error" }));
    }
  });
}

export function readIndex(file) {
  return readFileSync(file, "utf8");
}
