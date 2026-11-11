// Skillbelt playground: edit a skill in the browser and see every belt's checks live.
import { BELT_INFO, gradeSkill, parseSkill, summarize } from "../../grader/lib/rules.mjs";
import { EXAMPLES } from "./examples.js";
import { BELT_COLORS, beltSvg, esc, inlineCode, LESSON_URL } from "./ui.js";

const STORE = "skillbelt-playground-v1";
const $ = (sel) => document.querySelector(sel);

let state = loadInitial();
let chosenBelt = null; // null = follow the first belt that isn't passed yet

// ---------- State ----------

function fromExample(ex) {
  return { folder: ex.folder, files: { ...ex.files }, active: "SKILL.md" };
}

function loadInitial() {
  const shared = readShareHash();
  if (shared) return shared;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (saved?.files?.["SKILL.md"] !== undefined) return { ...saved, active: "SKILL.md" };
  } catch {
    // storage unavailable: start fresh
  }
  return fromExample(EXAMPLES[0]);
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ folder: state.folder, files: state.files }));
  } catch {
    // private mode etc.
  }
}

// ---------- Share links (the whole skill, compressed into the URL) ----------

const fromB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function makeShareUrl() {
  const json = new TextEncoder().encode(JSON.stringify({ folder: state.folder, files: state.files }));
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let b64 = "";
  for (let i = 0; i < bytes.length; i += 8192) b64 += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `${location.origin}${location.pathname}#s=${btoa(b64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

let pendingShare = null;
function readShareHash() {
  const m = location.hash.match(/^#s=([\w-]+)$/);
  if (!m) return null;
  // Decompression is async; show a placeholder and swap in when ready
  pendingShare = (async () => {
    try {
      const stream = new Blob([fromB64(m[1])]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      const data = JSON.parse(await new Response(stream).text());
      if (typeof data?.files?.["SKILL.md"] !== "string") throw new Error("no SKILL.md");
      return { folder: String(data.folder || "shared-skill"), files: data.files, active: "SKILL.md" };
    } catch {
      toast("That share link is broken, so the last skill was opened instead.");
      return null;
    }
  })();
  return null;
}

// ---------- Grading ----------

// Blue is a set exercise (a csv-to-table skill) and Black must be your own skill,
// so one skill counts towards one of them, not both.
function gradeAllBelts() {
  const skill = parseSkill({ dir: `my-belt/…/${state.folder}`, folder: state.folder, files: state.files });
  const grades = BELT_INFO.map((belt) => gradeSkill(skill, belt));
  const skip = state.folder === "csv-to-table" ? "black" : "blue";
  const path = grades.filter((g) => g.belt.id !== skip);
  return { skill, grades, skip, ...summarize(path, path.map((g) => g.belt)) };
}

// ---------- Rendering ----------

function renderFiles() {
  const tabs = $("#tabs");
  tabs.innerHTML = Object.keys(state.files)
    .sort((a, b) => (a === "SKILL.md" ? -1 : b === "SKILL.md" ? 1 : a.localeCompare(b)))
    .map(
      (f) => `<div class="tab${f === state.active ? " is-active" : ""}" role="presentation">
        <button role="tab" aria-selected="${f === state.active}" data-file="${esc(f)}">${esc(f)}</button>${
          f === "SKILL.md" ? "" : `<button class="tab-x" data-remove="${esc(f)}" aria-label="Remove ${esc(f)}">×</button>`
        }</div>`
    )
    .join("");
  const editor = $("#editor");
  if (editor.value !== state.files[state.active]) editor.value = state.files[state.active];
  editor.setAttribute("aria-label", `Contents of ${state.active}`);
  $("#folder").value = state.folder;
  updateGutter();
}

function updateGutter() {
  const n = $("#editor").value.split("\n").length;
  $("#gutter").textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
}

function renderResults() {
  const { grades, earned, next, skip } = gradeAllBelts();
  const firstOpen = grades.find((g) => g.belt.id !== skip && g.status !== "pass") ?? grades.find((g) => g.belt.id === (earned?.id ?? "white"));
  const current = grades.find((g) => g.belt.id === chosenBelt) ?? firstOpen;

  // The belt: colored by the highest belt this skill earns
  $("#belt").innerHTML = beltSvg(earned ? earned.id : null);
  $("#belt-title").textContent = earned ? `${earned.title}` : "No belt yet";
  $("#belt-sub").textContent = !earned
    ? "Fix the checks below to earn your White belt."
    : next
      ? `Next: ${next.title}.`
      : earned.id === "blue"
        ? "Passes the setup checks. Run npm run grade to test the script itself."
        : "This skill passes every check the browser can run.";

  // Belt picker
  $("#belts").innerHTML = grades
    .map((g) => {
      const failed = g.results.filter((r) => !r.ok).length;
      const state = g.belt.id === skip ? "skip" : g.status === "pass" ? "pass" : "fail";
      return `<button role="tab" class="belt-tab is-${state}" aria-selected="${g === current}" data-belt="${g.belt.id}"
        style="--belt:${BELT_COLORS[g.belt.id]}"><span class="swatch" aria-hidden="true"></span>${g.belt.title.replace(" belt", "")}
        <span class="count">${state === "skip" ? "–" : g.status === "pass" ? "✓" : failed}</span><span class="sr-only">${state === "skip" ? "not for this skill" : g.status === "pass" ? "passed" : `${failed} to fix`}</span></button>`;
    })
    .join("");

  // Checks for the selected belt: problems first
  const failing = current.results.filter((r) => !r.ok);
  const passing = current.results.filter((r) => r.ok);
  const lesson = LESSON_URL(current.belt.lesson);
  let html = "";
  if (current.belt.id === skip)
    html += `<p class="note">${skip === "blue"
      ? "Blue belt is a set exercise: a skill named <code>csv-to-table</code> with a script. This skill counts towards Black instead."
      : "Black belt needs your own skill, not the <code>csv-to-table</code> exercise."}</p>`;
  if (current.belt.id === skip) {
    $("#checks").innerHTML = `${html}<a class="lesson" href="${lesson}" target="_blank" rel="noopener">Read the ${current.belt.title} lesson</a>`;
    $("#checks-title").textContent = `${current.belt.title} checks`;
    return;
  }
  if (!failing.length) {
    html += `<p class="all-good">Every ${current.belt.title} check passes.</p>`;
  } else {
    html += `<ol class="checks">${failing
      .map((r) => `<li class="check is-fail"><span class="mark" aria-hidden="true">✗</span><div><p class="label">${inlineCode(r.label)}</p><p class="fix">${inlineCode(r.message)}</p></div></li>`)
      .join("")}</ol>`;
  }
  if (current.belt.id === "blue")
    html += `<p class="note">Your script's 9 test runs happen on your computer: <code>npm run grade -- blue</code>.</p>`;
  if (passing.length)
    html += `<details class="passed"><summary>${passing.length} passed</summary><ul class="checks">${passing
      .map((r) => `<li class="check is-pass"><span class="mark" aria-hidden="true">✓</span><p class="label">${inlineCode(r.label)}</p></li>`)
      .join("")}</ul></details>`;
  html += `<a class="lesson" href="${lesson}" target="_blank" rel="noopener">Read the ${current.belt.title} lesson</a>`;
  $("#checks").innerHTML = html;
  $("#checks-title").textContent = `${current.belt.title} checks`;
}

