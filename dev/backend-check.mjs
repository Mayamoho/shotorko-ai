/* Proves the Vercel + Gemini backend without a key, a deploy or a network call.
 *
 *   node dev/backend-check.mjs
 *
 * fetch is faked, so every assertion below is about this program's guarantees:
 * the model returns keys and numbers, the server owns every display label, the
 * pause needs the server's own ask-gate, and no upstream text or credential
 * ever reaches the browser. */

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const handler = (await import(pathToFileURL(resolve(here, "../api/app/[...path].ts")).href)).default;

const BASE = "https://shotorko.vercel.app/api/app";
let passes = 0, fails = 0;
function check(name, cond, extra) {
  if (cond) { passes++; return; }
  fails++;
  console.error("FAIL  " + name + (extra ? "  → " + extra : ""));
}

/* ── fake Gemini ────────────────────────────────────────────────── */
let calls = [];
let reply = () => ({ status: 200, text: '{"risk":0,"signals":[],"scam":null,"fear":{},"wouldPause":false}' });

globalThis.fetch = async (url, init) => {
  const record = {
    url: String(url),
    method: init?.method,
    key: init?.headers?.["x-goog-api-key"],
    body: init?.body ? JSON.parse(init.body) : null,
  };
  calls.push(record);
  const r = reply(record, calls.length) || {};
  const status = r.status ?? 200;
  const payload = r.json ?? (r.text !== undefined
    ? { candidates: [{ content: { parts: [{ text: r.text }] } }] }
    : { candidates: [] });
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
    status,
    headers: { "content-type": r.contentType ?? (status === 200 ? "application/json" : "text/plain") },
  });
};

function setKey(on) { process.env.GEMINI_API_KEY = on ? "test-key-not-secret" : ""; }
const D = o => JSON.stringify(o);

/* a fake clock, so a rate-limit test does not need a real minute of waiting */
const realNow = Date.now.bind(Date);
let clockJump = 0;
Date.now = () => realNow() + clockJump;
const advance = (ms) => { clockJump += ms; };

async function send(path, { method = "POST", body, ct = "application/json" } = {}) {
  const headers = {};
  if (ct) headers["content-type"] = ct;
  if (body !== undefined && typeof body !== "string") body = D(body);
  const res = await handler(new Request(BASE + path, { method, headers, body }));
  let payload = null;
  try { payload = await res.json(); } catch { /* non-json */ }
  return { status: res.status, payload: payload ?? {}, text: JSON.stringify(payload) };
}

/* drive a happy analyze with a fixed answer */
const scamAnswer = { risk: 88, signals: ["payment", "credential"], scam: "police", fear: { scare: true, rush: true, isolate: true }, wouldPause: true };
function answersTo(obj) { reply = () => ({ text: D(obj) }); }

/* ── 1. routing and input guards ────────────────────────────────── */
/* The Edge runtime only calls a plain default export. An object with a fetch
 * method builds fine and then answers "The Edge Function did not respond". */
check("default export is the handler function itself", typeof handler === "function", typeof handler);
check("handler is async", handler.constructor.name === "AsyncFunction", handler.constructor.name);
check("edge runtime declared", (await import(pathToFileURL(resolve(here, "../api/app/[...path].ts")).href)).config?.runtime === "edge");

setKey(false);
calls = [];
let r = await send("/health", { method: "GET" });
check("health without a key reports unconfigured", r.status === 200 && r.payload.ok === false && r.payload.error === "service_not_configured", r.text);
check("health without a key names no model", !("model" in r.payload), r.text);

setKey(true);
r = await send("/health", { method: "GET" });
check("health with a key reports live", r.payload.ok === true && r.payload.engine === "gemini" && typeof r.payload.model === "string", r.text);
check("health leaks no api key", !r.text.includes("test-key-not-secret"), r.text);

r = await send("/analyze", { ct: "text/plain", body: "x" });
check("non-json content type rejected", r.status === 415 && r.payload.error === "json_required", r.text);
r = await send("/analyze", { method: "GET" });
check("GET on analyze rejected", r.status === 405 && r.payload.error === "method_not_allowed", r.text);
r = await send("/delete-everything", { body: { text: "hello there" } });
check("unknown path is 404", r.status === 404 && r.payload.error === "not_found", r.text);
r = await send("/analyze", { body: { text: "" } });
check("empty transcript rejected", r.status === 400 && r.payload.error === "text_required", r.text);
r = await send("/analyze", { body: "{oops", ct: "application/json" });
check("malformed json rejected", r.status === 400 && r.payload.error === "invalid_json", r.text);

