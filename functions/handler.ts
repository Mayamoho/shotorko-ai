import { createCloudAgentsClient, CloudAgentsError } from "./cloud-agents.mjs";
import { SIGNALS, SCAM_TYPES, TRIGGERS, THRESHOLD, COMPLAINT_TO } from "./signals.ts";

// Origin issued by the Sites runtime (sites.get_runtime_context -> cloudAgents.apiOrigin).
const ORIGIN = "https://api.qoder.com";
const META = { app: "shotorko", surface: "prototype" };
const MODEL_PREFERENCE = ["qwen3-max", "qwen-max", "claude", "gpt", "sonnet"];
const MAX_ANALYZE_MS = 20000;
const MAX_COMPLAINT_MS = 30000;

const SYSTEM_ANALYZE = `You are the on-call fraud classifier for Shotorko, a Bangladeshi phone-scam
intervention service. You read ONE stretch of call transcript, exactly as a cheap Android
phone would, and decide whether to interrupt the user.

Input is Bangla, Banglish (Bangla typed in Latin letters) or mixed, in any dialect spelling.
Judge intent, never individual words: the same sentence is harmless from a saved contact and
dangerous from an unknown caller mid-call.

Reply with ONE JSON object and nothing else:
{"risk":<integer 0-100>,
 "signals":[<zero or more of: authority, leverage, urgency, secrecy, credential, payment, reward, install>],
 "scam":<one of: police, account, otp, emergency, refund, prize, forward, remote, or null>,
 "fear":{"scare":<bool>,"rush":<bool>,"isolate":<bool>},
 "wouldPause":<bool>}

wouldPause is true only when the caller is applying fear AND asking the listener to move money,
hand over a code, forward calls or install something. Ordinary commerce, family talk, delivery
calls and wrong numbers must not pause. A false alarm costs a user their trust in the product.`;

const SYSTEM_COMPLAINT = `You write fraud complaints for Shotorko, a Bangladeshi phone-scam service.
The victim has spoken what happened, in Bangla, often in a dialect, sometimes upset and unclear.

Turn that account into ONE complaint letter in standard Bangla that can be filed as-is with the
Grameenphone fraud cell, an MFS provider and the police.

Rules: state only what the victim said. Never invent a number, an amount, a date, a name, a
thana or a section of law. Keep sentences short and factual. Keep any phone number, amount,
app name and time exactly as given. End by asking for the number to be traced.

Reply with ONE JSON object and nothing else:
{"subject":"<short Bangla subject line>","body":"<the letter, \\n between paragraphs>"}`;

type Json = Record<string, unknown>;
type Bounds = { deadline: number };

