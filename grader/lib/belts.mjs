// The five belts. Each one builds on the rules of the belts before it.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  descriptionRules,
  disclosureRules,
  listFiles,
  loadSkill,
  runRules,
  specRules,
  structureRules,
} from "./skill.mjs";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "csv");
const SCRIPT_TIMEOUT_MS = 10_000; // generous for cold starts on CI runners

// ---------- Blue belt: run the learner's script against test files ----------

function findScript(skill) {
  const candidates = ["scripts/csv_to_table.py", "scripts/csv_to_table.mjs", "scripts/csv_to_table.js"];
  return candidates.find((c) => fs.existsSync(path.join(skill.dir, c)));
}

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

const scriptRules = [
  {
    label: "Skill is named `csv-to-table`",
    check: (s) => (s.folder === "csv-to-table" ? null : `Name the folder \`csv-to-table\` (found \`${s.folder}\`).`),
  },
  {
    label: "Has scripts/csv_to_table.py (or .mjs / .js)",
    check: (s) => (findScript(s) ? null : "Create scripts/csv_to_table.py or scripts/csv_to_table.mjs."),
  },
  {
    label: "SKILL.md tells the agent to run the script",
    check: (s) => {
      const script = findScript(s) ?? "scripts/csv_to_table";
      const mentions = s.body.includes(script.replace(/\.(py|mjs|js)$/, ""));
      const runs = /\b(run|execute)\b/i.test(s.body);
      return mentions && runs ? null : `Tell the agent to run it, e.g. "Run \`${script} input.csv\`" so it executes the script instead of rewriting it.`;
    },
  },
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

// ---------- Black belt: evaluations and shipping ----------

const evalRules = [
  {
    label: "Has scripts/ or references/ (more than one file)",
    check: (s) =>
      listFiles(s.dir, "scripts").length || listFiles(s.dir, "references").length
        ? null
        : "A black-belt skill bundles something: a script in scripts/ or detail in references/.",
  },
  {
    label: "Has a `license` field",
    check: (s) => (s.frontmatter?.license ? null : "Add `license: MIT` (or another license) so others can reuse it."),
  },
  {
    label: "Has evals/evals.json with at least 3 cases",
    check: (s) => {
      const file = path.join(s.dir, "evals", "evals.json");
      if (!fs.existsSync(file)) return "Create evals/evals.json. See the Black belt lesson for the format.";
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (err) {
        return `evals.json isn't valid JSON: ${err.message}`;
      }
      if (!Array.isArray(data)) return "evals.json must be a list: [ {...}, {...}, {...} ].";
      if (data.length < 3) return `Found ${data.length} case(s). Write at least 3.`;
      for (const [i, c] of data.entries()) {
        if (!c || typeof c.query !== "string" || c.query.trim().length < 10)
          return `Case ${i + 1}: \`query\` must be a realistic request (10+ characters).`;
        if (c.should_trigger !== undefined && typeof c.should_trigger !== "boolean")
          return `Case ${i + 1}: \`should_trigger\` must be true or false.`;
        const expects = c.expected_behavior;
        if (c.should_trigger !== false && (!Array.isArray(expects) || !expects.length || expects.some((e) => typeof e !== "string" || !e.trim())))
          return `Case ${i + 1}: \`expected_behavior\` must list what a correct answer does.`;
      }
      return null;
    },
  },
  {
    label: "Evals include a case that should NOT trigger the skill",
    check: (s) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(s.dir, "evals", "evals.json"), "utf8"));
        const yes = data.filter((c) => c.should_trigger !== false).length;
        const no = data.filter((c) => c.should_trigger === false).length;
        if (!yes) return "Add at least one case where the skill should be used.";
        if (!no) return "Add a look-alike request with `\"should_trigger\": false`, to prove the description isn't too broad.";
        return null;
      } catch {
        return "Fix evals/evals.json first.";
      }
    },
  },
  {
    label: "Is your own skill (not the Blue belt exercise)",
    check: (s) => (s.folder === "csv-to-table" ? "Build an original skill for your black belt." : null),
  },
];

// Disclosure rules only apply to a black-belt skill if it has references
const optionalDisclosure = disclosureRules
  .filter((r) => r.label !== "Has at least one file in references/")
  .map((r) => ({ ...r, check: (s) => (listFiles(s.dir, "references").length ? r.check(s) : null) }));

export const BELTS = [
  {
    id: "white",
    title: "White belt",
    lesson: "belts/1-white.md",
    color: "lightgrey",
    rules: [...structureRules, ...specRules],
  },
  {
    id: "yellow",
    title: "Yellow belt",
    lesson: "belts/2-yellow.md",
    color: "yellow",
    rules: [...structureRules, ...specRules, ...descriptionRules],
  },
  {
    id: "green",
    title: "Green belt",
    lesson: "belts/3-green.md",
    color: "brightgreen",
    rules: [...structureRules, ...specRules, ...descriptionRules, ...disclosureRules],
  },
  {
    id: "blue",
    title: "Blue belt",
    lesson: "belts/4-blue.md",
    color: "blue",
    rules: [...structureRules, ...specRules, ...descriptionRules, ...scriptRules],
  },
  {
    id: "black",
    title: "Black belt",
    lesson: "belts/5-black.md",
    color: "black",
    rules: [...structureRules, ...specRules, ...descriptionRules, ...optionalDisclosure, ...evalRules],
  },
];

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
  const skill = loadSkill(folders[0]);
  // Stop after structure problems: other rules can't run without a readable SKILL.md
  const structure = runRules(skill, structureRules);
  if (structure.some((r) => !r.ok)) return { belt, status: "fail", skill, results: structure };
  const results = runRules(skill, belt.rules);
  return { belt, status: results.every((r) => r.ok) ? "pass" : "fail", skill, results };
}

export function gradeAll(root) {
  const grades = BELTS.map((b) => gradeBelt(root, b));
  // Belts are earned in order: your belt is the last one passed with all earlier ones passed
  let earned = null;
  for (const g of grades) {
    if (g.status !== "pass") break;
    earned = g.belt;
  }
  const next = BELTS[earned ? BELTS.indexOf(earned) + 1 : 0] ?? null;
  return { grades, earned, next };
}