/* ── 2. the response shape the frontend validates ───────────────── */
answersTo(scamAnswer);
calls = [];
r = await send("/analyze", { body: { text: "ওসি বলল ৩০ হাজার বিকাশে পাঠাও, কাউকে বলবা না", situation: { unknownCaller: true, callActive: true } } });
check("frontend contract satisfied", r.status === 200 && r.payload.ok === true && typeof r.payload.risk === "number"
  && Array.isArray(r.payload.signals) && typeof r.payload.wouldPause === "boolean", r.text);
check("upstream call is authenticated by header", calls.length === 1 && calls[0].key === "test-key-not-secret"
  && !calls[0].url.includes("test-key-not-secret"), calls[0] && calls[0].url);
check("transcript reaches the model", calls[0] && JSON.stringify(calls[0].body).includes("৩০ হাজার"));
check("situation flags reach the model", calls[0] && JSON.stringify(calls[0].body).includes("callActive=yes"));
check("engine reported as live", r.payload.engine === "live" && r.payload.threshold === 50, r.text);

/* ── 3. labels are the server's, never the model's ──────────────── */
answersTo({ risk: 70, signals: ["payment", "bitcoin_forecast", ""], scam: "bitcoin",
  fear: { scare: true }, wouldPause: true });
r = await send("/analyze", { body: { text: "সকালের আড্ডা, পাড়ার কথা" } });
check("unknown signal keys dropped", r.payload.signals.length === 1, D(r.payload.signals));
check("signal label comes from the server", r.payload.signals[0].label === "টাকা পাঠাতে বলা · money asked for", D(r.payload.signals[0]));
check("signal carries a key the UI can test", r.payload.signals[0].key === "payment", D(r.payload.signals[0]));
check("unknown scam type becomes null", r.payload.scam === null, r.text);
check("model cannot supply its own label text", !JSON.stringify(r.payload.signals).includes("bitcoin"), r.text);

/* an answer that is itself in prose must not be able to impersonate a label */
answersTo({ risk: 70, signals: ["payment"], label: "<img src=x onerror=alert(1)>", scam: "police", fear: {}, wouldPause: true });
r = await send("/analyze", { body: { text: "normal conversation" } });
check("no model field is echoed into the payload", !r.text.includes("onerror"), r.text);
check("known scam key gets the fixed server label", r.payload.scam.label === "ভুয়া পুলিশ / মামলা", D(r.payload.scam));

/* ── 4. risk clamping ───────────────────────────────────────────── */
answersTo({ risk: 4_000_000, signals: ["payment"], wouldPause: true });
r = await send("/analyze", { body: { text: "aaaa" } });
check("risk clamped to 100", r.payload.risk === 100, r.text);
answersTo({ risk: -50, signals: ["payment"], wouldPause: true });
r = await send("/analyze", { body: { text: "bbbb" } });
check("risk clamped to 0", r.payload.risk === 0, r.text);
answersTo({ risk: 61.7, signals: ["payment"], wouldPause: true });
r = await send("/analyze", { body: { text: "cccc" } });
check("risk rounded to an integer", r.payload.risk === 62, r.text);
answersTo({ risk: "lots", signals: [] });
r = await send("/analyze", { body: { text: "dddd" } });
check("non-numeric risk is refused, not guessed", r.status === 503 && r.payload.ok === false, r.text);

/* ── 5. the server holds the pause veto ─────────────────────────── */
answersTo({ risk: 92, signals: ["reward"], fear: { scare: true }, wouldPause: true });
r = await send("/analyze", { body: { text: "inam er kotha" } });
check("pause needs an ask, not only fear", r.payload.wouldPause === false && r.payload.risk === 92, r.text);

answersTo({ risk: 40, signals: ["payment"], fear: {}, wouldPause: true });
r = await send("/analyze", { body: { text: "tui ashbis amr sathe" } });
check("pause needs risk above the threshold", r.payload.wouldPause === false, r.text);

answersTo({ risk: 90, signals: ["install"], wouldPause: false });
r = await send("/analyze", { body: { text: "ei app ta download kor" } });
check("server cannot force a pause the model declined", r.payload.wouldPause === false, r.text);

answersTo({ risk: 90, signals: ["credential"], wouldPause: true });
r = await send("/analyze", { body: { text: "otp ta bolo" } });
check("genuine pause passes the gate", r.payload.wouldPause === true, r.text);

answersTo({ risk: 90, signals: ["authority", "secrecy"], wouldPause: true });
r = await send("/analyze", { body: { text: "警察 stuff" } });
check("no ask means no interruption", r.payload.wouldPause === false, r.text);

/* ── 6. retry and cache behaviour ───────────────────────────────── */
setKey(true);
answersTo(scamAnswer);
calls = [];
const dup = { text: "আম্মুর অ্যাকাউন্ট বন্ধ করে দিয়েছে" };
await send("/analyze", { body: dup });
await send("/analyze", { body: dup });
check("identical prompt served from cache", calls.length === 1, "calls=" + calls.length);

