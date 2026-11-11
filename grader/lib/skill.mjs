// Reads a skill folder and checks it against the Agent Skills specification
// (https://agentskills.io/specification) and the skill-authoring best practices.
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RESERVED_WORDS = ["anthropic", "claude"];
const VAGUE_NAMES = new Set([
  "helper", "helpers", "util", "utils", "tool", "tools", "misc", "stuff",
  "documents", "data", "files", "skill", "my-skill", "test", "example",
]);
const KNOWN_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);

// ---------- Loading ----------

export function loadSkill(dir) {
  const skill = {
    dir,
    folder: path.basename(dir),
    exists: false,
    raw: "",
    frontmatter: null,
    frontmatterError: null,
    body: "",
  };
  const file = path.join(dir, "SKILL.md");
  if (!fs.existsSync(file)) return skill;
  skill.exists = true;
  skill.raw = fs.readFileSync(file, "utf8").replace(/^﻿/, "");

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

export function listFiles(dir, sub = "") {
  const root = path.join(dir, sub);
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const rel = sub ? `${sub}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(dir, rel));
    else out.push(rel);
  }
  return out;
}

// ---------- Rule sets ----------
// Each rule: { label, check(skill) → null when fine, or a message saying how to fix it }

export const structureRules = [
  {
    label: "Has a SKILL.md file",
    check: (s) => (s.exists ? null : `Create ${path.join(s.dir, "SKILL.md")} (exact name, capital letters).`),
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
      listFiles(s.dir, "references").some((f) => f.endsWith(".md"))
        ? null
        : "Move detailed material into a Markdown file in references/, e.g. references/style-guide.md.",
  },
  {
    label: "SKILL.md links to every reference file",
    check: (s) => {
      const refs = listFiles(s.dir, "references").filter((f) => f.endsWith(".md"));
      const linked = new Set(relativeLinks(s.body).map((l) => path.posix.normalize(l)));
      const missing = refs.filter((r) => !linked.has(r));
      return missing.length
        ? `Link to ${missing.map((m) => `\`${m}\``).join(", ")} from SKILL.md, e.g. [style guide](${missing[0]}). Unlinked files are never found.`
        : null;
    },
  },
  {
    label: "Every relative link in SKILL.md works",
    check: (s) => {
      const broken = relativeLinks(s.body).filter((l) => !fs.existsSync(path.join(s.dir, l)));
      return broken.length ? `Broken link(s): ${broken.map((b) => `\`${b}\``).join(", ")}. Check the path and spelling.` : null;
    },
  },
  {
    label: "References are one level deep",
    check: (s) => {
      for (const ref of listFiles(s.dir, "references").filter((f) => f.endsWith(".md"))) {
        const text = fs.readFileSync(path.join(s.dir, ref), "utf8");
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
      for (const ref of listFiles(s.dir, "references").filter((f) => f.endsWith(".md"))) {
        const lines = fs.readFileSync(path.join(s.dir, ref), "utf8").split("\n");
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
