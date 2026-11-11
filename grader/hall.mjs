#!/usr/bin/env node
// Checks a pull request that adds you to BLACK_BELTS.md.
//
// Runs in GitHub Actions on pull requests (see .github/workflows/hall.yml).
// To try it locally:  node grader/hall.mjs --base origin/main --author YOUR-USERNAME
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HALL = "BLACK_BELTS.md";
const USER = "[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}";
const SKILL = "[a-z0-9]+(?:-[a-z0-9]+)*";
export const ROW = new RegExp(
  `^\\| \\[@(${USER})\\]\\(https://github\\.com/(${USER})\\) ` +
    `\\| \\[(${SKILL})\\]\\(https://github\\.com/(${USER})/skillbelt/tree/main/my-belt/black/(${SKILL})\\) ` +
    `\\| ([^|<>\\[\\]]{10,120}) \\|$`
);
export const EXAMPLE =
  "| [@your-username](https://github.com/your-username) | [your-skill](https://github.com/your-username/skillbelt/tree/main/my-belt/black/your-skill) | One line on what your skill does |";

// Checks that need no network. Returns a list of problems (empty = fine).
export function checkChange({ changedFiles, added, removed, author, existing }) {
  const problems = [];
  const others = changedFiles.filter((f) => f !== HALL);
  if (others.length) problems.push(`Only change ${HALL} in this pull request. Also changed: ${others.join(", ")}`);
  if (removed.length) problems.push(`Don't remove or edit existing lines. Removed: ${removed.map((l) => JSON.stringify(l)).join(", ")}`);
  const rows = added.filter((l) => l.trim());
  if (rows.length !== 1) {
    problems.push(`Add exactly one row (found ${rows.length} added lines).`);
    return { problems, entry: null };
  }
  const m = rows[0].trim().match(ROW);
  if (!m) {
    problems.push(`Your row doesn't match the format. Copy this and replace the parts:\n${EXAMPLE}\n\nYou wrote:\n${rows[0]}`);
    return { problems, entry: null };
  }
  const [, user, profile, skillText, repoOwner, skill, description] = m;
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  if (!same(user, profile) || !same(user, repoOwner)) problems.push("Use your own username in all three places in the row.");
  if (skillText !== skill) problems.push(`The link text \`${skillText}\` should match the skill folder \`${skill}\`.`);
  if (author && !same(user, author)) problems.push(`This row is for @${user}, but the pull request is from @${author}. Add your own row.`);
  if (existing.some((l) => l.toLowerCase().includes(`[@${user.toLowerCase()}]`))) problems.push(`@${user} is already in the hall.`);
  return { problems, entry: { user, skill, description: description.trim() } };
}

// Checks against the learner's fork: their badge says black belt and the skill exists.
export async function checkFork({ user, skill }, fetchFn = fetch) {
  const problems = [];
  const raw = `https://raw.githubusercontent.com/${user}/skillbelt`;
  try {
    const res = await fetchFn(`${raw}/badges/belt.json`, { cache: "no-store" });
    if (!res.ok) {
      problems.push(`Couldn't find your badge at ${raw}/badges/belt.json. Push to your fork with Actions enabled so the grader publishes it.`);
    } else {
      const badge = await res.json();
      if (badge.message !== "black belt") problems.push(`Your badge says "${badge.message}". Earn the black belt in your fork first (run \`npm run grade\`).`);
    }
  } catch (err) {
    problems.push(`Couldn't read your badge: ${err.message}`);
  }
  try {
    const res = await fetchFn(`${raw}/main/my-belt/black/${skill}/SKILL.md`, { method: "HEAD" });
    if (!res.ok) problems.push(`Couldn't find my-belt/black/${skill}/SKILL.md on the main branch of your fork.`);
  } catch (err) {
    problems.push(`Couldn't check your skill: ${err.message}`);
  }
  return problems;
}

function diffFromGit(base) {
  const git = (...a) => execFileSync("git", a, { encoding: "utf8" });
  const changedFiles = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
  const patch = git("diff", "--unified=0", `${base}...HEAD`, "--", HALL).split("\n");
  const added = patch.filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
  const removed = patch.filter((l) => l.startsWith("-") && !l.startsWith("---")).map((l) => l.slice(1));
  let existing = [];
  try {
    existing = git("show", `${base}:${HALL}`).split("\n");
  } catch {
    // no hall yet
  }
  return { changedFiles, added, removed, existing };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
  const base = flag("--base") ?? process.env.BASE_SHA ?? "origin/main";
  const author = flag("--author") ?? process.env.PR_AUTHOR ?? "";

  const { problems, entry } = checkChange({ ...diffFromGit(base), author });
  if (entry && !problems.length) problems.push(...(await checkFork(entry)));

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (problems.length) {
    console.log("✗ Not ready yet:\n");
    for (const p of problems) console.log(`- ${p.split("\n").join("\n  ")}\n`);
    if (summary) await appendSummary(summary, `## Not ready yet\n\n${problems.map((p) => `- ${p.replace(/\n/g, "<br>")}`).join("\n")}\n`);
    process.exit(1);
  }
  const msg = `✓ Welcome to the hall, @${entry.user}! Black belt skill: ${entry.skill}`;
  console.log(msg);
  if (summary) await appendSummary(summary, `## 🥋 ${msg}\n`);
}

async function appendSummary(file, md) {
  const fs = await import("node:fs");
  fs.appendFileSync(file, md);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
