/* Re-captures the deck screenshots from the URL the QR on slide 10 points at.
 *
 *   node dev/shoot.mjs [url]
 *
 * Two outputs per screen: dev/shots/<screen>.png is the whole presenter page, for
 * the HTML deck preview, and dev/shots/devices/<screen>.png is the handset only at
 * 2× — the thing that actually fits on a PowerPoint slide.
 *
 * Nothing is posed: the page's own "Play the story" runs and the shutter fires the
 * moment each screen comes up, so every shot is a frame of the demo a judge watches. */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const URL_SITE = (process.argv[2] || "https://abukawser.xyz").replace(/\/$/, "");
const PORT = 9301;
const OUT = new URL("../dev/shots/", import.meta.url).pathname;
/* A profile inside the workspace, wiped every run. The app restores its module
 * from location.hash and chromium restores the last session's URL, so a reused
 * profile opens this run already on #console — and every shot after it is the
 * same screen. /tmp is no good: the snap gives chromium a private one. */
const PROFILE = new URL("../dev/.shoot-profile/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
mkdirSync(OUT + "devices", { recursive: true });
rmSync(PROFILE, { recursive: true, force: true });
const KEYS = ["home", "precall", "during", "thamun", "aponjon", "agent", "after", "radar", "console"];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn("/snap/bin/chromium", [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--no-restore-session-state",
  "--window-size=1440,1250", "--hide-scrollbars", URL_SITE,
], { stdio: "ignore" });

let target = null;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const pages = list.filter(t => t.type === "page" && t.webSocketDebuggerUrl);
    target = pages.find(t => (t.url || "").startsWith(URL_SITE)) || pages[0];
  } catch { /* browser still booting */ }
}
if (!target) { chrome.kill("SIGKILL"); console.error("no CDP page target"); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });

let nextId = 1;
const waiting = new Map();
ws.onmessage = ev => {
  const msg = JSON.parse(ev.data);
  const settle = waiting.get(msg.id);
  if (settle) { waiting.delete(msg.id); msg.error ? settle.no(new Error(msg.error.message)) : settle.ok(msg.result); }
};
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((ok, no) => {
    waiting.set(id, { ok, no });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); no(new Error(method + " timed out")); } }, 40000);
  });
}
async function js(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "page threw");
  return r.result.value;
}

await send("Page.navigate", { url: URL_SITE });

/* Which single element carries each screen. The full-page shot is for the deck
 * preview; the cropped device shot is what goes on a slide — a whole dashboard
 * shrunk into a PowerPoint is unreadable, a phone is not. */
const DEVICE = {
  home: "#ammu-device",
  precall: "#basic-device .phone",
  during: "#ammu-device",
  thamun: "#ammu-device",
  aponjon: "#son-device .phone",
  agent: "#ammu-device",
  after: "#ammu-device",
  radar: "#ammu-device",
  console: "#ammu-device",
};

/* Centre the handset in the window first: a clip that reaches past the viewport
 * comes back half-blank unless the page has actually drawn that part. The header
 * is sticky at z-index 40, so a stitched clip would catch it painted across the
 * middle of the phone — unstick everything sticky before cropping. */
async function unstick() {
  await js(`(() => { for (const el of document.querySelectorAll("header, .rail")) el.style.position = "static"; return true; })()`);
}

