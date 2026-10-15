/* Local smoke test for the Sites Function. Stays out of the published package.
   Run: node dev/function-check.mjs
   It fakes the Cloud Agents API so the routing, validation and response shape
   can be checked without a PAT or network. */

const calls = [];
let mode = "happy";

function evt(type, text) {
  return { type, content: [{ type: "text", text }] };
}

globalThis.Deno = { env: { get: (k) => (k === "QODER_PAT" ? "pat-for-local-check" : undefined) } };

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  calls.push({ u, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
  const j = (obj, status = 200) => new Response(JSON.stringify(obj), {
    status, headers: { "content-type": "application/json" },
  });

  if (u.includes("/models")) {
    return j({ data: [{ id: "some-model", enabled: true }, { id: "qwen3-max", enabled: true }] });
  }
  if (/\/environments\?/.test(u)) {
    return j({ data: mode === "existing" ? [{ id: "env_1", metadata: { app: "shotorko", surface: "prototype", role: "runtime" } }] : [], has_more: false });
  }
  if (/\/agents\?/.test(u)) {
    return j({ data: mode === "existing" ? [{ id: "agent_1", version: 3, metadata: { app: "shotorko", surface: "prototype", role: "classifier" } }] : [], has_more: false });
  }
  if (u.endsWith("/environments")) return j({ id: "env_new" }, 201);
  if (u.endsWith("/agents")) return j({ id: "agent_new", version: 1 }, 201);
  if (u.endsWith("/sessions")) return j({ id: "sess_1" }, 201);
  if (/\/sessions\/[^/]+\/events$/.test(u) && opts.method === "POST") return j({ data: [] }, 200);
  if (/\/sessions\/[^/]+\/events\?/.test(u)) {
    if (mode === "noanswer") return j({ data: [] });
    if (mode === "falsepause") {
      return j({ data: [evt("agent.message", JSON.stringify({
        risk: 90, signals: ["reward"], scam: "prize",
        fear: { scare: false, rush: true, isolate: false }, wouldPause: true,
      }))] });
    }
    if (mode === "garbage") return j({ data: [evt("agent.message", "I am not sure, here is some prose")] });
    if (mode === "complaint") {
      return j({ data: [evt("agent.message", JSON.stringify({
        subject: "ভুয়া পুলিশ পরিচয়ে প্রতারণার চেষ্টা",
        body: "বিষয়: ভুয়া পুলিশ পরিচয়ে প্রতারণার চেষ্টা।\n\nগতকাল রাত ৯টায় ০১৭১১২৩৪৫৬৭ নম্বর থেকে..." ,
      }))] });
    }
    return j({ data: [evt("agent.message", JSON.stringify({
      risk: 88, signals: ["payment", "secrecy", "authority", "not_a_real_signal"],
      scam: "police", fear: { scare: true, rush: true, isolate: true }, wouldPause: true,
    }))] });
  }
  return j({ error: "unexpected" }, 500);
};

const { handler } = await import("../functions/handler.ts");

const post = (path, body) => new Request("https://site.qoder.site/functions/v1/app/" + path, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
const get = (path) => new Request("https://site.qoder.site/functions/v1/app/" + path);

let fails = 0;
function check(name, cond, extra = "") {
  if (cond) console.log("  ok   " + name);
  else { fails++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
}

/* health */
let r = await handler(get("health"));
let b = await r.json();
check("health 200", r.status === 200 && b.ok === true, JSON.stringify(b));

r = await handler(new Request("https://site/functions/v1/app/analyze", { method: "DELETE" }));
check("non-POST rejected", r.status === 405);

r = await handler(new Request("https://site/functions/v1/app/analyze", { method: "POST", body: "{}" }));
check("wrong content type rejected", r.status === 415);

r = await handler(post("nope", {}));
check("unknown path is 404", r.status === 404);

r = await handler(post("analyze", { text: "  " }));
check("empty text rejected", r.status === 400);

/* analyze, cold start (creates env + agent) */
mode = "happy";
r = await handler(post("analyze", { text: "আমি থানার ওসি, টাকা পাঠাও কাউকে বলো না", situation: { callActive: true } }));
b = await r.json();
check("analyze 200", r.status === 200, JSON.stringify(b));
check("risk is a number", typeof b.risk === "number");
check("signals array shaped", Array.isArray(b.signals) && b.signals.every(s => s.key && s.label), JSON.stringify(b.signals));
check("unknown signal dropped", b.signals.every(s => s.key !== "not_a_real_signal"));
check("scam label from server", b.scam && b.scam.label === "ভুয়া পুলিশ / মামলা", JSON.stringify(b.scam));
check("wouldPause passes", b.wouldPause === true);
check("engine is live", b.engine === "live");
check("agent + env created once", calls.filter(c => c.u.endsWith("/agents")).length === 1);

/* cache: same text must not hit upstream twice */
const before = calls.length;
await handler(post("analyze", { text: "আমি থানার ওসি, টাকা পাঠাও কাউকে বলো না", situation: { callActive: true } }));
check("identical call served from cache", calls.length === before);

/* wouldPause gate: the server, not the model, holds the final veto */
mode = "falsepause";
r = await handler(post("analyze", { text: "আপনি লটারিতে জিতেছেন, ফি দিতে হবে", situation: {} }));
b = await r.json();
check("model cannot pause without an ask it owns", b.ok === true && b.wouldPause === false, JSON.stringify(b));

mode = "happy";
r = await handler(post("analyze", { text: "অ্যাগ্রেগেট টেস্ট", situation: {} }));
b = await r.json();
check("response always valid shape", typeof b.risk === "number" && Array.isArray(b.signals));

/* existing resources are reused, not duplicated */
mode = "existing";
const created = calls.filter(c => c.method === "POST" && /\/(agents|environments)$/.test(c.u)).length;
r = await handler(post("analyze", { text: "নতুন একদম আলাদা লাইন যা ক্যাশে নেই", situation: {} }));
b = await r.json();
const createdAfter = calls.filter(c => c.method === "POST" && /\/(agents|environments)$/.test(c.u)).length;
check("metadata match reused, nothing created", b.ok === true && createdAfter === created, `${created} -> ${createdAfter}`);

/* agent timeout falls back cleanly with a safe code, never a raw error */
mode = "noanswer";
r = await handler(post("analyze", { text: "সম্পূর্ণ আলাদা তৃতীয় লাইন পরীক্ষা", situation: {} }));
b = await r.json();
check("no answer -> 5xx with code", r.status >= 500 && /^[a-z_]+$/.test(b.error), `${r.status} ${JSON.stringify(b)}`);

mode = "garbage";
r = await handler(post("analyze", { text: "চতুর্থ আলাদা লাইন পরীক্ষা", situation: {} }));
b = await r.json();
check("prose reply rejected safely", r.status >= 500 && b.ok === false && b.error === "agent_response_invalid", JSON.stringify(b));

/* complaint */
mode = "complaint";
r = await handler(post("complaint", { text: "থানার ওসি বলে ফোন করেছিল, ৩০ হাজার টাকা বিকাশ করতে বলল", number: "01711234567", amount: "৩০,০০০" }));
b = await r.json();
check("complaint 200", r.status === 200 && b.ok === true, JSON.stringify(b));
check("complaint body is the letter", typeof b.body === "string" && b.body.includes("০১৭১১২৩৪৫৬৭"));
check("recipients fixed by server", Array.isArray(b.to) && b.to.length === 3 && b.to[0] === "Grameenphone ফ্রড সেল");

/* prompt carries the facts, and never a raw upstream body */
const sent = calls.filter(c => c.u.endsWith("/events") && c.method === "POST").pop();
check("prompt includes the transcript", JSON.stringify(sent).includes("থানার ওসি"));
check("prompt asks for JSON only", JSON.stringify(sent).includes("JSON only"));

console.log(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL FUNCTION CHECKS PASSED");
process.exit(fails ? 1 : 0);
