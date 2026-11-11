// Belt card: reads a learner's progress.json from their fork and draws a shareable image.
import { BELT_INFO } from "../../grader/lib/rules.mjs";
import { BELT_COLORS, beltSvg, STITCH } from "./ui.js";

const $ = (s) => document.querySelector(s);
const USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const W = 1200;
const H = 630;
const C = { paper: "#F4F5F2", ink: "#17191E", muted: "#5D6370", line: "#DCDED8" };

let current = null; // { user, progress }

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 3000);
}

function setStatus(msg, error = false) {
  $("#status").textContent = msg;
  $("#status").classList.toggle("is-error", error);
}

async function fetchProgress(user) {
  const base = `https://raw.githubusercontent.com/${user}/skillbelt/badges`;
  const bust = `?t=${Math.floor(Date.now() / 60000)}`;
  const res = await fetch(`${base}/progress.json${bust}`);
  if (res.ok) return res.json();
  // Forks graded before cards existed only have belt.json
  const badge = await fetch(`${base}/belt.json${bust}`);
  if (!badge.ok) return null;
  const b = await badge.json();
  const belt = BELT_INFO.find((x) => `${x.title.toLowerCase()}` === b.message)?.id ?? null;
  const passed = belt ? BELT_INFO.slice(0, BELT_INFO.findIndex((x) => x.id === belt) + 1).map((x) => x.id) : [];
  return { user, belt, passed, skills: {} };
}

const loadImage = (src, cors) =>
  new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

function fitText(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

async function draw(user, p) {
  await Promise.all([
    document.fonts.load('800 64px "Schibsted Grotesk"'),
    document.fonts.load('600 24px "Schibsted Grotesk"'),
    document.fonts.load('400 22px "JetBrains Mono"'),
  ]);
  const canvas = $("#card");
  const ctx = canvas.getContext("2d");
  const belt = BELT_INFO.find((b) => b.id === p.belt) ?? null;

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);

  // Belt band across the top in the earned color
  const band = belt ? BELT_COLORS[belt.id] : "#E6E8E3";
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 22);
  if (belt?.id === "white") {
    ctx.fillStyle = C.line;
    ctx.fillRect(0, 22, W, 2);
  }

  // Avatar
  const avatar = await loadImage(`https://avatars.githubusercontent.com/${user}?s=192`, true);
  const ax = 72, ay = 82, ar = 48;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, ax, ay, ar * 2, ar * 2);
  else {
    ctx.fillStyle = C.line;
    ctx.fillRect(ax, ay, ar * 2, ar * 2);
  }
  ctx.restore();

  ctx.fillStyle = C.muted;
  ctx.font = '600 26px "Schibsted Grotesk", system-ui, sans-serif';
  ctx.fillText(fitText(ctx, `@${user}`, 520), 196, 122);
  ctx.font = '400 22px "Schibsted Grotesk", system-ui, sans-serif';
  ctx.fillText("on Skillbelt", 196, 156);

  // Headline
  ctx.fillStyle = C.ink;
  ctx.font = '800 76px "Schibsted Grotesk", system-ui, sans-serif';
  ctx.fillText(belt ? belt.title : "No belt yet", 72, 278);
  ctx.font = '400 26px "Schibsted Grotesk", system-ui, sans-serif';
  ctx.fillStyle = C.muted;
  ctx.fillText(
    belt?.id === "black" ? "Earned every belt for writing AI agent skills." : belt ? "Earned for writing AI agent skills (SKILL.md)." : "Learning to write AI agent skills.",
    72,
    324
  );

  // The belt itself, on the right
  const svg = beltSvg(belt?.id ?? null).replace("<svg ", `<svg width="640" height="132" `);
  const beltImg = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  if (beltImg) ctx.drawImage(beltImg, 700, 96, 430, 89);

  // One row per belt: swatch, belt, skill name
  const rowY = 392;
  BELT_INFO.forEach((b, i) => {
    const y = rowY + i * 38;
    const done = p.passed?.includes(b.id);
    ctx.globalAlpha = done ? 1 : 0.4;
    ctx.fillStyle = BELT_COLORS[b.id];
    ctx.fillRect(72, y - 16, 34, 16);
    ctx.strokeStyle = b.id === "white" ? "#B9BDB4" : STITCH[b.id];
    ctx.lineWidth = 1.5;
    ctx.strokeRect(72, y - 16, 34, 16);
    ctx.fillStyle = C.ink;
    ctx.font = '600 22px "Schibsted Grotesk", system-ui, sans-serif';
    ctx.fillText(b.title.replace(" belt", ""), 122, y);
    ctx.font = '400 20px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = done ? C.ink : C.muted;
    const skill = p.skills?.[b.id]?.name;
    ctx.fillText(fitText(ctx, done ? skill ?? "passed" : "not yet", 560), 232, y);
    ctx.globalAlpha = 1;
  });

  // Footer
  ctx.fillStyle = C.line;
  ctx.fillRect(840, 400, 2, 160);
  ctx.fillStyle = C.ink;
  ctx.font = '800 30px "Schibsted Grotesk", system-ui, sans-serif';
  ctx.fillText("Skillbelt", 872, 448);
  ctx.fillStyle = C.muted;
  ctx.font = '400 20px "Schibsted Grotesk", system-ui, sans-serif';
  ctx.fillText("Free course for writing", 872, 484);
  ctx.fillText("AI agent skills", 872, 512);
  ctx.font = '400 18px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText("skillbelt.vercel.app", 872, 552);

  canvas.setAttribute(
    "aria-label",
    `${user}: ${belt ? belt.title : "no belt yet"} on Skillbelt. ` +
      BELT_INFO.filter((b) => p.passed?.includes(b.id)).map((b) => `${b.title}: ${p.skills?.[b.id]?.name ?? "passed"}`).join(". ")
  );
}

