// Checks a skill (a map of file paths to text) against the Agent Skills specification
// (https://agentskills.io/specification) and the skill-authoring best practices.
import { parse as parseYaml } from "yaml";

// The Skillbelt website: playground and belt cards
export const SITE = "https://skillbelt.vercel.app";

export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED_WORDS = ["anthropic", "claude"];
const VAGUE_NAMES = new Set([
  "helper", "helpers", "util", "utils", "tool", "tools", "misc", "stuff",
  "documents", "data", "files", "skill", "my-skill", "test", "example",
]);
const KNOWN_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);

// ---------- Loading ----------
// A skill is { dir, folder, files }, where files maps "SKILL.md", "references/a.md", ... to their text.
// This file has no Node.js imports, so the same rules run in the browser playground.

export function parseSkill({ dir, folder, files }) {
  const skill = { dir: dir ?? folder, folder, files, exists: false, raw: "", frontmatter: null, frontmatterError: null, body: "" };
  if (typeof files["SKILL.md"] !== "string") return skill;
  skill.exists = true;
  skill.raw = files["SKILL.md"].replace(/^﻿/, "");

  const match = skill.raw.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    skill.frontmatterError = "SKILL.md must start with a YAML frontmatter block: a line with ---, the fields, then another ---.";
    return skill;
  }
  try {
    const data = parseYaml(match[1]);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      skill.frontmatterError = "The frontmatter must be a set of fields like `name: ...` and `description: ...`.";
    } else {
      skill.frontmatter = data;
    }
  } catch (err) {
    skill.frontmatterError = `The frontmatter isn't valid YAML: ${String(err.message).split("\n")[0]}`;
  }
  skill.body = match[2] ?? "";
  return skill;
}

// "a/./b/../c.md" → "a/c.md"; null if it climbs out of the skill folder
export function normalize(p) {
  const out = [];
  for (const part of p.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!out.length) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join("/");
}

export const listFiles = (s, sub) =>
  Object.keys(s.files).filter((f) => f.startsWith(`${sub}/`) && !f.split("/").some((p) => p.startsWith(".")));
export const readFile = (s, rel) => s.files[rel] ?? "";
export function exists(s, rel) {
  const n = normalize(rel);
  if (n === null) return false;
  if (n === "") return true;
  return n in s.files || Object.keys(s.files).some((f) => f.startsWith(`${n}/`));
}

// Markdown with fenced code blocks removed, so example code isn't mistaken for real links
export function stripCodeBlocks(markdown) {
  return markdown.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, "");
}