async function boxOf(sel) {
  const raw = await js(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return "";
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height });
  })()`);
  return raw ? JSON.parse(raw) : null;
}

/* First selector that exists wins, so one shot can cover either verdict. */
async function crop(file, selectors) {
  for (const sel of selectors) {
    const b = await boxOf(sel);
    if (b && b.w > 40 && b.h > 40) {
      const { data } = await send("Page.captureScreenshot", {
        format: "png", captureBeyondViewport: true,
        clip: { x: b.x - 8, y: b.y - 8, width: b.w + 16, height: b.h + 16, scale: 2 },
      });
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      writeFileSync(OUT + "devices/" + file + ".png", bytes);
      return `${Math.round(b.w)}×${Math.round(b.h)} → ${Math.round(bytes.length / 1024)} KB`;
    }
  }
  return "";
}

async function shot(name) {
  await js(`scrollTo(0, 0); true`);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  writeFileSync(OUT + name + ".png", bytes);
  let extra = "";

  const sel = DEVICE[name];
  if (sel) {
    const size = await crop(name, [sel]);
    extra = size ? `  + device ${size}` : "  ! no device crop";
  }
  console.log(`  ${String(bytes.length / 1024).padStart(4, " ")} KB  ${name}.png${extra}`);
}

await sleep(3500);
await unstick();
await shot("home");                       /* the story starts on a quiet screen */

await js(`document.querySelector("#run-btn").click(); true`);

const seen = new Set(["home"]);
let waited = 0;
while (seen.size < KEYS.length && waited < 180_000) {
  await sleep(300); waited += 300;

  /* the family circle is a state, not a story step: the pause screen grows it and
   * the tab beside থামুন shows it. Open the tab the way a presenter would. */
  if (!seen.has("aponjon")) {
    const alerting = await js(`state.resolved === "family" && state.sonState === "alert"`);
    if (alerting) {
      seen.add("aponjon");
      await js(`document.querySelector('[data-m="aponjon"]').click(); true`);
      await sleep(700);
      await shot("aponjon");
      await js(`document.querySelector('[data-m="thamun"]').click(); true`);
      continue;
    }
  }

  const key = await js(`state.module`);
  if (!key || seen.has(key) || !KEYS.includes(key)) continue;
  /* the pause and the complaint land a beat after the screen does, and the
   * console's last story step is the classifier call itself */
  if (key === "console") {
    /* the slide wants the hosted verdict, so flip the page's own switch and re-run
     * the classifier on whatever the story typed. If the provider is out of quota
     * the page answers on-device and the shot is still a real result. */
    await js(`(() => { const b = document.querySelector("#engine-live"); if (b) b.click(); return true; })()`);
    await sleep(400);
    await js(`document.querySelector('[data-action="run-console"]').click(); true`);
    for (let i = 0; i < 25; i++) {
      await sleep(1000);
      if (await js(`!!state.lastResult && !document.querySelector("#busy")`)) break;
    }
    const engine = await js(`state.lastResult && state.lastResult.engine`);
    console.log(`       console answered with engine=${engine}`);
  } else if (key === "after" || key === "thamun") await sleep(1500);
  seen.add(key);
  await shot(key);
}

/* the console with a real verdict in it, not an empty box */
if (!seen.has("console")) { seen.add("console"); await shot("console"); }
const hasVerdict = await js(`!!state.lastResult`);
if (!hasVerdict) {
  const typed = "থানার ওসি বলে ফোন করছিল, আমার ছেলেকে ইয়াবাসহ ধরা হয়েছে, মামলা না চাইলে এখনই ৩০ হাজার টাকা বিকাশ করতে বলল, কাউকে বলতে মানা করল";
  await js(`(() => { const ta = document.querySelector("#ctext"); ta.value = ${JSON.stringify(typed)};
    ta.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
  await js(`document.querySelector('[data-action="run-console"]').click(); true`);
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (await js(`!!state.lastResult && !document.querySelector("#busy")`)) break;
  }
  await shot("console");
}

/* the verdict card on its own — slide 6 wants the evidence, not the whole page,
 * and a 928×1244 dashboard shrunk into a projector is unreadable */
const v = await crop("verdict", ["#ammu-screen .card.stop", "#ammu-screen .card.ok"]);
console.log(v ? `  verdict.png  ${v}` : "  ! no verdict card on screen");

const missing = KEYS.filter(k => !seen.has(k));
chrome.kill("SIGKILL");
console.log(missing.length
  ? `\nMISSED ${missing.join(", ")} — the story never showed those screens`
  : `\n${KEYS.length} screenshots from ${URL_SITE} → dev/shots/`);
process.exit(missing.length ? 1 : 0);
