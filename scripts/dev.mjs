// Development server with rebuild-on-save and live reload.
//   npm run dev                      → UI only; point MDQ_DEV_API_TARGET at a real backend
//   npm run dev:mock                 → UI + the in-memory DEV-ONLY mock API (dev/mock-api.mjs)
import { context } from "esbuild";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { root, esbuildOptions, renderIndexHtml, publicEnv } from "./shared.mjs";
import { createAppServer } from "./server.mjs";

const useMock = process.argv.includes("--mock");
const port = Number(process.env.PORT ?? 5173);
const outdir = path.join(root, ".dev");
rmSync(outdir, { recursive: true, force: true });
mkdirSync(path.join(outdir, "assets"), { recursive: true });

const clients = new Set();
let indexHtml = "";
const reloadPlugin = {
  name: "dev-index",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length || !result.metafile) return;
      const src = readFileSync(path.join(root, "index.html"), "utf8");
      indexHtml = renderIndexHtml(src, result.metafile, { liveReload: true });
      for (const client of clients) client.write("data: reload\n\n");
    });
  },
};

const ctx = await context({
  ...esbuildOptions({ mode: "development", outdir: path.join(outdir, "assets") }),
  plugins: [reloadPlugin],
});
await ctx.watch();

let mockApi;
if (useMock) {
  const mock = await import("../dev/mock-api.mjs");
  mockApi = mock.createMockApi();
  console.log("\n⚠  DEV MOCK API ACTIVE — all data is fake and lives in memory. Never ships in dist/.\n");
}

const apiTarget = process.env.MDQ_DEV_API_TARGET || undefined;
if (!useMock && !apiTarget) {
  console.log("ℹ  No MDQ_DEV_API_TARGET set and --mock not used: API calls will return 404.");
}

const server = createAppServer({
  roots: [outdir, path.join(root, "public")],
  getIndexHtml: () => indexHtml,
  apiTarget,
  mockApi,
  onReloadClient(res) {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write("\n");
    clients.add(res);
    res.on("close", () => clients.delete(res));
  },
});
server.listen(port, () => {
  console.log(`MDQ dev server → http://localhost:${port}  (public env: ${Object.keys(publicEnv("development")).join(", ") || "none"})`);
});
