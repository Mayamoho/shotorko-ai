/* Turns the deck copy into slides you can actually look at.
 *
 *   node dev/build-deck.mjs
 *
 * pitch/deck-and-qa.md is the only source of truth: this reads its ten slides and
 * their speaker notes and writes pitch/deck.html. Edit the markdown, re-run, the
 * preview is current. Nothing is duplicated, so nothing can disagree with the copy
 * the team is laying out in PowerPoint.
 *
 * The output opens in a browser, is driven by arrow keys, and prints to a 10-page
 * PDF (Ctrl-P, landscape) for the upload. */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "../pitch/deck-and-qa.md");
const OUT = resolve(here, "../pitch/deck.html");

const md = readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const lines = md.split("\n");

/* ── parse ──────────────────────────────────────────────────────── */
const slides = [];
let current = null;
let mode = "";

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const head = /^## Slide (\d+) — (.+)$/.exec(line);
  if (head) {
    current = { n: Number(head[1]), title: head[2], body: [], note: [], noteSeconds: 0 };
    slides.push(current);
    mode = "";
    continue;
  }
  if (!current) continue;

  /* past slide 10 the file becomes the Q&A bank and the layout notes */
  if (/^# /.test(line)) { current = null; mode = ""; continue; }

  const onSlide = /^\*\*On slide\*\*/.test(line);
  const noteHead = /^\*\*Speaker note(?: \((\d+)s\))?\*\*/.exec(line);
  if (onSlide) { mode = "body"; continue; }
  if (noteHead) {
    mode = "note";
    current.noteSeconds = Number(noteHead[1] || 0);
    continue;
  }
  if (mode === "body" && /^>/.test(line)) current.body.push(line.replace(/^>\s?/, ""));
  else if (mode === "body" && /^\s*$/.test(line)) current.body.push("");
  else if (mode === "note" && line.trim()) current.note.push(line.trim().replace(/^"|"$/g, ""));
}

slides.sort((a, b) => a.n - b.n);
const missing = slides.filter(s => !s.note.length).map(s => s.n);
if (missing.length) console.log("  note: no speaker note on slide(s) " + missing.join(", "));

/* ── markdown → html ────────────────────────────────────────────── */
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function isTableLine(l) { return /^\|.*\|\s*$/.test(l.trim()); }
function cells(l) {
  return l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
}

