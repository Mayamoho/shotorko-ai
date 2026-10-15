/* Shotorko backend for Vercel — Google Gemini inference.
 *
 * Same response contract as the Qoder Sites Function, so web/assets/app.js is
 * unchanged and one frontend runs on either host. Safety properties kept on
 * purpose: the model returns signal KEYS only, every display label comes from
 * the table below, and the pause needs the server's own ask-gate to fire.
 *
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL (optional override).
 */

declare const process: { env: { GEMINI_API_KEY?: string; GEMINI_MODEL?: string } };

const API = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_ANALYZE_MS = 18000;
const MAX_COMPLAINT_MS = 28000;

type Json = Record<string, unknown>;

const SIGNALS: Record<string, string> = {
  authority: "ভুয়া ক্ষমতা · fake authority",
  leverage: "আপনজনের বিপদ · loved one in trouble",
  urgency: "তাড়াতাড়ি করা হচ্ছে · being rushed",
  secrecy: "কাউকে বলতে নিষেধ · told to stay silent",
  credential: "গোপন কোড চাওয়া · secret code asked",
  payment: "টাকা পাঠাতে বলা · money asked for",
  reward: "লোভ দেখানো · tempting reward",
  install: "অ্যাপ বা স্ক্রিন শেয়ার · app or screen share",
};

const SCAM_TYPES: Record<string, string> = {
  police: "ভুয়া পুলিশ / মামলা",
  account: "অ্যাকাউন্ট ব্লক / ভুয়া MFS অফিসার",
  otp: "ওটিপি / অ্যাকাউন্ট হ্যাক",
  emergency: "আপনজনের জরুরি বিপদ",
  refund: "ভুল পাঠানো / রিফান্ড",
  prize: "ইনাম / চাকরি / ঋণ",
  forward: "কল ফরোয়ার্ডিং দখল",
  remote: "ফেক অ্যাপ / স্ক্রিন শেয়ার",
};

const THRESHOLD = 50;
const COMPLAINT_TO = ["Grameenphone ফ্রড সেল", "MFS প্রোভাইডার", "পুলিশ / ৯৯৯"];

const SYSTEM_ANALYZE = `You are the on-call fraud classifier for Shotorko, a Bangladeshi phone-scam
intervention service. You read ONE stretch of call transcript, exactly as a cheap Android phone
would, and decide whether to interrupt the user.

Input is Bangla, Banglish (Bangla typed in Latin letters) or mixed, in any dialect spelling.
Judge intent, never individual words: the same sentence is harmless from a saved contact at noon
and dangerous from an unknown caller mid-call.

Return JSON with:
risk: integer 0-100.
signals: array, zero or more of authority, leverage, urgency, secrecy, credential, payment, reward, install.
scam: one of police, account, otp, emergency, refund, prize, forward, remote, or null.
fear: object of booleans scare, rush, isolate.
wouldPause: boolean, true only when the caller is applying fear AND asking the listener to move
money, hand over a code, forward calls or install something.

Ordinary commerce, family talk, delivery calls and wrong numbers must not pause. A false alarm
costs a user their trust in the product, so when unsure, do not pause.`;

const SYSTEM_COMPLAINT = `You write fraud complaints for Shotorko, a Bangladeshi phone-scam service.
The victim has spoken what happened, in Bangla, often in a dialect, sometimes upset and unclear.

Turn that account into ONE complaint letter in standard Bangla that can be filed as-is with the
Grameenphone fraud cell, an MFS provider and the police.

State only what the victim said. Never invent a number, an amount, a date, a name, a thana or a
section of law. Keep sentences short and factual. Reproduce any phone number, amount, app name
and time exactly as given. End by asking for the number to be traced.

Return JSON with: subject (short Bangla subject line) and body (the letter, \\n between paragraphs).`;

/* ── plumbing ───────────────────────────────────────────────────── */
const now = () => Date.now();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// Static property access: the Edge runtime cannot index process.env dynamically.
function envOf(allowed: "GEMINI_API_KEY" | "GEMINI_MODEL"): string {
  if (typeof process === "undefined" || !process.env) return "";
  const raw = allowed === "GEMINI_API_KEY" ? process.env.GEMINI_API_KEY : process.env.GEMINI_MODEL;
  return typeof raw === "string" ? raw.trim() : "";
}
const apiKey = () => envOf("GEMINI_API_KEY");
function model(): string {
  const v = envOf("GEMINI_MODEL");
  return /^[A-Za-z0-9._-]{1,64}$/.test(v) ? v : DEFAULT_MODEL;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "";
}
function flag(v: unknown): boolean { return v === true; }

/* ── cache + budget: a public page must not be able to drain the key ── */
const CACHE = new Map<string, { at: number; val: Json }>();
const CACHE_MS = 15 * 60 * 1000;
const BUDGET = 60;
let slots = 0;
let windowAt = 0;

async function cached(key: string, make: () => Promise<Json>): Promise<Json> {
  const hit = CACHE.get(key);
  if (hit && now() - hit.at < CACHE_MS) return hit.val;
  const val = await make();
  if (CACHE.size > 120) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(key, { at: now(), val });
  return val;
}