// Relative links like [guide](references/guide.md), without #fragments
export function relativeLinks(markdown) {
  const links = [];
  const re = /\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
  for (const m of stripCodeBlocks(markdown).matchAll(re)) {
    const target = m[1];
    if (/^(https?:|mailto:|#|\/\/)/i.test(target)) continue;
    links.push(decodeURI(target.split("#")[0]));
  }
  return links.filter(Boolean);
}

// ---------- Rule sets ----------
// Each rule: { label, check(skill) → null when fine, or a message saying how to fix it }

export const structureRules = [
  {
    label: "Has a SKILL.md file",
    check: (s) => (s.exists ? null : `Create ${s.dir}/SKILL.md (exact name, capital letters).`),
  },
  {
    label: "Frontmatter is valid YAML",
    check: (s) => (!s.exists ? "Needs SKILL.md first." : s.frontmatterError),
  },
];

export const specRules = [
  {
    label: "`name` is present",
    check: (s) => (typeof s.frontmatter?.name === "string" && s.frontmatter.name.length > 0 ? null : "Add a `name:` field."),
  },
  {
    label: "`name` uses lowercase letters, digits and single hyphens (max 64)",
    check: (s) => {
      const name = String(s.frontmatter?.name ?? "");
      if (!name) return "Add a `name:` field first.";
      if (name.length > 64) return `\`name\` is ${name.length} characters. The limit is 64.`;
      if (/[A-Z]/.test(name)) return `\`${name}\` has capital letters. Try \`${name.toLowerCase()}\`.`;
      if (/^-|-$/.test(name)) return `\`${name}\` can't start or end with a hyphen.`;
      if (/--/.test(name)) return `\`${name}\` can't contain two hyphens in a row.`;
      if (!NAME_PATTERN.test(name)) return `\`${name}\` may only use a-z, 0-9 and hyphens (no spaces or underscores).`;
      return null;
    },
  },
  {
    label: "`name` matches the folder name",
    check: (s) => {
      const name = s.frontmatter?.name;
      if (!name) return "Add a `name:` field first.";
      return name === s.folder ? null : `The folder is \`${s.folder}\` but \`name\` is \`${name}\`. Make them the same.`;
    },
  },
  {
    label: "`name` avoids reserved words",
    check: (s) => {
      const name = String(s.frontmatter?.name ?? "");
      const word = RESERVED_WORDS.find((w) => name.includes(w));
      return word ? `\`${word}\` is reserved and rejected by Claude. Pick another name.` : null;
    },
  },
  {
    label: "`description` is present (max 1024 characters)",
    check: (s) => {
      const d = s.frontmatter?.description;
      if (typeof d !== "string" || !d.trim()) return "Add a `description:` that says what the skill does and when to use it.";
      if (d.length > 1024) return `\`description\` is ${d.length} characters. The limit is 1024.`;
      return null;
    },
  },
  {
    label: "No XML tags in `name` or `description`",
    check: (s) => {
      const text = `${s.frontmatter?.name ?? ""} ${s.frontmatter?.description ?? ""}`;
      return /<\/?[a-zA-Z][^>]*>/.test(text) ? "Remove tags like `<example>` from `name` and `description`." : null;
    },
  },
  {
    label: "Optional fields are valid",
    check: (s) => {
      const fm = s.frontmatter ?? {};
      if (fm.compatibility !== undefined) {
        if (typeof fm.compatibility !== "string" || !fm.compatibility.trim()) return "`compatibility` must be text.";
        if (fm.compatibility.length > 500) return `\`compatibility\` is ${fm.compatibility.length} characters. The limit is 500.`;
      }
      if (fm.metadata !== undefined) {
        if (!fm.metadata || typeof fm.metadata !== "object" || Array.isArray(fm.metadata))
          return "`metadata` must be a map, like:\n  metadata:\n    author: your-name";
        const bad = Object.entries(fm.metadata).find(([, v]) => typeof v !== "string");
        if (bad) return `\`metadata.${bad[0]}\` must be text. Put quotes around it: \`${bad[0]}: "${bad[1]}"\`.`;
      }
      if (fm["allowed-tools"] !== undefined && typeof fm["allowed-tools"] !== "string")
        return "`allowed-tools` must be one line of space-separated tool names.";
      if (fm.license !== undefined && typeof fm.license !== "string") return "`license` must be text, like `MIT`.";
      const unknown = Object.keys(fm).filter((k) => !KNOWN_FIELDS.has(k));
      if (unknown.length) return `Unknown field(s): ${unknown.join(", ")}. Put extra details under \`metadata:\`.`;
      return null;
    },
  },
  {
    label: "Has instructions below the frontmatter",
    check: (s) =>
      s.body.trim().length >= 40 ? null : "Write the instructions under the frontmatter: what to do, step by step.",
  },
  {
    label: "Uses forward slashes in paths",
    check: (s) =>
      /\b[\w-]+\\[\w.-]+\.(md|py|js|mjs|sh|json|txt)\b/.test(stripCodeBlocks(s.body))
        ? "Use forward slashes in file paths, like `scripts/run.py`, not backslashes."
        : null,
  },
];

const FIRST_PERSON = /(^|[^\w'])(I|I'm|I'll|I've|me|my)(?=[^\w']|$)/;

export const descriptionRules = [
  {
    label: "Description is detailed enough (80+ characters)",
    check: (s) => {
      const d = String(s.frontmatter?.description ?? "");
      return d.length >= 80
        ? null
        : `Only ${d.length} characters. Say what the skill does and when to use it, with the words people actually type.`;
    },
  },
  {
    label: "Description says when to use it",
    check: (s) => {
      const d = String(s.frontmatter?.description ?? "");
      const ok = /\b(use|used|apply|invoke|trigger)\w*\b[^.]{0,60}\bwhen(ever)?\b/i.test(d) || /\bwhen (the )?user\b/i.test(d);
      return ok ? null : "Add a trigger sentence, like: \"Use when the user asks for ...\".";
    },
  },
  {
    label: "Description is in the third person",
    check: (s) => {
      const d = String(s.frontmatter?.description ?? "");
      if (FIRST_PERSON.test(d)) return "Avoid \"I\" and \"my\". Write it like \"Formats invoices ...\", not \"I format invoices\".";
      if (/\byou\b/i.test(d)) return "Avoid \"you\". Write \"Converts ...\" rather than \"You can use this to convert ...\".";
      return null;
    },
  },
  {
    label: "Description is specific, not vague",
    check: (s) => {
      const d = String(s.frontmatter?.description ?? "");
      const vague = d.match(/\b(helps? (you )?with|does stuff|various|stuff|things|etc\.?)(?=\W|$)/i);
      if (vague) return `"${vague[0]}" is vague. Name the actual tasks, file types or keywords.`;
      const words = new Set((d.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []));
      return words.size >= 8 ? null : "Use more specific keywords (file types, tools, actions) so the agent can match requests to it.";
    },
  },
  {
    label: "Name is descriptive",
    check: (s) => {
      const n = String(s.frontmatter?.name ?? "");
      return VAGUE_NAMES.has(n) ? `\`${n}\` is too generic. Try an action, like \`formatting-invoices\`.` : null;
    },
  },
];

export const disclosureRules = [
  {
    label: "Has at least one file in references/",
    check: (s) =>
      listFiles(s, "references").some((f) => f.endsWith(".md"))
        ? null
        : "Move detailed material into a Markdown file in references/, e.g. references/style-guide.md.",
  },
  {
    label: "SKILL.md links to every reference file",
    check: (s) => {
      const refs = listFiles(s, "references").filter((f) => f.endsWith(".md"));
      const linked = new Set(relativeLinks(s.body).map((l) => normalize(l)));
      const missing = refs.filter((r) => !linked.has(r));
      if (!missing.length) return null;
      const text = missing[0].split("/").pop().replace(/\.md$/, "").replace(/-/g, " ");
      return `Link to ${missing.map((m) => `\`${m}\``).join(", ")} from SKILL.md, e.g. \`[${text}](${missing[0]})\`. Unlinked files are never found.`;
    },
  },
  {
    label: "Every relative link in SKILL.md works",
    check: (s) => {
      const broken = relativeLinks(s.body).filter((l) => !exists(s, l));
      return broken.length ? `Broken link(s): ${broken.map((b) => `\`${b}\``).join(", ")}. Check the path and spelling.` : null;
    },
  },
  {
    label: "References are one level deep",
    check: (s) => {
      for (const ref of listFiles(s, "references").filter((f) => f.endsWith(".md"))) {
        const text = readFile(s, ref);
        const nested = relativeLinks(text).find((l) => l.endsWith(".md"));
        if (nested)
          return `\`${ref}\` links to \`${nested}\`. Agents may only skim nested files. Link every file directly from SKILL.md instead.`;
      }
      return null;
    },
  },
  {
    label: "SKILL.md body is under 500 lines",
    check: (s) => {
      const lines = s.body.split("\n").length;
      return lines <= 500 ? null : `The body is ${lines} lines. Move detail into references/ to get under 500.`;
    },
  },
  {
    label: "Long reference files start with a table of contents",
    check: (s) => {
      for (const ref of listFiles(s, "references").filter((f) => f.endsWith(".md"))) {
        const lines = readFile(s, ref).split("\n");
        if (lines.length > 100 && !lines.slice(0, 25).some((l) => /^#{1,3}\s*(contents|table of contents)\b/i.test(l)))
          return `\`${ref}\` is ${lines.length} lines. Add a "## Contents" list near the top so agents see what's inside.`;
      }
      return null;
    },
  },
];

export function runRules(skill, rules) {
  return rules.map((rule) => {
    let message = null;
    try {
      message = rule.check(skill);
    } catch (err) {
      message = `Couldn't check this: ${err.message}`;
    }
    return { label: rule.label, ok: message === null, message };
  });
}

// ---------- Blue belt: setup checks (the script itself is run by the Node grader) ----------

const SCRIPT_CANDIDATES = ["scripts/csv_to_table.py", "scripts/csv_to_table.mjs", "scripts/csv_to_table.js"];
export const findScript = (s) => SCRIPT_CANDIDATES.find((c) => c in s.files);

export const scriptSetupRules = [
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
];

// ---------- Black belt: evaluations and shipping ----------

export const evalRules = [
  {
    label: "Has scripts/ or references/ (more than one file)",
    check: (s) =>
      listFiles(s, "scripts").length || listFiles(s, "references").length
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
      if (!("evals/evals.json" in s.files)) return "Create evals/evals.json. See the Black belt lesson for the format.";
      let data;
      try {
        data = JSON.parse(s.files["evals/evals.json"]);
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
        const data = JSON.parse(s.files["evals/evals.json"] ?? "");
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
export const optionalDisclosure = disclosureRules
  .filter((r) => r.label !== "Has at least one file in references/")
  .map((r) => ({ ...r, check: (s) => (listFiles(s, "references").length ? r.check(s) : null) }));

export const BELT_INFO = [
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
    rules: [...structureRules, ...specRules, ...descriptionRules, ...scriptSetupRules],
  },
  {
    id: "black",
    title: "Black belt",
    lesson: "belts/5-black.md",
    color: "black",
    rules: [...structureRules, ...specRules, ...descriptionRules, ...optionalDisclosure, ...evalRules],
  },
];


// Belt order: your belt is the last one passed with every earlier one passed too
export function summarize(grades, belts) {
  let earned = null;
  for (const g of grades) {
    if (g.status !== "pass") break;
    earned = g.belt;
  }
  const next = belts[earned ? belts.indexOf(earned) + 1 : 0] ?? null;
  return { earned, next };
}

export function gradeSkill(skill, belt) {
  // Stop after structure problems: other rules can't run without a readable SKILL.md
  const structure = runRules(skill, structureRules);
  if (structure.some((r) => !r.ok)) return { belt, status: "fail", skill, results: structure };
  const results = runRules(skill, belt.rules);
  return { belt, status: results.every((r) => r.ok) ? "pass" : "fail", skill, results };
}
