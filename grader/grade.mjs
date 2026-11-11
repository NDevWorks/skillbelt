#!/usr/bin/env node
// Grades your skills in my-belt/ and tells you which belt you've earned.
//
//   npm run grade                 check every belt
//   npm run grade -- yellow       check one belt
//
// In GitHub Actions it also writes a summary and the badge file.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BELTS, gradeAll } from "./lib/belts.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const ROOT = flag("--root")
  ? path.resolve(flag("--root"))
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const only = args.find((a) => BELTS.some((b) => b.id === a));

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = (t) => paint(32, t);
const red = (t) => paint(31, t);
const dim = (t) => paint(2, t);
const bold = (t) => paint(1, t);

const { grades, earned, next } = gradeAll(ROOT);
const shown = only ? grades.filter((g) => g.belt.id === only) : grades;

// ---------- Terminal report ----------

console.log(bold("\nSkillbelt\n"));
for (const g of shown) {
  const name = g.skill ? dim(` (${path.relative(ROOT, g.skill.dir)})`) : "";
  if (g.status === "todo") {
    console.log(`${dim("○")} ${g.belt.title}${dim("  not started. Read " + g.belt.lesson)}`);
    continue;
  }
  const icon = g.status === "pass" ? green("●") : red("●");
  const passed = g.results.filter((r) => r.ok).length;
  console.log(`${icon} ${bold(g.belt.title)}${name}  ${dim(`${passed}/${g.results.length} checks`)}`);
  for (const r of g.results) {
    if (r.ok) {
      if (only) console.log(`   ${green("✓")} ${r.label}`);
    } else {
      console.log(`   ${red("✗")} ${r.label}`);
      console.log(`     ${r.message.split("\n").join("\n     ")}`);
    }
  }
}

console.log();
if (earned) console.log(`Your belt: ${bold(earned.title)}`);
else console.log("Your belt: none yet");
if (next) console.log(`Next: ${next.title}. Read ${next.lesson}`);
else console.log(green("You've earned every belt. Add yourself to BLACK_BELTS.md (see belts/5-black.md)."));
console.log();

// ---------- Badge (shields.io endpoint format) ----------

const badgePath = flag("--badge");
if (badgePath) {
  const badge = {
    schemaVersion: 1,
    label: "skillbelt",
    message: earned ? earned.title.toLowerCase() : "no belt yet",
    color: earned ? earned.color : "inactive",
    namedLogo: "github",
  };
  fs.mkdirSync(path.dirname(badgePath), { recursive: true });
  fs.writeFileSync(badgePath, JSON.stringify(badge, null, 2) + "\n");
}

// ---------- GitHub Actions job summary ----------

const summaryPath = flag("--summary");
if (summaryPath) {
  const esc = (t) => t.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  let md = `## ${earned ? `🥋 ${earned.title}` : "No belt yet"}\n\n`;
  const repo = process.env.GITHUB_REPOSITORY ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${process.env.GITHUB_REPOSITORY}/blob/HEAD/` : "";
  md += next
    ? `Next up: **${next.title}**. Read [${next.lesson}](${repo}${next.lesson}).\n\n`
    : `Every belt earned. Add yourself to the [Hall of Black Belts](https://github.com/NDevWorks/skillbelt/blob/main/belts/5-black.md#join-the-hall-of-black-belts)!\n\n`;
  for (const g of grades) {
    if (g.status === "todo") {
      md += `○ ${g.belt.title}: not started<br>\n\n`;
      continue;
    }
    const where = g.skill ? ` · <code>${path.relative(ROOT, g.skill.dir).split(path.sep).join("/")}</code>` : "";
    const passed = g.results.filter((r) => r.ok).length;
    if (g.status === "pass") {
      // Passing belts fold into one line, so failures stand out
      md += `<details><summary><strong>✅ ${g.belt.title}</strong>${where} · ${passed}/${g.results.length} checks</summary>\n\n`;
      md += "| | Check |\n|---|---|\n";
      for (const r of g.results) md += `| ✅ | ${esc(r.label)} |\n`;
      md += "\n</details>\n\n";
      continue;
    }
    md += `### ❌ ${g.belt.title}${where} · ${passed}/${g.results.length} checks\n\n`;
    md += "| | Check | How to fix |\n|---|---|---|\n";
    for (const r of g.results.filter((r) => !r.ok)) md += `| ❌ | ${esc(r.label)} | ${esc(r.message)} |\n`;
    md += `\n${passed} other checks passed.\n\n`;
  }
  fs.appendFileSync(summaryPath, md);
}

// Fail only when something you started is broken, so a red ✗ always means "fix me"
const broken = shown.some((g) => g.status === "fail");
process.exit(broken ? 1 : 0);
