/* Records the deployed prototype playing its own story, for slide 5 as insurance
 * against a venue network that will not cooperate.
 *
 *   node dev/record.mjs [url] [seconds]
 *
 * Writes dev/clip/shotorko-story.mp4 — the real page, the real engine, the real
 * timings, captured from the same URL the QR points at. Nothing is animated
 * afterwards; if this clip is good enough to present, it is good enough because
 * it is the demo. */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const URL_SITE = (process.argv[2] || "https://abukawser.xyz").replace(/\/$/, "");
const SECONDS = Number(process.argv[3] || 46);
const FPS = 5;
const PORT = 9302;
const DIR = new URL("../dev/clip/", import.meta.url).pathname;
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR + "frames", { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn("/snap/bin/chromium", [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
  `--remote-debugging-port=${PORT}`, "--user-data-dir=/tmp/shotorko-record",
  "--window-size=1440,1250", "--hide-scrollbars", URL_SITE,
], { stdio: "ignore" });

let target = null;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find(t => t.type === "page" && t.webSocketDebuggerUrl);
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

await sleep(3500);
await js(`document.querySelector("#run-btn").click(); true`);
console.log(`recording ${SECONDS}s of the story from ${URL_SITE}`);

const frames = DIR + "frames/";
const each = 1000 / FPS;
let n = 0;
const startedAt = Date.now();
while (Date.now() - startedAt < SECONDS * 1000) {
  const frameStarted = Date.now();
  /* jpeg, not png: the capture is the bottleneck and 5 fps is the floor for a clip
   * worth presenting. Quality 72 is past the point where a projector shows the diff. */
  const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 72 });
  writeFileSync(frames + String(n).padStart(4, "0") + ".jpg", Uint8Array.from(atob(data), c => c.charCodeAt(0)));
  n++;
  if (n % 25 === 0) console.log(`  ${n} frames · ${Math.round((Date.now() - startedAt) / 1000)}s`);
  const left = each - (Date.now() - frameStarted);
  if (left > 0) await sleep(left);
}
chrome.kill("SIGKILL");
console.log(`  ${n} frames captured, encoding`);

const out = DIR + "shotorko-story.mp4";
const elapsed = (Date.now() - startedAt) / 1000;
/* the capture rate is whatever the browser could keep up with, and the clip must
 * play at the speed the demo actually ran, so derive fps instead of assuming it */
const realFps = (n / elapsed).toFixed(3);
const ff = spawnSync("ffmpeg", [
  "-y", "-loglevel", "error", "-framerate", realFps, "-i", frames + "%04d.jpg",
  "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", out,
], { stdio: "inherit" });
if (ff.status !== 0) { console.error("ffmpeg failed"); process.exit(1); }
console.log(`\n${out} — ${n} frames over ${elapsed.toFixed(1)}s (${realFps} fps)`);