// Counted per logical request, so a cache hit is free and a retry is not.
function spend(): void {
  if (now() - windowAt > 60_000) { windowAt = now(); slots = 0; }
  if (slots + 1 > BUDGET) throw new Error("rate_limited");
  slots += 1;
}
const sleepMs = (ms: number) => new Promise<void>(ok => setTimeout(ok, ms));

async function fingerprint(parts: unknown[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

/* ── Gemini ─────────────────────────────────────────────────────── */
let pinnedModel = "";
let pinnedFor = "";

// Remember which name actually answered, but never past a configuration change.
function currentModel(): string {
  const wanted = model();
  if (pinnedFor !== wanted) { pinnedFor = wanted; pinnedModel = ""; }
  return pinnedModel || wanted;
}

async function gemini(system: string, prompt: string, deadline: number, maxTokens: number): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error("service_not_configured");
  spend();
  const names = [...new Set([currentModel(), DEFAULT_MODEL])];
  for (const name of names) {
    if (deadline - now() < 800) break;
    try {
      const text = await callGemini(name, key, system, prompt, maxTokens, deadline);
      pinnedModel = name;
      return text;
    } catch (err) {
      // A bad model id is the only failure worth trying another name for.
      if (code(err) === "model_not_found") continue;
      throw err;
    }
  }
  throw new Error(names.length > 1 ? "model_unavailable" : "no_answer");
}

async function callGemini(
  name: string, key: string, system: string, prompt: string, maxTokens: number, deadline: number
): Promise<string> {
  const shared = {
    systemInstruction: { role: "system", parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };
  // 2.5 models think before they answer; an unchecked thinking budget eats the
  // output window and returns silence. Strict JSON first, then progressively
  // looser requests, because some models reject individual generation fields.
  const lean = { temperature: 0, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } };
  const attempts = [
    { ...shared, generationConfig: { ...lean, responseMimeType: "application/json" } },
    { ...shared, generationConfig: { ...lean } },
    { ...shared, generationConfig: { temperature: 0, maxOutputTokens: maxTokens } },
  ];
  for (const payload of attempts) {
    if (deadline - now() < 600) throw new Error("agent_timeout");
    const text = await post(name, key, payload, deadline);
    if (text) return text;
  }
  throw new Error("no_answer");
}

async function post(name: string, key: string, payload: unknown, deadline: number): Promise<string> {
  const budget = Math.max(500, Math.min(deadline - now(), 20000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budget);
  try {
    const res = await fetch(`${API}/models/${encodeURIComponent(name)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) throw new Error("service_credentials_rejected");
    if (res.status === 404) throw new Error("model_not_found");
    if (res.status === 429) {
      // Whether the provider throttles by minute or by day decides how a demo
      // recovers, so log that one word. Nothing else about the response leaves.
      const body = await res.text().catch(() => "");
      console.error(`shotorko_quota model=${name} window=${quotaWindow(body)}`);
      throw new Error("provider_rate_limited");
    }
    // Anything else the provider refuses about THIS request is worth one more
    // try with a simpler body; a caller-side problem will fail again anyway.
    if (!res.ok) return "";
    const data = await res.json() as Json;
    const text = textOf(data);
    if (text) return text;
    const blocked = str((data.promptFeedback as Json | undefined)?.blockReason, 40);
    if (blocked) throw new Error("blocked");
    return "";
  } catch (err) {
    if (err instanceof Error && KNOWN.has(err.message)) throw err;
    throw new Error("no_answer");
  } finally {
    clearTimeout(timer);
  }
}
const KNOWN = new Set(["service_credentials_rejected", "model_not_found", "rate_limited", "blocked", "provider_rate_limited"]);

/* A 429 body is provider text and must never reach a visitor, but two facts in
 * it decide how fast a demo recovers: which quota tripped, and its window. */
function quotaWindow(body: string): string {
  return /per[ _]?(?:\d+[ _])?(minute|second|day|month)/i.exec(body)?.[1]?.toLowerCase() || "unknown";
}

function textOf(data: Json): string {
  const cands = Array.isArray(data?.candidates) ? data.candidates as Json[] : [];
  const content = (cands[0]?.content ?? {}) as Json;
  const parts = Array.isArray(content.parts) ? content.parts as Json[] : [];
  return parts
    .filter(p => p && typeof p.text === "string" && !p.thought)
    .map(p => p.text as string)
    .join("")
    .trim();
}

function firstJson(text: string): Json {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("agent_response_invalid");
  const parsed = JSON.parse(body.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("agent_response_invalid");
  return parsed as Json;
}

/* ── analyze ────────────────────────────────────────────────────── */
function buildAnalyzePrompt(text: string, sit: Json): string {
  return [
    "TRANSCRIPT: " + text,
    "unknownCaller=" + (sit.unknownCaller === false ? "no" : "yes"),
    "callActive=" + (flag(sit.callActive) ? "yes" : "no"),
    "newReceiver=" + (flag(sit.newReceiver) ? "yes" : "no"),
    "unusualAmount=" + (flag(sit.unusualAmount) ? "yes" : "no"),
    "lateNight=" + (flag(sit.lateNight) ? "yes" : "no"),
  ].join("\n");
}

function shapeAnalyze(raw: Json): Json {
  const riskRaw = Number(raw.risk);
  if (!Number.isFinite(riskRaw)) throw new Error("agent_response_invalid");
  const risk = Math.max(0, Math.min(100, Math.round(riskRaw)));

  const keys = Array.isArray(raw.signals) ? raw.signals.map(String) : [];
  const signals = keys
    .filter(k => SIGNALS[k])
    .map(k => ({ key: k, label: SIGNALS[k], terms: [] as string[] }));

  const scamKey = raw.scam == null ? "" : String(raw.scam);
  const scam = SCAM_TYPES[scamKey] ? { key: scamKey, label: SCAM_TYPES[scamKey] } : null;

  const fearRaw = (raw.fear && typeof raw.fear === "object" ? raw.fear : {}) as Json;
  const fear = { scare: flag(fearRaw.scare), rush: flag(fearRaw.rush), isolate: flag(fearRaw.isolate) };

  // The model proposes; the server disposes.
  const asksSomething = signals.some(s => ["payment", "credential", "install"].includes(s.key));
  const wouldPause = flag(raw.wouldPause) && risk >= THRESHOLD && asksSomething;

  return { ok: true, risk, signals, scam, fear, wouldPause, threshold: THRESHOLD, engine: "live" };
}

async function handleAnalyze(req: Request): Promise<Response> {
  let body: Json;
  try { body = await req.json() as Json; } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const text = str((body || {}).text, 1200);
  if (text.length < 2) return json({ ok: false, error: "text_required" }, 400);
  const sit = (body.situation && typeof body.situation === "object" ? body.situation : {}) as Json;

  const prompt = buildAnalyzePrompt(text, sit);
  try {
    const val = await cached(await fingerprint(["a", prompt]), async () => {
      const answer = await gemini(SYSTEM_ANALYZE, prompt, now() + MAX_ANALYZE_MS, 512);
      return shapeAnalyze(firstJson(answer));
    });
    return json(val);
  } catch (err) {
    return failure(err);
  }
}

/* ── complaint ─────────────────────────────────────────────────── */
async function handleComplaint(req: Request): Promise<Response> {
  let body: Json;
  try { body = await req.json() as Json; } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const incident = body || {};
  const story = str(incident.text, 2000);
  if (story.length < 8) return json({ ok: false, error: "text_required" }, 400);

  const prompt = [
    "ভিকটিমের বক্তব্য: " + story,
    str(incident.number, 40) ? "নম্বর: " + str(incident.number, 40) : "",
    str(incident.time, 60) ? "সময়: " + str(incident.time, 60) : "",
    str(incident.amount, 60) ? "চাওয়া হয়েছে: " + str(incident.amount, 60) : "",
  ].filter(Boolean).join("\n");

  try {
    const val = await cached(await fingerprint(["c", prompt]), async () => {
      const raw = firstJson(await gemini(SYSTEM_COMPLAINT, prompt, now() + MAX_COMPLAINT_MS, 2048));
      const letter = str(raw.body, 4000);
      if (letter.length < 40) throw new Error("agent_response_invalid");
      return {
        ok: true,
        subject: str(raw.subject, 160) || "ফোন প্রতারণার চেষ্টার অভিযোগ",
        body: letter,
        to: COMPLAINT_TO,
        signals: [] as string[],
        engine: "live",
      };
    });
    return json(val);
  } catch (err) {
    return failure(err);
  }
}

function code(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return /^[a-z0-9_]{1,48}$/.test(msg) ? msg : "agent_unavailable";
}
function failure(err: unknown): Response {
  // The provider's throttle and ours are the same promise to the visitor:
  // backed off, try the on-device engine, come back shortly.
  const c = code(err) === "provider_rate_limited" ? "rate_limited" : code(err);
  const status = c === "rate_limited" ? 429
    : c === "agent_timeout" ? 504
    : c === "blocked" ? 422
    : c === "invalid_json" || c === "text_required" || c === "not_found" ? 400
    : c === "service_credentials_rejected" ? 503
    : 503;
  return json({ ok: false, error: c }, status);
}

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const tail = url.pathname.split("/").filter(Boolean).pop() || "";

  if (request.method === "GET" && tail === "health") {
    return json(apiKey()
      ? { ok: true, engine: "gemini", model: pinnedModel || model() }
      : { ok: false, error: "service_not_configured" });
  }
  if (request.method === "GET" && tail === "") {
    return json({ service: "shotorko", endpoints: ["/health", "/analyze", "/complaint"] });
  }
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "json_required" }, 415);
  }
  if (tail === "analyze") return await handleAnalyze(request);
  if (tail === "complaint") return await handleComplaint(request);
  return json({ ok: false, error: "not_found" }, 404);
}
