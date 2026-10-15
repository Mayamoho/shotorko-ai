/* Drives the deployed prototype in a real browser and flips it to the hosted
 * engine, because curl proves the API and only the page proves the demo.
 *
 *   node dev/live-probe.mjs [url]
 *
 * Needs a chromium that speaks CDP; nothing is installed and nothing is clicked
 * by hand. Exits non-zero if the live path does not render. */

const URL_SITE = process.argv[2] || "https://abukawser.xyz";
const PORT = 9299;
const { spawn } = await import("node:child_process");

const chrome = spawn("/snap/bin/chromium", [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
  `--remote-debugging-port=${PORT}`, "--user-data-dir=/tmp/shotorko-cdp", URL_SITE,
], { stdio: "ignore" });

const sleep = ms => new Promise(r => setTimeout(r, ms));
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

const steps = [];
let v = "";
function note(name, value, pass) { steps.push({ name, value, pass }); console.log(`${pass ? "  ok  " : " FAIL "} ${name}\n       ${value}`); }

await sleep(2500);

/* the hosted toggle only appears once the page's own health probe gets ok:true,
 * and that first request pays for a cold route, so wait for it instead of
 * assuming the page is ready at load */
let reveal = null;
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  reveal = await js(`JSON.stringify({
    hidden: document.querySelector("#engine-switch").classList.contains("hide"),
    badge: document.querySelector("#engine-badge").textContent.trim()
  })`);
  if (!JSON.parse(reveal).hidden) break;
}
note("live toggle revealed by the page's health probe", reveal, !JSON.parse(reveal).hidden);

/* flip to the live engine */
v = await js(`document.querySelector("#engine-live").click(); JSON.stringify({ engine: state.engine, badge: document.querySelector("#engine-badge").textContent.trim() })`);
note("switch to Live agent", v, JSON.parse(v).engine === "live");

/* run the try-it-yourself console on the real scam transcript */
const text = "থানার ওসি বলে ফোন করছিল, আমার ছেলেকে ইয়াবাসহ ধরা হয়েছে, মামলা না চাইলে এখনই ৩০ হাজার টাকা বিকাশ করতে বলল, কাউকে বলতে মানা করল";
await js(`location.hash = "console"`);
await sleep(400);
await js(`(() => { const ta = document.querySelector("#ctext"); ta.value = ${JSON.stringify(text)};
  ta.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`);
await js(`document.querySelector('[data-action="run-console"]').click(); true`);

let result = null, screenText = "";
for (let i = 0; i < 40; i++) {
  await sleep(1000);
  const probe = await js(`JSON.stringify({
    engine: state.lastResult && state.lastResult.engine,
    risk: state.lastResult && state.lastResult.risk,
    pause: state.lastResult && state.lastResult.wouldPause,
    keys: (state.lastResult && state.lastResult.hits || []).map(h => h.key || h),
    fallback: state.lastResult && state.lastResult.fallbackReason || null,
    busy: !!document.querySelector("#busy"),
    body: document.querySelector("#ammu-screen").innerText.slice(0, 900)
  })`);
  const j = JSON.parse(probe);
  if (j.engine) { result = j; screenText = j.body; break; }
  if (i === 39) result = j;
}

note("console answered through the hosted engine", JSON.stringify({ ...result, body: undefined }),
  result.engine === "live" && typeof result.risk === "number" && !result.fallback);

/* Google's free tier has a per-day quota, so a throttled run is a real state to
 * test rather than a bug to chase: the page must still show a verdict, silently
 * on the on-device engine. */
const throttled = !!result.fallback && /429/.test(String(result.fallback));
note("throttled by the provider's daily quota", throttled ? String(result.fallback) : "not throttled", true);
note("a throttled classifier still answers on-device", JSON.stringify({ engine: result.engine, risk: result.risk, keys: result.keys }),
  throttled ? result.engine === "local" && result.keys.length > 0 : true);

note("this transcript must trigger the pause", `wouldPause=${result.pause} (${typeof result.pause})`, result.pause === true);
note("signals came back as server keys", JSON.stringify(result.keys), result.keys.length > 0);

/* the failure this would have caught: objects rendering as [object Object] */
const broken = /\[object Object\]/.test(screenText);
const hasBanglaLabel = /টাকা পাঠাতে বলা|ভুয়া ক্ষমতা|গোপন কোড|কাউকে বলতে নিষেধ|তাড়াতাড়ি/.test(screenText);
note("chips render as labels, not objects", broken ? "[object Object] found" : "clean", !broken && hasBanglaLabel);

/* now prove the on-device engine still answers when the network cannot */
await js(`document.querySelector("#engine-local").click(); true`);
v = await js(`JSON.stringify({ engine: state.engine, badge: document.querySelector("#engine-badge").textContent.trim() })`);
note("switch back to on-device", v, JSON.parse(v).engine === "local");

/* the complaint writer over the wire */
await js(`location.hash = "after"`);
await sleep(500);
await js(`document.querySelector('[data-action="make-complaint"]').click(); true`);
let drafted = null;
for (let i = 0; i < 40; i++) {
  await sleep(1000);
  drafted = await js(`(() => { const b = document.querySelector("#ammu-screen"); return JSON.stringify({
    hasDraft: /প্রতিবেদন|অভিযোগ|বিকাশ|টাকা/.test(b.innerText), len: b.innerText.length,
    busy: !!document.querySelector("#busy") }) })()`);
  const j = JSON.parse(drafted);
  if (j.hasDraft && !j.busy) { drafted = j; break; }
  if (i === 39) drafted = j;
}
note("spoken report became a written complaint", JSON.stringify(drafted), drafted.hasDraft === true);

chrome.kill("SIGKILL");
const failed = steps.filter(s => !s.pass);
console.log(failed.length
  ? `\nLIVE PROBE FAILED (${failed.length} of ${steps.length} checks)`
  : `\nLIVE PROBE PASSED (${steps.length} checks on ${URL_SITE})`);
process.exit(failed.length ? 1 : 0);
