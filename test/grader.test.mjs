// Tests for the grader itself: every rule must pass good skills and catch bad ones.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BELTS, gradeAll, gradeBelt } from "../grader/lib/belts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOOD = path.join(HERE, "fixtures", "good");

// Copy the good solutions to a temp folder, apply a change, and grade one belt
function withChange(beltId, change) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skillbelt-"));
  fs.cpSync(GOOD, root, { recursive: true });
  const beltDir = path.join(root, "my-belt", beltId);
  const skillDir = path.join(beltDir, fs.readdirSync(beltDir)[0]);
  change({ root, skillDir, file: path.join(skillDir, "SKILL.md") });
  return gradeBelt(root, BELTS.find((b) => b.id === beltId));
}

const edit = (file, from, to) => fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(from, to));
const failed = (grade) => grade.results.filter((r) => !r.ok).map((r) => r.label);

function expectFail(grade, labelPart) {
  assert.equal(grade.status, "fail", "expected the belt to fail");
  assert.ok(
    failed(grade).some((l) => l.includes(labelPart)),
    `expected a failure containing "${labelPart}", got: ${JSON.stringify(failed(grade))}`
  );
}

test("all good solutions earn the black belt", () => {
  const { earned, grades } = gradeAll(GOOD);
  for (const g of grades) assert.equal(g.status, "pass", `${g.belt.id}: ${JSON.stringify(failed(g))}`);
  assert.equal(earned.id, "black");
});

test("belts are earned in order", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skillbelt-"));
  fs.cpSync(GOOD, root, { recursive: true });
  fs.rmSync(path.join(root, "my-belt", "yellow"), { recursive: true });
  assert.equal(gradeAll(root).earned.id, "white");
});

test("empty belt folder is not started", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skillbelt-"));
  assert.equal(gradeBelt(root, BELTS[0]).status, "todo");
  assert.equal(gradeAll(root).earned, null);
});

// ---------- White: structure and spec ----------

test("missing SKILL.md", () => expectFail(withChange("white", ({ file }) => fs.rmSync(file)), "Has a SKILL.md"));
test("no frontmatter", () =>
  expectFail(withChange("white", ({ file }) => fs.writeFileSync(file, "# Just a heading\n")), "Frontmatter is valid YAML"));
test("broken YAML", () =>
  expectFail(withChange("white", ({ file }) => edit(file, "name: writing", "name: [writing")), "Frontmatter is valid YAML"));
test("uppercase name", () =>
  expectFail(withChange("white", ({ file }) => edit(file, "name: writing-commit-messages", "name: Writing-Commit-Messages")), "lowercase"));
test("double hyphen", () =>
  expectFail(withChange("white", ({ file }) => edit(file, "name: writing-commit-messages", "name: writing--commit")), "lowercase"));
test("name differs from folder", () =>
  expectFail(withChange("white", ({ file }) => edit(file, "name: writing-commit-messages", "name: commit-writer")), "matches the folder"));
test("reserved word", () =>
  expectFail(
    withChange("white", ({ root, skillDir, file }) => {
      edit(file, "name: writing-commit-messages", "name: claude-commits");
      fs.renameSync(skillDir, path.join(path.dirname(skillDir), "claude-commits"));
    }),
    "reserved"
  ));
test("missing description", () =>
  expectFail(withChange("white", ({ file }) => edit(file, /description: .*\n/, "")), "`description` is present"));
test("description too long", () =>
  expectFail(withChange("white", ({ file }) => edit(file, /description: .*\n/, `description: ${"word ".repeat(220)}\n`)), "max 1024"));
test("XML tag in description", () =>
  expectFail(withChange("white", ({ file }) => edit(file, "Writes clear", "Writes <b>clear</b>")), "No XML"));
test("unknown field", () =>
  expectFail(withChange("white", ({ file }) => edit(file, "description:", "author: me\ndescription:")), "Optional fields"));
test("metadata value must be text", () =>
  expectFail(withChange("white", ({ file }) => edit(file, "description:", "metadata:\n  version: 1.0\ndescription:")), "Optional fields"));
