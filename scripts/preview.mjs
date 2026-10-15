// Serves the production build from dist/ with the same routing rules a real host needs.
//   npm run build && npm run preview
//   npm run preview -- --mock   (adds the DEV-ONLY mock API so the UI can be explored without a backend)
import path from "node:path";
import { existsSync } from "node:fs";
import { root } from "./shared.mjs";
import { createAppServer, readIndex } from "./server.mjs";

const dist = path.join(root, "dist");
if (!existsSync(path.join(dist, "index.html"))) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}
const useMock = process.argv.includes("--mock");
let mockApi;
if (useMock) {
  const mock = await import("../dev/mock-api.mjs");
  mockApi = mock.createMockApi();
  console.log("⚠  DEV MOCK API ACTIVE — fake in-memory data.");
}
const port = Number(process.env.PORT ?? 4173);
createAppServer({
  roots: [dist],
  getIndexHtml: () => readIndex(path.join(dist, "index.html")),
  apiTarget: process.env.MDQ_DEV_API_TARGET || undefined,
  mockApi,
}).listen(port, () => console.log(`MDQ preview → http://localhost:${port}`));
