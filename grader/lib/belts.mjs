// The five belts, plus the Blue belt checks that run the learner's script (Node.js only).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { BELT_INFO, findScript, gradeSkill, summarize } from "./rules.mjs";
import { loadSkill } from "./skill.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "csv");
const SCRIPT_TIMEOUT_MS = 10_000; // generous for cold starts on CI runners

// ---------- Blue belt: run the learner's script against test files ----------

function runScript(skill, script, args) {
  const cmd = script.endsWith(".py") ? (process.platform === "win32" ? "python" : "python3") : process.execPath;
  const res = spawnSync(cmd, [script, ...args], {
    cwd: skill.dir,
    encoding: "utf8",
    timeout: SCRIPT_TIMEOUT_MS,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
  });
  return {
    code: res.error ? -1 : res.status,
    stdout: (res.stdout ?? "").replace(/\r\n/g, "\n"),
    stderr: (res.stderr ?? "") + (res.error ? String(res.error.message) : ""),
  };
}

const firstDiff = (got, want) => {
  const g = got.trimEnd().split("\n");
  const w = want.trimEnd().split("\n");
  for (let i = 0; i < Math.max(g.length, w.length); i++) {
    if (g[i] !== w[i]) return `line ${i + 1}\n      expected: ${JSON.stringify(w[i] ?? "(no line)")}\n      got:      ${JSON.stringify(g[i] ?? "(no line)")}`;
  }
  return "";
};

function tableCase(name, description) {
  return {
    label: `Script: ${description}`,
    check: (s) => {
      const script = findScript(s);
      if (!script) return "Add the script first.";
      const input = path.join(FIXTURES, `${name}.csv`);
      const want = fs.readFileSync(path.join(FIXTURES, `${name}.expected.md`), "utf8").replace(/\r\n/g, "\n");
      const res = runScript(s, script, [input]);
      if (res.code !== 0) return `Exited with code ${res.code} on ${name}.csv. ${res.stderr.trim().split("\n").pop() ?? ""}`;
      if (res.stdout.trimEnd() !== want.trimEnd()) return `Output differs for ${name}.csv at ${firstDiff(res.stdout, want)}`;
      return null;
    },
  };
}

function errorCase(name, args, description, stderrPattern, hint) {
  return {
    label: `Script: ${description}`,
    check: (s) => {
      const script = findScript(s);
      if (!script) return "Add the script first.";
      const res = runScript(s, script, args());
      if (res.code === 0) return "It should exit with a non-zero code here, so the agent knows it failed.";
      if (!res.stderr.trim()) return "Print a clear error message to stderr explaining what went wrong.";
      if (stderrPattern && !stderrPattern.test(res.stderr))
        return `The error message should ${hint}. Got: ${res.stderr.trim()}`;
      return null;
    },
  };
}

const scriptCases = [
  tableCase("basic", "basic table"),
  tableCase("quoted", "quoted fields with commas and \"\" quotes"),
  tableCase("pipes-and-spaces", "trims spaces and escapes |"),
  tableCase("crlf-unicode", "Windows line endings and Tamil text"),
  tableCase("short-row", "pads short rows and skips blank lines"),
  tableCase("header-only", "header-only file"),
  errorCase("missing", () => [path.join(FIXTURES, "does-not-exist.csv")], "fails clearly when the file is missing", /not found|no such file|does not exist/i, 'say the file was "not found"'),
  errorCase("empty", () => [path.join(FIXTURES, "empty.csv")], "fails clearly on an empty file", /empty/i, 'say the file is "empty"'),
  errorCase("extra", () => [path.join(FIXTURES, "extra-cells.csv")], "rejects rows with too many cells, naming the line", /\bline\s+2\b/i, 'name the bad line, e.g. "line 2 has 3 cells, expected 2"'),
];

export const BELTS = BELT_INFO.map((b) => (b.id === "blue" ? { ...b, rules: [...b.rules, ...scriptCases] } : b));

// Skill folders inside my-belt/<belt>/
export function skillFolders(root, beltId) {
  const dir = path.join(root, "my-belt", beltId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => path.join(dir, e.name));
}

export function gradeBelt(root, belt) {
  const folders = skillFolders(root, belt.id);
  if (folders.length === 0) return { belt, status: "todo", results: [], skill: null };
  if (folders.length > 1) {
    return {
      belt,
      status: "fail",
      skill: null,
      results: [
        {
          label: "One skill per belt",
          ok: false,
          message: `Found ${folders.length} folders in my-belt/${belt.id}/ (${folders.map((f) => path.basename(f)).join(", ")}). Keep exactly one.`,
        },
      ],
    };
  }
  return gradeSkill(loadSkill(folders[0]), belt);
}

export function gradeAll(root) {
  const grades = BELTS.map((b) => gradeBelt(root, b));
  return { grades, ...summarize(grades, BELTS) };
}