function renderBody(rows) {
  const out = [];
  let para = [], list = null, table = null, hasHeader = false;

  const flushPara = () => { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>` + list.items.map(x => "<li>" + inline(x) + "</li>").join("") + `</${list.tag}>`); list = null; } };
  const flushTable = () => {
    if (!table) return;
    const row = r => "<tr>" + r.map((c, i) => `<td${i === 0 ? ' class="k"' : ""}>` + inline(c) + "</td>").join("") + "</tr>";
    /* a comparison table with no header row stays a comparison table */
    out.push(hasHeader
      ? "<table><thead><tr>" + table[0].map(c => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>"
        + table.slice(1).map(row).join("") + "</tbody></table>"
      : "<table class=\"plain\"><tbody>" + table.map(row).join("") + "</tbody></table>");
    table = null; hasHeader = false;
  };
  const flushAll = () => { flushPara(); flushList(); flushTable(); };

  for (const raw of rows) {
    const line = raw.trimEnd();
    const blank = /^\s*$/.test(line);
    if (blank) { flushAll(); continue; }

    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)(\s+.*)?$/.exec(line.trim());
    if (img) { flushAll(); out.push(`<figure><img src="${esc(img[2])}" alt="${esc(img[1])}"><figcaption>${inline(img[1])}</figcaption></figure>`); continue; }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { flushAll(); const lvl = Math.min(h[1].length + 1, 5); out.push(`<h${lvl}>` + inline(h[2]) + `</h${lvl}>`); continue; }

    if (isTableLine(line)) {
      flushPara(); flushList();
      if (/^\|[\s:|-]+\|$/.test(line.trim())) {          /* the |---|---| rule */
        if (table) hasHeader = table.length === 1;
        continue;
      }
      (table ||= []).push(cells(line));
      continue;
    }
    if (table && !isTableLine(line)) flushTable();

    const ul = /^[-•]\s+(.*)$/.exec(line.trim());
    const ol = /^\d+[.)]\s+(.*)$/.exec(line.trim());
    if (ul || ol) {
      flushPara(); flushTable();
      const tag = ul ? "ul" : "ol";
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push((ul || ol)[1]);
      continue;
    }
    para.push(line.trim());
  }
  flushAll();
  return out.join("\n");
}

/* ── assemble ───────────────────────────────────────────────────── */
const totalNote = slides.reduce((s, x) => s + x.noteSeconds, 0);
const deck = slides.map(s => {
  const secs = s.noteSeconds;
  const chip = secs ? `<span class="timing">${secs}s</span>` : "";
  return `<section class="slide" data-n="${s.n}" aria-label="Slide ${s.n}">
  <header><span class="no">${s.n}<i>/ ${slides.length}</i></span><h2>${inline(s.title)}</h2><span class="over">doesn't fit</span>${chip}</header>
  <div class="body">${renderBody(s.body)}</div>
  <aside class="notes"><b>Speaker note · ${secs || "?"}s</b><p>${inline(s.note.join(" "))}</p></aside>
</section>`;
}).join("\n");

const tabs = slides.map(s => `<button data-go="${s.n}" title="${esc(s.title)}">${s.n}</button>`).join("");

const html = `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shotorko — deck preview (${slides.length} slides)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siluri:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0d1117; --panel:#151b23; --line:#232c38; --ink:#e9eef5; --dim:#9fb0c3;
  --amber:#f5b53f; --green:#4fd6a8; --red:#ff4d43;
  --bangla:"Noto Sans Bengali","Hind Siluri",system-ui,sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#05070a;color:var(--ink);font-family:var(--bangla)}
body{display:flex;flex-direction:column;overflow:hidden}

.deck{flex:1;display:grid;place-items:center;padding:22px 22px 0}
.slide{display:none;width:100%;max-width:1180px;aspect-ratio:16/9;background:var(--bg);
  border:1px solid var(--line);border-radius:18px;padding:38px 46px;overflow:auto;position:relative}
.slide.on{display:flex;flex-direction:column;gap:16px}

.slide header{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--line);padding-bottom:10px}
/* the slide's own headline is the big text; this is a running label, so it must not shout */
.slide header h2{margin:0;font-size:clamp(12px,1.05vw,15px);font-weight:600;letter-spacing:.02em;
  color:var(--dim);text-transform:uppercase;line-height:1.3}
.slide header .no{color:var(--amber);font-weight:800;font-size:clamp(15px,1.5vw,20px)}
.slide header .no i{color:var(--dim);font-style:normal;font-weight:400;font-size:.7em}
.slide header .timing{margin-left:auto;color:var(--dim);font-size:13px;border:1px solid var(--line);border-radius:99px;padding:2px 10px}
.slide header .over{display:none;margin-left:auto;color:#241703;background:var(--red);border-radius:99px;
  padding:2px 10px;font-size:12px;font-weight:700}
.slide.over header .timing{margin-left:12px}
.slide.over header .over{display:block}

.body{flex:1;font-size:clamp(14px,1.42vw,20px);line-height:1.5}
.body p{margin:0 0 .62em}
.body h2,.body h3,.body h4,.body h5{margin:.1em 0 .35em;line-height:1.22;font-weight:800}
.body h2{font-size:1.55em;color:var(--amber)}
.body h3{font-size:1.28em}
.body h4{font-size:1.1em;color:var(--green)}
.body b{color:#fff;font-weight:800}
.body code{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:1px 7px;font-size:.86em;color:var(--amber);word-break:break-word}
.body ul,.body ol{margin:0 0 .62em;padding-left:1.25em}
.body li{margin:.16em 0}
.body table{border-collapse:collapse;width:100%;margin:.1em 0 .7em;font-size:.94em}
.body th,.body td{border-bottom:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}
.body th{color:var(--dim);font-weight:600;font-size:.86em;text-transform:uppercase;letter-spacing:.04em}
.body td.k{color:#fff;font-weight:600}
.body figure{margin:.3em 0 .7em;text-align:center}
.body figure img{max-height:30vh;max-width:100%;border:1px solid var(--line);border-radius:12px;background:#000}
.body figcaption{color:var(--dim);font-size:.74em;margin-top:5px}

.notes{display:none;border-top:1px dashed var(--line);padding-top:10px;color:var(--dim);font-size:.8em;line-height:1.45}
body.notes .slide.on .notes{display:block}
.notes b{color:var(--amber);display:block;margin-bottom:4px;font-size:.9em}

.bar{display:flex;align-items:center;gap:10px;padding:12px 22px 16px;flex-wrap:wrap}
.bar button{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:8px;
  min-width:32px;height:30px;cursor:pointer;font:inherit;font-size:13px}
.bar button.on{background:var(--amber);color:#241703;border-color:var(--amber);font-weight:800}
.bar .sp{flex:1}
.bar .hint{color:var(--dim);font-size:12px}
.bar .total{color:var(--amber);font-size:12px;font-weight:700}

@media print{
  html,body{height:auto;overflow:visible;background:#fff}
  .deck{display:block;padding:0}.bar{display:none}
  .slide{display:block !important;break-after:page;page-break-after:always;border:0;border-radius:0;
    width:100%;max-width:none;aspect-ratio:auto;min-height:96vh;padding:12mm 14mm;background:#fff;color:#111}
  .slide header{border-color:#ccc}.slide header h2,.slide header .no{color:#111}
  .slide header .no{color:#b26a00}
  .body{color:#111}.body b,.body td.k{color:#000}.body code{background:#f2f2f2;color:#8a5200;border-color:#ddd}
  .body th{color:#666}.body td,.body th{border-color:#ddd}
  .notes{display:block !important;color:#444;border-color:#bbb}
  .slide header .over{display:none !important}
  .body figure img{max-height:60mm}
}
</style>
</head>
<body>
<div class="deck" id="deck">
${deck}
</div>
<div class="bar">
  <button data-step="-1">←</button><button data-step="1">→</button>
  ${tabs}
  <span class="sp"></span>
  <span class="hint">← → space · <b>N</b> notes · <b>F</b> fullscreen · Ctrl-P prints 10 pages</span>
  <span class="total">notes ${totalNote}s ≈ ${Math.round(totalNote / 60 * 10) / 10} min</span>
  <button id="toggle-notes">notes</button>
</div>
<script>
const slides=[...document.querySelectorAll(".slide")];
const tabs=[...document.querySelectorAll("[data-go]")];
let i=0;
function show(n){
  i=Math.max(0,Math.min(slides.length-1,n));
  slides.forEach((s,k)=>s.classList.toggle("on",k===i));
  tabs.forEach((t,k)=>t.classList.toggle("on",k===i));
  slides[i].scrollTop=0;
  fit(slides[i]);
  location.hash=i+1;
}
/* the preview's job is to tell you what will not fit on a projector at this size */
function fit(s){
  const px = s.scrollHeight - s.clientHeight;
  const over = px > 6;
  s.classList.toggle("over", over);
  s.querySelector(".over").textContent = over
    ? "runs over by " + Math.round(px / s.clientHeight * 100) + "%"
    : "";
}
addEventListener("resize",()=>fit(slides[i]));
addEventListener("keydown",e=>{
  if(e.key==="ArrowRight"||e.key===" "||e.key==="PageDown"){e.preventDefault();show(i+1);}
  else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();show(i-1);}
  else if(e.key==="Home"){show(0);} else if(e.key==="End"){show(slides.length-1);}
  else if(e.key==="n"||e.key==="N"){document.body.classList.toggle("notes");}
  else if(e.key==="f"||e.key==="F"){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();}
});
document.querySelector(".bar").addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b) return;
  if(b.dataset.step) show(i+Number(b.dataset.step));
  else if(b.dataset.go) show(Number(b.dataset.go)-1);
  else if(b.id==="toggle-notes") document.body.classList.toggle("notes");
});
document.getElementById("deck").addEventListener("click",e=>{
  if(e.target.closest("a")||e.target.closest("img")) return;
  show(i + (e.clientX > innerWidth*0.6 ? 1 : e.clientX < innerWidth*0.4 ? -1 : 0));
});
const fromHash=Number((location.hash||"").slice(1));
show(Number.isFinite(fromHash)&&fromHash>0?fromHash-1:0);
<\/script>
</body></html>`;

writeFileSync(OUT, html);
const secs = slides.map(s => `${s.n}:${s.noteSeconds || "?"}`).join(" ");
console.log(`${slides.length} slides → pitch/deck.html`);
console.log(`  note seconds  ${secs}  = ${totalNote}s total`);
for (const s of slides) {
  const words = s.body.join(" ").split(/\s+/).filter(Boolean).length;
  if (words > 150) console.log(`  ⚠ slide ${s.n} carries ${words} words — a projector reads about 90`);
}
