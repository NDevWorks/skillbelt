// Builds the Skillbelt website into site/dist. The playground bundles the real grader rules.
import { build, context } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "card"), { recursive: true });

for (const f of ["index.html", "styles.css", "card/index.html"]) fs.copyFileSync(path.join(here, f), path.join(dist, f));
fs.copyFileSync(path.join(here, "..", "docs", "social-preview.png"), path.join(dist, "social-preview.png"));

const options = {
  entryPoints: { app: path.join(here, "src/playground.js"), card: path.join(here, "src/card.js") },
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  outdir: dist,
  nodePaths: [path.join(here, "node_modules")], // lets ../grader import "yaml" from here
  loader: { ".md": "text" },
};

if (process.argv.includes("--serve")) {
  const ctx = await context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: dist, port: 8080 });
  console.log(`http://localhost:${port}`);
} else {
  await build(options);
  console.log("Built site/dist");
}