let timer = null;
function onChange() {
  updateGutter();
  clearTimeout(timer);
  timer = setTimeout(() => {
    renderResults();
    save();
  }, 120);
}

let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

// ---------- Events ----------

function bind() {
  const editor = $("#editor");
  editor.addEventListener("input", () => {
    state.files[state.active] = editor.value;
    onChange();
  });
  editor.addEventListener("scroll", () => ($("#gutter").scrollTop = editor.scrollTop));
  editor.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || e.shiftKey || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const { selectionStart: a, selectionEnd: b } = editor;
    editor.setRangeText("  ", a, b, "end");
    editor.dispatchEvent(new Event("input"));
  });

  $("#folder").addEventListener("input", (e) => {
    state.folder = e.target.value.trim();
    onChange();
  });

  $("#tabs").addEventListener("click", (e) => {
    const open = e.target.closest("[data-file]");
    const remove = e.target.closest("[data-remove]");
    if (remove) {
      delete state.files[remove.dataset.remove];
      if (state.active === remove.dataset.remove) state.active = "SKILL.md";
      renderFiles();
      onChange();
    } else if (open) {
      state.active = open.dataset.file;
      renderFiles();
      editor.focus();
    }
  });

  $("#add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#new-file");
    const name = input.value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!name) return;
    if (!/^[\w.-]+(\/[\w.-]+)*$/.test(name) || name.split("/").includes("..")) {
      toast("Use a path like references/guide.md");
      return;
    }
    if (!(name in state.files)) state.files[name] = name.endsWith(".json") ? "[]\n" : `# ${name.split("/").pop().replace(/\.\w+$/, "")}\n\n`;
    state.active = name;
    input.value = "";
    renderFiles();
    onChange();
    editor.focus();
  });

  for (const btn of document.querySelectorAll("[data-suggest]"))
    btn.addEventListener("click", () => {
      $("#new-file").value = btn.dataset.suggest;
      $("#new-file").focus();
    });

  $("#belts").addEventListener("click", (e) => {
    const b = e.target.closest("[data-belt]");
    if (!b) return;
    chosenBelt = b.dataset.belt;
    renderResults();
  });

  $("#example").addEventListener("change", (e) => {
    const ex = EXAMPLES.find((x) => x.id === e.target.value);
    e.target.value = "";
    if (!ex) return;
    state = fromExample(ex);
    chosenBelt = null;
    history.replaceState(null, "", location.pathname);
    renderFiles();
    renderResults();
    save();
    toast(`Opened: ${ex.title}`);
  });

  $("#share").addEventListener("click", async () => {
    try {
      const url = await makeShareUrl();
      history.replaceState(null, "", url);
      await navigator.clipboard.writeText(url);
      toast("Link copied. Anyone with it sees this skill and its checks.");
    } catch {
      toast("Couldn't copy. The link is in your address bar.");
    }
  });

  $("#download").addEventListener("click", downloadZip);
}

