import { test } from "node:test";
import assert from "node:assert/strict";
import { checkChange, checkFork } from "../grader/hall.mjs";

const row = (u = "asha-dev", skill = "drafting-gst-invoices", desc = "Drafts GST invoices with correct tax splits") =>
  `| [@${u}](https://github.com/${u}) | [${skill}](https://github.com/${u}/skillbelt/tree/main/my-belt/black/${skill}) | ${desc} |`;
const base = { changedFiles: ["BLACK_BELTS.md"], removed: [], author: "asha-dev", existing: ["| Black belt | Skill | What it does |"] };
const problems = (o) => checkChange({ ...base, ...o }).problems;

test("valid row passes", () => {
  const r = checkChange({ ...base, added: [row()] });
  assert.deepEqual(r.problems, []);
  assert.equal(r.entry.skill, "drafting-gst-invoices");
});
test("author match is case-insensitive", () => assert.deepEqual(problems({ added: [row()], author: "Asha-Dev" }), []));
test("other files changed", () => assert.match(problems({ added: [row()], changedFiles: ["BLACK_BELTS.md", "README.md"] })[0], /Only change/));
test("removed lines", () => assert.match(problems({ added: [row()], removed: ["| old |"] })[0], /Don't remove/));
test("two rows", () => assert.match(problems({ added: [row(), row("x-y")] })[0], /exactly one/));
test("bad format", () => assert.match(problems({ added: ["| asha | my skill |"] })[0], /format/));
test("someone else's row", () => assert.match(problems({ added: [row()], author: "mallory" })[0], /pull request is from/));
test("mixed usernames", () =>
  assert.match(
    problems({ added: [row().replace("https://github.com/asha-dev)", "https://github.com/other)")] })[0],
    /own username/
  ));
test("already listed", () => assert.match(problems({ added: [row()], existing: [row()] })[0], /already/));
test("links in description rejected", () => assert.match(problems({ added: [row(undefined, undefined, "Buy [stuff](http://spam)")] })[0], /format/));

const fakeFetch = (badge, skillOk = true) => async (url) =>
  url.endsWith("belt.json")
    ? badge
      ? { ok: true, json: async () => badge }
      : { ok: false }
    : { ok: skillOk };

test("fork with black belt passes", async () =>
  assert.deepEqual(await checkFork({ user: "a", skill: "s" }, fakeFetch({ message: "black belt" })), []));
test("fork with lower belt fails", async () =>
  assert.match((await checkFork({ user: "a", skill: "s" }, fakeFetch({ message: "blue belt" })))[0], /blue belt/));
test("fork without badge fails", async () =>
  assert.match((await checkFork({ user: "a", skill: "s" }, fakeFetch(null)))[0], /Couldn't find your badge/));
test("missing skill fails", async () =>
  assert.match((await checkFork({ user: "a", skill: "s" }, fakeFetch({ message: "black belt" }, false)))[0], /SKILL.md/));
