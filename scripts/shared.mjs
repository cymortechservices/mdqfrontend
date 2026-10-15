// Shared build configuration for the dev server and the production build.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Parse a minimal .env file (KEY=value, # comments). */
function parseEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith("#")) continue;
    out[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

/**
 * Only variables prefixed with VITE_ are exposed to the browser bundle.
 * They are PUBLIC: never put secrets in them.
 */
export function publicEnv(mode = "production") {
  const merged = {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, `.env.${mode}`)),
    ...process.env,
  };
  const env = {};
  for (const [key, value] of Object.entries(merged)) {
    if (key.startsWith("VITE_")) env[key] = value;
  }
  return env;
}

export function esbuildOptions({ mode, outdir }) {
  const env = publicEnv(mode);
  const define = {
    "import.meta.env.MODE": JSON.stringify(mode),
    "import.meta.env.DEV": JSON.stringify(mode !== "production"),
    "import.meta.env.PROD": JSON.stringify(mode === "production"),
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(env.VITE_API_BASE_URL ?? ""),
  };
  return {
    entryPoints: { main: path.join(root, "src/main.tsx") },
    bundle: true,
    format: "esm",
    splitting: true,
    outdir,
    publicPath: "/assets",
    entryNames: "[name]-[hash]",
    chunkNames: "chunks/[name]-[hash]",
    assetNames: "media/[name]-[hash]",
    target: ["es2022", "chrome110", "safari16", "firefox110"],
    jsx: "automatic",
    loader: { ".webp": "file", ".svg": "file", ".png": "file", ".woff2": "file" },
    define,
    metafile: true,
    legalComments: "none",
    logLevel: "info",
    minify: mode === "production",
    sourcemap: mode === "production" ? false : "linked",
  };
}

/** Rewrite index.html so the Vite-style dev tags point at the hashed bundles. */
export function renderIndexHtml(html, metafile, { liveReload = false } = {}) {
  const outputs = Object.entries(metafile.outputs);
  const entry = outputs.find(([, meta]) => meta.entryPoint?.endsWith("src/main.tsx"));
  if (!entry) throw new Error("Could not find the main entry in the esbuild metafile");
  const jsFile = "/" + entry[0].replace(/^.*?(assets\/)/, "assets/");
  const cssFile = entry[1].cssBundle
    ? "/" + entry[1].cssBundle.replace(/^.*?(assets\/)/, "assets/")
    : null;
  let out = html.replace(
    /<script type="module" src="\/src\/main\.tsx"><\/script>/,
    `${cssFile ? `<link rel="stylesheet" href="${cssFile}" />\n    ` : ""}<script type="module" src="${jsFile}"></script>`,
  );
  if (liveReload) {
    out = out.replace(
      "</body>",
      `<script>new EventSource("/__reload").onmessage=()=>location.reload()</script></body>`,
    );
  }
  return out;
}