// ---------- Download as a .zip (stored, no compression; tiny and dependency-free) ----------

function crc32(bytes) {
  let c, crc = 0xffffffff;
  for (const b of bytes) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function downloadZip() {
  const enc = new TextEncoder();
  const folder = state.folder || "my-skill";
  const entries = Object.entries(state.files).map(([p, text]) => ({ name: enc.encode(`${folder}/${p}`), data: enc.encode(text) }));
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const crc = crc32(e.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, e.data.length, true); local.setUint32(22, e.data.length, true);
    local.setUint16(26, e.name.length, true);
    parts.push(local, e.name, e.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, e.data.length, true); cd.setUint32(24, e.data.length, true);
    cd.setUint16(28, e.name.length, true); cd.setUint32(42, offset, true);
    central.push(cd, e.name);
    offset += 30 + e.name.length + e.data.length;
  }
  const size = central.reduce((n, p) => n + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  const url = URL.createObjectURL(new Blob([...parts, ...central, end], { type: "application/zip" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${folder}.zip` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Downloaded ${folder}.zip. Unzip it into .claude/skills/ to use it.`);
}

// ---------- Start ----------

bind();
renderFiles();
renderResults();
if (pendingShare)
  pendingShare.then((shared) => {
    if (!shared) return;
    state = shared;
    renderFiles();
    renderResults();
  });