const now = () => Date.now();
const left = (b: Bounds) => b.deadline - now();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function token(): string | undefined {
  try {
    return (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno?.env?.get("QODER_PAT");
  } catch {
    return undefined;
  }
}

const client = createCloudAgentsClient({ origin: ORIGIN, getToken: token, timeoutMs: 12000 });

/* ── fixed server-side agent, created once and reused ─────────────
   findResources matches on metadata, so a restart reuses the same Agent and
   Environment instead of piling up new ones. */
type Resources = { agentId: string; version: number; environmentId: string };
let resources: Promise<Resources> | null = null;

async function pickModel(): Promise<string> {
  const res = await client.request("/api/v1/cloud/models");
  const list: Json[] = Array.isArray(res?.data) ? res.data : [];
  const usable = list.filter(m => m && typeof m.id === "string" && m.enabled !== false);
  if (!usable.length) throw new Error("no_model_available");
  const sorted = usable.map(m => String(m.id).toLowerCase());
  for (const want of MODEL_PREFERENCE) {
    const at = sorted.findIndex(id => id.includes(want));
    if (at >= 0) return String(usable[at].id);
  }
  return String(usable[0].id);
}

async function findOrCreate(kind: "agents" | "environments", metadata: Json, build: () => Promise<Json>): Promise<Json> {
  const matches = await client.findResources(kind, metadata);
  if (matches.length > 1) throw new Error("duplicate_" + kind);
  if (matches.length === 1) return matches[0];
  return await client.request(`/api/v1/cloud/${kind}`, { method: "POST", body: await build() });
}

async function bootstrap(): Promise<Resources> {
  if (!token()) throw new Error("service_not_configured");
  const model = await pickModel();

  const environment = await findOrCreate("environments", { ...META, role: "runtime" }, async () => ({
    name: "shotorko-runtime",
    config: { type: "cloud" },
    metadata: { ...META, role: "runtime" },
  }));

  const agentMeta = { ...META, role: "classifier" };
  const agent = await findOrCreate("agents", agentMeta, async () => ({
    name: "shotorko-classifier",
    model,
    system: SYSTEM_ANALYZE + "\n\n" + SYSTEM_COMPLAINT,
    metadata: agentMeta,
  }));

  if (typeof environment?.id !== "string" || typeof agent?.id !== "string") throw new Error("agent_setup_failed");
  return { agentId: agent.id, version: Number(agent.version) || 1, environmentId: environment.id };
}

function getResources(): Promise<Resources> {
  if (!resources) {
    resources = bootstrap().catch(err => {
      resources = null;
      throw err;
    });
  }
  return resources;
}

/* ── one prompt, one answer ─────────────────────────────────────── */
async function ask(prompt: string, bounds: Bounds): Promise<string> {
  const { agentId, version, environmentId } = await getResources();
  const session = await client.request("/api/v1/cloud/sessions", {
    method: "POST",
    body: { agent: { type: "agent", id: agentId, version }, environment_id: environmentId },
  });
  const sessionId = session?.id;
  if (typeof sessionId !== "string" || !/^sess_/.test(sessionId)) throw new Error("session_setup_failed");

  await client.request(`/api/v1/cloud/sessions/${sessionId}/events`, {
    method: "POST",
    body: { events: [{ type: "user.message", content: [{ type: "text", text: prompt }] }] },
  });

  const floor = Math.max(bounds.deadline - 1500, now() + 1200);
  let answer = "";
  while (now() < floor) {
    await sleep(Math.min(900, Math.max(300, floor - now())));
    const page = await client.request(`/api/v1/cloud/sessions/${sessionId}/events?order=asc&limit=100`);
    const events: Json[] = Array.isArray(page?.data) ? page.data : [];
    let failed = false;
    for (const ev of events) {
      if (ev?.type === "session.error" || ev?.error) failed = true;
      const text = textOf(ev);
      if (text && String(ev?.type || "").startsWith("agent.")) answer = text;
    }
    if (answer) return answer;
    if (failed) throw new Error("agent_failed");
  }
  if (answer) return answer;
  throw new Error(left(bounds) <= 0 ? "agent_timeout" : "agent_no_answer");
}

function textOf(event: Json): string {
  const content = (event as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(b => b && typeof b === "object" && (b as Json).type === "text" && typeof (b as Json).text === "string")
    .map(b => (b as { text: string }).text)
    .join("")
    .trim();
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

/* ── small guards so a public page cannot drain the account ─────── */
const CACHE = new Map<string, { at: number; val: Json }>();
const CACHE_MS = 15 * 60 * 1000;
let slots = 0;
let windowAt = 0;

async function cached(key: string, make: () => Promise<Json>): Promise<Json> {
  const hit = CACHE.get(key);
  if (hit && now() - hit.at < CACHE_MS) return hit.val;
  const cost = 4;
  if (now() - windowAt > 60_000) { windowAt = now(); slots = 0; }
  if (slots + cost > 30) throw new Error("rate_limited");
  slots += cost;
  const val = await make();
  if (CACHE.size > 120) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(key, { at: now(), val });
  return val;
}

async function fingerprint(parts: unknown[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

/* ── request bodies ─────────────────────────────────────────────── */
function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "";
}
function flag(v: unknown): boolean { return v === true; }

function buildAnalyzePrompt(text: string, sit: Json): string {
  return [
    "TRANSCRIPT: " + text,
    "unknownCaller=" + (sit.unknownCaller === false ? "no" : "yes"),
    "callActive=" + (flag(sit.callActive) ? "yes" : "no"),
    "newReceiver=" + (flag(sit.newReceiver) ? "yes" : "no"),
    "unusualAmount=" + (flag(sit.unusualAmount) ? "yes" : "no"),
    "lateNight=" + (flag(sit.lateNight) ? "yes" : "no"),
    "optInConsent=" + (sit.optInConsent === false ? "no" : "yes"),
    "JSON only.",
  ].join("\n");
}

function shapeAnalyze(raw: Json): Json {
  const riskRaw = Number(raw.risk);
  if (!Number.isFinite(riskRaw)) throw new Error("agent_response_invalid");
  const risk = Math.max(0, Math.min(100, Math.round(riskRaw)));

  const keys = Array.isArray(raw.signals) ? raw.signals.map(String) : [];
  const signals = keys.filter(k => SIGNALS[k]).map(k => ({ key: k, label: SIGNALS[k].label, weight: SIGNALS[k].weight, terms: [] as string[] }));

  const scamKey = raw.scam == null ? "" : String(raw.scam);
  const scam = SCAM_TYPES[scamKey] ? { key: scamKey, label: SCAM_TYPES[scamKey] } : null;

  const fearRaw = (raw.fear && typeof raw.fear === "object" ? raw.fear : {}) as Json;
  const fear = { scare: flag(fearRaw.scare), rush: flag(fearRaw.rush), isolate: flag(fearRaw.isolate) };

  const asksSomething = signals.some(s => ["payment", "credential", "install"].includes(s.key))
    || Object.values(TRIGGERS).includes(String(raw.trigger ?? "\u0000"));
  const wouldPause = flag(raw.wouldPause) && risk >= THRESHOLD && asksSomething;

  return { ok: true, risk, signals, scam, fear, wouldPause, threshold: THRESHOLD, engine: "live" };
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

/* ── endpoints ──────────────────────────────────────────────────── */
async function handleAnalyze(req: Request): Promise<Response> {
  let body: Json;
  try { body = await req.json() as Json; } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const text = str((body || {}).text, 1200);
  if (text.length < 2) return json({ ok: false, error: "text_required" }, 400);
  const sit = (body.situation && typeof body.situation === "object" ? body.situation : {}) as Json;

  const prompt = buildAnalyzePrompt(text, sit);
  try {
    const val = await cached(await fingerprint(["a", prompt]), async () => {
      const answer = await ask(prompt, { deadline: now() + MAX_ANALYZE_MS });
      return shapeAnalyze(firstJson(answer));
    });
    return json(val);
  } catch (err) {
    return json({ ok: false, error: safeCode(err) }, statusFor(err));
  }
}

async function handleComplaint(req: Request): Promise<Response> {
  let body: Json;
  try { body = await req.json() as Json; } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const incident = body || {};
  const story = str(incident.text, 2000);
  if (story.length < 8) return json({ ok: false, error: "text_required" }, 400);

  const facts = [
    story ? "ভিকটিমের বক্তব্য: " + story : "",
    str(incident.number, 40) ? "নম্বর: " + str(incident.number, 40) : "",
    str(incident.time, 60) ? "সময়: " + str(incident.time, 60) : "",
    str(incident.amount, 60) ? "চাওয়া হয়েছে: " + str(incident.amount, 60) : "",
    "JSON only.",
  ].filter(Boolean).join("\n");

  try {
    const val = await cached(await fingerprint(["c", facts]), async () => {
      const answer = await ask(facts, { deadline: now() + MAX_COMPLAINT_MS });
      const raw = firstJson(answer);
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
    return json({ ok: false, error: safeCode(err) }, statusFor(err));
  }
}

function safeCode(err: unknown): string {
  if (err instanceof CloudAgentsError) return err.code;
  const msg = err instanceof Error ? err.message : String(err);
  return /^[a-z0-9_]{1,48}$/.test(msg) ? msg : "agent_unavailable";
}
function statusFor(err: unknown): number {
  if (err instanceof CloudAgentsError) return err.status;
  if (safeCode(err) === "rate_limited") return 429;
  if (safeCode(err) === "agent_timeout") return 504;
  return 503;
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const tail = url.pathname.split("/").filter(Boolean).pop() || "";

  if (req.method === "GET" && (tail === "health" || tail === "")) {
    if (tail === "") return json({ service: "shotorko", endpoints: ["/health", "/analyze", "/complaint"] });
    const ready = Boolean(token());
    return json(ready ? { ok: true, engine: "qoder-cloud-agent" } : { ok: false, error: "service_not_configured" });
  }
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const type = req.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) return json({ ok: false, error: "json_required" }, 415);

  if (tail === "analyze") return await handleAnalyze(req);
  if (tail === "complaint") return await handleComplaint(req);
  return json({ ok: false, error: "not_found" }, 404);
}