async function show(user) {
  user = user.trim().replace(/^@/, "");
  if (!USER_RE.test(user)) {
    setStatus("That doesn't look like a GitHub username.", true);
    return;
  }
  setStatus(`Looking up ${user}…`);
  $("#card-wrap").hidden = true;
  let progress = null;
  try {
    progress = await fetchProgress(user);
  } catch {
    setStatus("Couldn't reach GitHub. Check your connection and try again.", true);
    return;
  }
  if (!progress) {
    setStatus(
      `No Skillbelt progress found for ${user}. They need to fork the course, turn on Actions in the fork, and push once.`,
      true
    );
    return;
  }
  current = { user, progress };
  await draw(user, progress);
  const belt = BELT_INFO.find((b) => b.id === progress.belt);
  const pageUrl = `${location.origin}/card/?u=${encodeURIComponent(user)}`;
  const text = belt ? `I earned the ${belt.title} on Skillbelt, a free course for writing AI agent skills.` : "I'm learning to write AI agent skills on Skillbelt.";
  $("#share-linkedin").href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;
  $("#share-x").href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`;
  $("#snippet").textContent = `[![Skillbelt](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/${user}/skillbelt/badges/belt.json)](${pageUrl})`;
  $("#title").textContent = belt ? `${user}: ${belt.title}` : `${user} on Skillbelt`;
  $("#lede").textContent = belt
    ? `Belts and skills ${user} earned on Skillbelt, the free course for writing AI agent skills.`
    : `${user} has started Skillbelt but hasn't passed a belt yet.`;
  document.title = `${user} · Skillbelt`;
  $("#card-wrap").hidden = false;
  setStatus("");
  history.replaceState(null, "", `?u=${encodeURIComponent(user)}`);
}

$("#lookup").addEventListener("submit", (e) => {
  e.preventDefault();
  show($("#user").value);
});

$("#download").addEventListener("click", () => {
  if (!current) return;
  $("#card").toBlob((blob) => {
    if (!blob) {
      toast("Couldn't create the image in this browser.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `skillbelt-${current.user}.png` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
});

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast("Couldn't copy. Select the text and copy it instead.");
  }
}
$("#copy").addEventListener("click", () => copy(location.href, "Link copied."));
$("#copy-snippet").addEventListener("click", () => copy($("#snippet").textContent, "Copied. Paste it into your profile README."));

const initial = new URLSearchParams(location.search).get("u");
if (initial) {
  $("#user").value = initial;
  show(initial);
}