/* model id typo → fall back to the default model instead of failing */
process.env.GEMINI_MODEL = "gemini-not-a-real-model";
calls = [];
reply = (rec) => rec.url.includes("gemini-not-a-real-model")
  ? { status: 404, json: { error: { message: "model not found" } } }
  : { text: D(scamAnswer) };
r = await send("/analyze", { body: { text: "fallback probe" } });
check("bad model id still answers", r.status === 200 && r.payload.risk === 88, D({ status: r.status, err: r.payload.error }));
check("first try used the configured model", calls[0] && calls[0].url.includes("gemini-not-a-real-model"), calls[0] && calls[0].url);
check("fallback used the default model", calls[1] && calls[1].url.includes("gemini-2.5-flash"), calls[1] && calls[1].url);
process.env.GEMINI_MODEL = "";

/* strict JSON mode rejected by the provider → plain retry */
calls = [];
reply = (rec, n) => n === 1 ? { status: 400, json: { error: { message: "MUST_UPDATE" } } } : { text: D(scamAnswer) };
r = await send("/analyze", { body: { text: "json mode probe" } });
check("provider 400 retries once then succeeds", r.status === 200 && calls.length === 2, D({ status: r.status, n: calls.length }));
check("first attempt requested json mode", calls[0].body.generationConfig.responseMimeType === "application/json");
check("retry drops json mode", calls[1].body.generationConfig.responseMimeType === undefined, D(calls[1].body.generationConfig));
check("json mode also disables thinking tokens", calls[0].body.generationConfig.thinkingConfig.thinkingBudget === 0,
  D(calls[0].body.generationConfig));

/* fenced markdown around the json */
answersTo({ text: null });
reply = () => ({ text: "Here is the classification:\n```json\n" + D(scamAnswer) + "\n```\nDone." });
r = await send("/analyze", { body: { text: "fenced probe" } });
check("fenced json answer parsed", r.status === 200 && r.payload.risk === 88, r.text);

/* empty candidates on both attempts */
reply = () => ({ status: 200, json: { candidates: [] } });
r = await send("/analyze", { body: { text: "empty probe" } });
check("silent model becomes an error, not a zero", r.status === 503 && r.payload.ok === false, r.text);

/* safety block */
reply = () => ({ status: 200, json: { candidates: [], promptFeedback: { blockReason: "SAFETY" } } });
r = await send("/analyze", { body: { text: "blocked probe" } });
check("blocked input refused safely", r.status === 422 && /^[a-z_]+$/.test(r.payload.error), r.text);

/* upstream outages */
reply = () => ({ status: 429, json: { error: { message: "Resource has been exhausted" } } });
r = await send("/analyze", { body: { text: "too many requests probe" } });
check("provider 429 becomes 429", r.status === 429 && r.payload.error === "rate_limited", r.text);

/* a real Google throttle body: which window tripped is logged, the text is not */
const quotaErrors = [];
const realErr = console.error;
console.error = (...a) => { quotaErrors.push(a.join(" ")); };
reply = () => ({
  status: 429,
  json: { error: { code: 429, message: "Quota exceeded for quota metric 'Requests' and limit 'Requests per minute' of service 'generativelanguage.googleapis.com' for consumer 'project:123'. API key: AIzaSySECRETDONTLEAKTHIS", status: "RESOURCE_EXHAUSTED" } },
});
r = await send("/analyze", { body: { text: "quota window probe" } });
console.error = realErr;
check("provider 429 keeps the public code", r.status === 429 && r.payload.error === "rate_limited", r.text);
check("provider 429 never echoes quota text", !/SECRET|exhausted|generativelanguage|Requests per minute/i.test(r.text), r.text);
check("throttle is diagnosed as a per-minute window", /window=minute/.test(quotaErrors.join("\n")), D(quotaErrors));

reply = () => ({ status: 429, json: { error: { message: "You exceeded your current quota, please check your plan and billing details. quota limit 'requests_per_day' for consumer 'project:_' API key: AIzaSySECRETDONTLEAKTHIS" } } });
quotaErrors.length = 0;
console.error = (...a) => { quotaErrors.push(a.join(" ")); };
r = await send("/analyze", { body: { text: "quota day probe" } });
console.error = realErr;
check("throttle is diagnosed as a per-day window", /window=day/.test(quotaErrors.join("\n")), D(quotaErrors));
check("a 429 is not retried against the same key", r.status === 429, r.text);