test("empty body", () =>
  expectFail(withChange("white", ({ file }) => edit(file, /\n# Writing[\s\S]*$/, "\n")), "instructions below"));
test("backslash paths", () =>
  expectFail(withChange("white", ({ file }) => fs.appendFileSync(file, "\nSee references\\guide.md\n")), "forward slashes"));
test("two skills in one belt", () =>
  expectFail(
    withChange("white", ({ skillDir }) => fs.cpSync(skillDir, path.join(path.dirname(skillDir), "another-skill"), { recursive: true })),
    "One skill per belt"
  ));

// ---------- Yellow: descriptions ----------

const yellowDesc = (d) => withChange("yellow", ({ file }) => edit(file, /description: .*\n/, `description: ${d}\n`));
test("short description", () => expectFail(yellowDesc("Formats Indian addresses. Use when asked."), "80+"));
test("no 'when' clause", () =>
  expectFail(yellowDesc("Formats Indian postal addresses with door number, street, area, city, district, state and PIN code for couriers."), "when to use"));
test("first person", () =>
  expectFail(yellowDesc("I format Indian postal addresses with door number, street, area, city and PIN code. Use when the user pastes an address."), "third person"));
test("second person", () =>
  expectFail(yellowDesc("You can format Indian postal addresses with door number, street, area, city and PIN code. Use when the user pastes an address."), "third person"));
test("vague wording", () =>
  expectFail(yellowDesc("Helps with addresses and various other things related to Indian postal delivery labels. Use when the user asks about addresses."), "specific"));
test("generic name", () =>
  expectFail(
    withChange("yellow", ({ skillDir, file }) => {
      edit(file, "name: formatting-indian-addresses", "name: helper");
      fs.renameSync(skillDir, path.join(path.dirname(skillDir), "helper"));
    }),
    "Name is descriptive"
  ));

// ---------- Green: progressive disclosure ----------

test("no references folder", () =>
  expectFail(withChange("green", ({ skillDir }) => fs.rmSync(path.join(skillDir, "references"), { recursive: true })), "references/"));
test("unlinked reference file", () =>
  expectFail(withChange("green", ({ skillDir }) => fs.writeFileSync(path.join(skillDir, "references", "extra.md"), "# Extra\n")), "links to every"));
test("broken link", () =>
  expectFail(withChange("green", ({ file }) => edit(file, "references/red-flags.md", "references/redflags.md")), "link in SKILL.md works"));
test("nested reference", () =>
  expectFail(
    withChange("green", ({ skillDir }) => fs.appendFileSync(path.join(skillDir, "references", "red-flags.md"), "\nSee [terms](typical-terms.md)\n")),
    "one level deep"
  ));
test("body over 500 lines", () =>
  expectFail(withChange("green", ({ file }) => fs.appendFileSync(file, "\n- line".repeat(520))), "under 500"));
test("long reference without contents", () =>
  expectFail(
    withChange("green", ({ skillDir }) => fs.appendFileSync(path.join(skillDir, "references", "typical-terms.md"), "\n- row".repeat(120))),
    "table of contents"
  ));
test("links inside code blocks are ignored", () => {
  const g = withChange("green", ({ file }) => fs.appendFileSync(file, "\n```md\n[example](does/not/exist.md)\n```\n"));
  assert.equal(g.status, "pass", JSON.stringify(failed(g)));
});

// ---------- Blue: scripts ----------

const NODE_SOLUTION = `#!/usr/bin/env node
// Print a CSV file as a GitHub-flavoured Markdown table.
import fs from "node:fs";
const fail = (m) => { console.error("csv_to_table: " + m); process.exit(1); };
const file = process.argv[2];
if (!file) fail("usage: csv_to_table.mjs FILE.csv");
if (!fs.existsSync(file)) fail("file not found: " + file);
const text = fs.readFileSync(file, "utf8").replace(/^\\uFEFF/, "");
function parseLine(line) {
  const cells = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { cells.push(cur); cur = ""; } else cur += ch;
  }
  cells.push(cur); return cells;
}
const rows = text.split(/\\r?\\n/).map((l, i) => ({ n: i + 1, l })).filter((r) => r.l.trim());
if (!rows.length) fail(file + " is empty");
const header = parseLine(rows[0].l).map((c) => c.trim());
const out = [header, header.map(() => "---")];
for (const r of rows.slice(1)) {
  const cells = parseLine(r.l).map((c) => c.trim());
  if (cells.length > header.length) fail("line " + r.n + " has " + cells.length + " cells, expected " + header.length);
  while (cells.length < header.length) cells.push("");
  out.push(cells);
}
for (const c of out) console.log("| " + c.map((x) => x.replace(/\\|/g, "\\\\|")).join(" | ") + " |");
`;

test("JavaScript script works too", () => {
  const g = withChange("blue", ({ skillDir, file }) => {
    fs.rmSync(path.join(skillDir, "scripts", "csv_to_table.py"));
    fs.writeFileSync(path.join(skillDir, "scripts", "csv_to_table.mjs"), NODE_SOLUTION);
    edit(file, "python scripts/csv_to_table.py", "node scripts/csv_to_table.mjs");
  });
  assert.equal(g.status, "pass", JSON.stringify(g.results.filter((r) => !r.ok)));
});
test("wrong folder name", () =>
  expectFail(
    withChange("blue", ({ skillDir, file }) => {
      edit(file, "name: csv-to-table", "name: csv-tables");
      fs.renameSync(skillDir, path.join(path.dirname(skillDir), "csv-tables"));
    }),
    "named `csv-to-table`"
  ));
test("missing script", () =>
  expectFail(withChange("blue", ({ skillDir }) => fs.rmSync(path.join(skillDir, "scripts"), { recursive: true })), "Has scripts/"));
test("SKILL.md doesn't say to run it", () =>
  expectFail(withChange("blue", ({ file }) => edit(file, /Run the script[\s\S]*$/, "Convert CSV files carefully into Markdown tables.\n")), "run the script"));
test("pipe not escaped", () =>
  expectFail(withChange("blue", ({ skillDir }) => edit(path.join(skillDir, "scripts", "csv_to_table.py"), 'c.replace("|", "\\\\|")', "c")), "escapes |"));
test("crashes on short rows", () =>
  expectFail(
    withChange("blue", ({ skillDir }) => edit(path.join(skillDir, "scripts", "csv_to_table.py"), ' + [""] * (width - len(row))', "")),
    "pads short rows"
  ));
test("silent success on missing file", () =>
  expectFail(
    withChange("blue", ({ skillDir }) =>
      edit(path.join(skillDir, "scripts", "csv_to_table.py"), 'fail(f"file not found: {path}")', "sys.exit(0)")
    ),
    "missing"
  ));
test("error without line number", () =>
  expectFail(
    withChange("blue", ({ skillDir }) =>
      edit(path.join(skillDir, "scripts", "csv_to_table.py"), 'fail(f"line {number} has {len(row)} cells, expected {width}")', 'fail("too many cells")')
    ),
    "naming the line"
  ));

// ---------- Black: evals and shipping ----------

const evalsFile = (skillDir) => path.join(skillDir, "evals", "evals.json");
test("no evals", () => expectFail(withChange("black", ({ skillDir }) => fs.rmSync(path.join(skillDir, "evals"), { recursive: true })), "evals.json"));
test("invalid JSON", () => expectFail(withChange("black", ({ skillDir }) => fs.writeFileSync(evalsFile(skillDir), "[{")), "evals.json"));
test("too few evals", () =>
  expectFail(
    withChange("black", ({ skillDir }) => fs.writeFileSync(evalsFile(skillDir), JSON.stringify([{ query: "Make a GST invoice please", expected_behavior: ["x"] }]))),
    "at least 3"
  ));
test("no should-not-trigger case", () =>
  expectFail(
    withChange("black", ({ skillDir }) => {
      const data = JSON.parse(fs.readFileSync(evalsFile(skillDir), "utf8")).filter((c) => c.should_trigger !== false);
      fs.writeFileSync(evalsFile(skillDir), JSON.stringify(data));
    }),
    "should NOT trigger"
  ));
test("no license", () => expectFail(withChange("black", ({ file }) => edit(file, "license: MIT\n", "")), "license"));
test("nothing bundled", () =>
  expectFail(
    withChange("black", ({ skillDir, file }) => {
      fs.rmSync(path.join(skillDir, "references"), { recursive: true });
      edit(file, /3\. Check[\s\S]*?output\.\n/, "");
    }),
    "scripts/ or references/"
  ));
