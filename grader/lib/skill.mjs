// Loads a skill folder from disk. The rules themselves live in rules.mjs.
import fs from "node:fs";
import path from "node:path";
import { parseSkill } from "./rules.mjs";

export * from "./rules.mjs";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function readTree(dir, sub = "", out = {}) {
  for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "__pycache__") continue;
    const rel = sub ? `${sub}/${entry.name}` : entry.name;
    if (entry.isDirectory()) readTree(dir, rel, out);
    else if (entry.isFile()) {
      const full = path.join(dir, rel);
      out[rel] = fs.statSync(full).size <= MAX_FILE_BYTES ? fs.readFileSync(full, "utf8") : "";
    }
  }
  return out;
}

export function loadSkill(dir) {
  const files = fs.existsSync(dir) ? readTree(dir) : {};
  return parseSkill({ dir, folder: path.basename(dir), files });
}
