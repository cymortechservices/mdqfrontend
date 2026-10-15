// Production build: bundles src/ with esbuild, hashes assets and writes dist/.
import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { root, esbuildOptions, renderIndexHtml } from "./shared.mjs";

const dist = path.join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, "assets"), { recursive: true });

const result = await build(esbuildOptions({ mode: "production", outdir: path.join(dist, "assets") }));

cpSync(path.join(root, "public"), dist, { recursive: true });
const html = readFileSync(path.join(root, "index.html"), "utf8");
writeFileSync(path.join(dist, "index.html"), renderIndexHtml(html, result.metafile));

const rows = Object.entries(result.metafile.outputs)
  .filter(([file]) => /\.(js|css)$/.test(file))
  .map(([file, meta]) => ({ file: path.relative(dist, path.resolve(root, file)), kb: meta.bytes / 1024 }))
  .sort((a, b) => b.kb - a.kb);
console.log("\nBundle report (uncompressed):");
for (const row of rows.slice(0, 12)) console.log(`  ${row.kb.toFixed(1).padStart(8)} kB  ${row.file}`);
const total = rows.reduce((sum, row) => sum + row.kb, 0);
console.log(`  ${total.toFixed(1).padStart(8)} kB  total JS+CSS in ${rows.length} files`);
console.log(`\nBuild complete → ${path.relative(root, dist)}/ (index.html ${statSync(path.join(dist, "index.html")).size} bytes)`);