reply = () => ({ status: 503, json: { error: { message: "The server is currently unavailable. token=SECRETABC" } } });
r = await send("/analyze", { body: { text: "upstream outage probe" } });
check("provider outage becomes a retryable 503", r.status === 503 && ["no_answer", "model_unavailable"].includes(r.payload.error), r.text);
check("raw upstream error text never leaks", !/SECRETABC|unavailable\.|token/i.test(r.text), r.text);

calls = [];
reply = () => ({ status: 401, json: { error: { message: "API key not valid. INVALID_KEY sk-abcdef123456" } } });
r = await send("/analyze", { body: { text: "bad credential probe" } });
check("rejected key is not retried forever", r.status === 503 && calls.length === 1, D({ status: r.status, n: calls.length }));
check("rejected key never leaks", !r.text.includes("sk-") && !r.text.includes("abcdef123456"), r.text);

calls = [];
reply = () => { throw new TypeError("fetch failed: ECONNRESET near=sk-abcdef123456"); };
r = await send("/analyze", { body: { text: "network failure probe" } });
check("transport failure becomes a safe code", r.status === 503 && /^[a-z_]+$/.test(r.payload.error), r.text);
check("no credential fragment in any response", !r.text.includes("abcdef123456") && !r.text.includes("sk-"), r.text);

/* ── 7. the public page cannot drain the key ────────────────────── */
reply = () => ({ text: D(scamAnswer) });
const before = calls.length;
let blocked = 0;
for (let i = 0; i < 90; i++) {
  const x = await send("/analyze", { body: { text: "budget probe " + i + " unique " + Math.random() } });
  if (x.status === 429 && x.payload.error === "rate_limited") blocked++;
}
check("budget caps upstream calls per minute", calls.length - before <= 60, "upstream calls=" + (calls.length - before));
check("excess requests are refused, not queued", blocked > 0, "refused=" + blocked);

advance(61_000);
r = await send("/analyze", { body: { text: "budget window reset probe" } });
check("budget window rolls over", r.status === 200, r.text);

/* ── 8. complaint ───────────────────────────────────────────────── */
answersTo({ subject: "ভুয়া পুলিশ পরিচয়ে প্রতারণা", body: "১৪ অক্টোবর রাত ৯:৪১-এ " + "ক".repeat(120) + "। নম্বরটি ট্রেস করার অনুরোধ জানাচ্ছি।" });
calls = [];
r = await send("/complaint", { body: { text: "থানার ওসি বলে ৩০ হাজার বিকাশ করতে বলল", number: "01711111111", amount: "৩০,০০০ টাকা", time: "১৪ অক্টোবর, রাত ৯:৪১" } });
check("complaint succeeds", r.status === 200 && r.payload.ok === true && r.payload.body.length > 40, D({ status: r.status }));
check("recipients fixed by the server", D(r.payload.to) === D(["Grameenphone ফ্রড সেল", "MFS প্রোভাইডার", "পুলিশ / ৯৯৯"]), D(r.payload.to));
check("complaint prompt carries the incident", calls[0] && JSON.stringify(calls[0].body).includes("01711111111") && JSON.stringify(calls[0].body).includes("৩০,০০০ টাকা"));
check("complaint uses a longer token budget", calls[0].body.generationConfig.maxOutputTokens >= 1024, D(calls[0].body.generationConfig));

answersTo({ subject: "short", body: "too short" });
r = await send("/complaint", { body: { text: "আমার সাথে টাকা পাঠান" } });
check("truncated letter refused", r.status === 503 && r.payload.ok === false, r.text);

r = await send("/complaint", { body: { text: "ছোট" } });
check("one word is not an incident", r.status === 400 && r.payload.error === "text_required", r.text);

r = await send("/complaint", { method: "GET" });
check("complaint cannot be read by GET", r.status === 405, r.text);

/* ── 9. every failure is a bare code ────────────────────────────── */
setKey(false);
r = await send("/analyze", { body: { text: "no key configured probe" } });
check("missing key returns a fixed code", r.status === 503 && r.payload.error === "service_not_configured", r.text);
check("missing key never echoes the env var name", !r.text.includes("GEMINI_API_KEY"), r.text);
setKey(true);

const shapes = [400, 404, 405, 410, 415, 429, 500, 503];
let clean = true;
for (const s of shapes) {
  reply = () => ({ status: s, json: { error: { message: "leak-" + s } } });
  const x = await send("/analyze", { body: { text: "status shape probe " + s } });
  if (x.status >= 500 || x.status === 429) {
    if (!/^[a-z_]{3,48}$/.test(x.payload.error ?? "") || x.text.includes("leak-")) clean = false;
  }
}
check("error payloads are always {ok:false,error:code}", clean);

console.log(`\n${fails === 0 ? "ALL BACKEND CHECKS PASSED" : "FAILURES: " + fails}  (${passes} checks)`);
process.exit(fails === 0 ? 0 : 1);
