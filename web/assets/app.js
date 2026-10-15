/* Shotorko prototype — presentation-driven phone mock.
 * Three devices: Ammu's smartphone, Ammu's old button phone (proves the
 * network-level warning needs no smartphone), and Rakib's phone (Apon Jon).
 * The right rail is the presenter view: what the engine saw, and how each
 * screen maps to a real production component.
 */

const E = window.ShotorkoEngine;
const D = window.ShotorkoData;

const MODULES = [
  { key: "home", tab: "হোম", num: "0", title: "Shotorko app — সব ঠিক আছে", en: "Quiet when nothing is wrong" },
  { key: "precall", tab: "কলের আগে", num: "1", title: "Before the call", en: "Network-level Bangla warning, no blocking, any phone" },
  { key: "during", tab: "কলের ভেতরে", num: "2", title: "During the call", en: "On-device listening, nothing recorded" },
  { key: "thamun", tab: "থামুন", num: "3", title: "Before you act — the pause", en: "The heart of Shotorko" },
  { key: "aponjon", tab: "আপনজন", num: "4", title: "Apon Jon — family circle", en: "Alert, one-tap call back, family word" },
  { key: "agent", tab: "এজেন্ট সতর্কতা", num: "5", title: "Agent Alert", en: "The shopkeeper becomes a checkpoint" },
  { key: "after", tab: "রিপোর্ট", num: "6", title: "After — spoken report to complaint", en: "Bangla speech to a filing-ready complaint" },
  { key: "radar", tab: "স্ক্যাম রাডার", num: "7", title: "Scam Radar", en: "Same script, one network" },
  { key: "console", tab: "নিজে যাচাই", num: "8", title: "Try it yourself", en: "Paste any scam text — Bangla or Banglish" }
];

const NOTES = {
  home: {
    say: "Four protection moments on one screen. If nothing is wrong the app stays green and silent — it never nags.",
    prod: "Production: Android app. These toggles are per-feature opt-in consent, stored on the device."
  },
  precall: {
    say: "Shotorko does not block the call. It plays one Bangla sentence before the call connects — so even a button phone gets warned.",
    prod: "Production: announcement injected inside the mobile network (GP) before the phone rings. No smartphone, no app install, no handset capability needed. Reputation data shown here is demo data."
  },
  during: {
    say: "On a smartphone, if the user turns it on, the phone understands the meaning behind the words — not a word list — and gives one soft warning.",
    prod: "Production: on-device Bangla model. Audio never leaves the handset and nothing is stored. Live-call recognition is the hardest engineering piece in the whole plan."
  },
  thamun: {
    say: "This is the moment a scam actually succeeds. Shotorko interrupts the action, asks one question, and offers exactly two ways out.",
    prod: "Production: Android cannot read USSD responses, so the trigger is an AccessibilityService over the dialer and payment apps, plus agent-side checks. Operator-side USSD gating is the stronger GP-native option."
  },
  aponjon: {
    say: "A son or daughter sets this up for a parent in two minutes with a QR code. Family becomes the second layer, and a secret word defeats a cloned voice.",
    prod: "Production: linked-device alerts through the Shotorko backend. The family word is asked of the caller and never spoken by the app."
  },
  agent: {
    say: "If money is pushed toward a reported number at an agent shop, the shopkeeper sees the warning and asks the one question that saves people.",
    prod: "Production: inside the MFS agent app through partner integration, fed by the shared Scam Radar list. Advisory, not a hard block."
  },
  after: {
    say: "A victim only has to speak. The AI writes the complaint a person would otherwise have to type, addressed to the three parties who can act.",
    prod: "Production: Bangla speech recognition plus a generative writer, filed to the GP fraud cell, the MFS provider and police/999."
  },
  radar: {
    say: "Every report, blocked or not, joins one picture. Different numbers, same script — that is one network, not twenty complaints.",
    prod: "Production: clustering over report text and calling patterns, shared with GP's fraud team and the police. Demo dataset only here."
  },
  console: {
    say: "This is the model itself. Change every word, keep the intent — it still knows. That is exactly why a blocklist cannot win.",
    prod: "Production: a fine-tuned Bangla language model small enough to run on a cheap phone. Here it runs locally as the fallback, or through a hosted agent when live."
  }
};

const AMMU_NUMBER = "01711-234567";
const CONVO = "হ্যালো, আমি থানার ওসি বলছি। আপনার ছেলেকে ইয়াবাসহ ধরা হয়েছে। মামলা না চাইলে এখনই ৩০ হাজার টাকা বিকাশ করেন। কাউকে বলবেন না।";

const state = {
  module: "home",
  engine: "local",
  liveAvailable: false,
  sound: true,
  running: false,
  stepIndex: 0,
  consent: { precall: true, during: true, thamun: true, aponjon: true },
  transcript: [],
  softWarned: false,
  paused: false,
  resolved: null,
  lastResult: null,
  complaint: null,
  radarOpen: "NET-A",
  consoleText: "আমি বিকাশ অফিস থেকে বলছি, আপনার একাউন্ট সাসপেন্ড হয়ে যাবে। OTP টা বলুন, তাহলেই টাকা ফেরত পাবেন। কাউকে বলবেন না।",
  consoleSituation: { unknownCaller: true, callActive: true, newReceiver: true, unusualAmount: false, lateNight: false },
  sonState: "idle",
  timer: null
};

/* ── helpers ──────────────────────────── */
const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const taka = n => "টাকা " + Number(n).toLocaleString("en-US");

function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

function speak(text, soft) {
  if (!state.sound) return;
  if (!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  const bn = voices.find(v => /^bn/i.test(v.lang));
  if (!bn) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bn.lang; u.voice = bn; u.rate = .92; u.pitch = soft ? .9 : 1;
    window.speechSynthesis.speak(u);
  } catch (err) { /* speech is a bonus, never a dependency */ }
}

/* ── partials ─────────────────────────── */
function statusbar(carrier) {
  return `<div class="statusbar"><span>সতর্ক</span><span>${esc(carrier || "গ্রামীণফোন")}</span><span>৯:৪১</span></div>`;
}
function voiceNote(bangla, en, soft) {
  return `<div class="voice-note${soft ? " soft" : ""} fadein"><span class="spk">🔊</span><div>${esc(bangla)}<span class="en">${esc(en)}</span></div></div>`;
}
function reputationChips(rep) {
  return `<div class="chips">
    <span class="chip ${rep.verdict === "suspicious" ? "hot" : ""}">${rep.reports ? rep.reports + " জনের প্রতিবেদন" : "প্রতিবেদন নেই"}</span>
    <span class="chip">${esc(rep.age)}</span>
    <span class="chip">${esc(rep.fanout)}</span>
    <span class="chip demo">ডেমো তথ্য</span></div>`;
}
function signalChips(hits) {
  if (!hits || !hits.length) return "";
  return `<div class="chips sig">` + hits.map(h => `<span class="chip hot">${esc(typeof h === "string" ? h : h.label)}</span>`).join("") + `</div>`;
}
function termList(hits) {
  const parts = (hits || []).map(h => (h.terms || []).join(", ")).filter(Boolean);
  return parts.length ? `<div class="note" style="margin-top:10px">শনাক্ত অংশ: ${esc(parts.join(" • "))}</div>` : "";
}

/* ── hybrid engine call ───────────────── */
async function analyze(text, situation) {
  const local = E.score(Object.assign({ text }, situation));
  if (state.engine !== "live") return local;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 22000);
  try {
    const res = await fetch("/functions/v1/app/analyze", {
      method: "POST", credentials: "same-origin", signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, situation })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    if (!j || j.ok !== true || typeof j.risk !== "number" || !Array.isArray(j.signals) || typeof j.wouldPause !== "boolean") {
      throw new Error("invalid agent response");
    }
    return {
      risk: j.risk, hits: j.signals, scam: j.scam || null,
      fear: j.fear || local.fear, wouldPause: j.wouldPause,
      threshold: typeof j.threshold === "number" ? j.threshold : local.threshold,
      engine: "live"
    };
  } catch (err) {
    return Object.assign({}, local, { fallbackReason: String((err && err.message) || err), engine: "local" });
  } finally { clearTimeout(to); }
}

async function generateComplaint(incident) {
  const localDraft = E.draftComplaint(incident);
  if (state.engine !== "live") return localDraft;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 35000);
  try {
    const res = await fetch("/functions/v1/app/complaint", {
      method: "POST", credentials: "same-origin", signal: ctrl.signal,
      headers: { "content-type": "application/json" }, body: JSON.stringify(incident)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    if (!j || j.ok !== true || typeof j.body !== "string" || !Array.isArray(j.to)) return localDraft;
    return Object.assign({}, j, { engine: "live" });
  } catch (err) {
    return Object.assign({}, localDraft, { fallbackReason: String((err && err.message) || err) });
  } finally { clearTimeout(to); }
}

/* A live call can take seconds; the page says so instead of looking frozen. */
function markBusy(label) {
  const box = $("#ammu-screen .app-body");
  if (!box || $("#busy")) return;
  box.insertBefore(el(`<div class="card fadein" id="busy"><p>${esc(label)}</p>
    <span class="en">Hosted agent is writing. If it is slow or blocked, the on-device engine answers instead.</span></div>`), box.firstChild);
}

/* ── screen: home ─────────────────────── */
function scrHome() {
  const rows = [
    ["precall", "কলের আগে সতর্কবাণী"],
    ["during", "কলের ভেতরে শ্রবণ — ফোনের ভেতরেই"],
    ["thamun", "পাঠানোর আগে থামুন"],
    ["aponjon", "আপনজন — পরিবারের অ্যালার্ট"]
  ];
  return `${statusbar()}<div class="app-body">
    <div class="sc-title">সব ঠিক আছে</div>
    <div class="sc-sub">Nothing is wrong right now, so the app says nothing.</div>
    <div class="card ok"><h4>🛡️ সক্রিয়</h4><p>আপনার ফোন রক্ষা পাচ্ছে। আজ কোনো সন্দেহজনক কল আসেনি।</p>
      <span class="en">Your phone is protected. No suspicious calls today.</span></div>
    <div class="card">${rows.map(([k, label]) => `<div class="home-row"><span class="dot ${k === "thamun" ? "amber" : ""}"></span>
      <div style="flex:1">${esc(label)}</div>
      <div class="switch ${state.consent[k] ? "on" : ""}" data-action="toggle" data-key="${k}" role="switch" aria-checked="${!!state.consent[k]}" tabindex="0"></div></div>`).join("")}</div>
    <div class="card"><h4>আপনজন</h4>
      <p>${esc(D.FAMILY.son.name)} (${esc(D.FAMILY.son.relation)}) · ${esc(D.FAMILY.daughter.name)} (${esc(D.FAMILY.daughter.relation)})</p>
      <span class="en">A secret family word is set. A cloned voice cannot pass it.</span></div>
    <div class="card"><h4>এই মাসে</h4><div class="kv">
      <dt>থামানো হয়েছে</dt><dd>${D.STATS.pauses} বার</dd>
      <dt>পরিবারকে জানানো</dt><dd>${D.STATS.familyAlerts} বার</dd>
      <dt>ভুল সতর্কতা</dt><dd>${D.STATS.falseAlarms} বার — “ঠিক ছিল” বাটন দিয়ে গুনে</dd></div></div>
    <div class="note">অপ্ট-ইন · সম্ভব যেখানেই ফোনের ভেতরেই প্রসেসিং · Personal Data Protection Act অনুসরণে</div>
  </div>`;
}

/* ── screen: before the call ──────────── */
function scrPreCall() {
  const rep = E.reputation(AMMU_NUMBER);
  return `${statusbar()}<div class="app-body">
    <div class="incoming">
      <div class="st">ইনকামিং কল · incoming</div>
      <div class="who">অজানা নম্বর</div>
      <div class="num">${esc(AMMU_NUMBER)}</div>
      <div class="wave">${"<i></i>".repeat(9)}</div>
    </div>
    ${rep.verdict === "suspicious" ? voiceNote("সাবধান, এই নম্বরটি সন্দেহজনক।", "Careful — this number looks suspicious.") : ""}
    <div class="card warn"><h4>কেন সতর্ক করা হচ্ছে</h4>${reputationChips(rep)}
      <p style="margin-top:10px">${esc(rep.script || "অন্য অনেকে এই নম্বর থেকে একই কথা শুনেছে।")}</p>
      <span class="en">Other people reported this same script.</span></div>
    <div class="card"><p>📵 কল ব্লক করা হয়নি। চাইলেই আপনি রিসিভ করুন।</p>
      <span class="en">Shotorko warns, it never blocks. The choice stays with you.</span></div>
    <button class="btn big family" data-action="accept-call">গ্রহণ করুন<span class="en">Accept — as real people do</span></button>
    <button class="btn accept" data-action="reject-call">কাটুন<span class="en">Decline</span></button>
  </div>`;
}

function scrPreCallBasic() {
  const rep = E.reputation(AMMU_NUMBER);
  return `<div class="app-body">
    <div class="card" style="text-align:center;background:#232c3b;border-color:#3a4b62">
      <div class="note" style="font-family:var(--latin)">01711-234567</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">অজানা নম্বর</div>
      <div style="font-size:15px;color:#8fa3b8;margin-top:2px">রিসিভ / ছাড়ুন</div>
    </div>
    ${rep.verdict === "suspicious" ? voiceNote("সাবধান, এই নম্বরটি সন্দেহজনক।", "Announced in the network, before the ring.") : ""}
    <div class="card ok"><h4>কোনো অ্যাপ নেই</h4><p>কোনো স্মার্টফোন নেই, কোনো ইনস্টল নেই, কোনো ব্যাটারি খরচ নেই।</p>
      <span class="en">Warning lands on a Tk 800 button phone, because it happens in the network.</span></div>
  </div>`;
}

/* ── screen: during the call ──────────── */
function scrDuring() {
  const lines = state.transcript.map(t => {
    const hit = t.signals && t.signals.length;
    return `<div class="line ${esc(t.speaker)} ${hit ? "hit" : ""} fadein">${esc(t.bangla)}<span class="en">${esc(t.en)}</span>
      ${hit ? `<div class="chips sig">${t.signals.map(s => `<span class="chip hot">${esc(E.SIGNALS[s] ? E.SIGNALS[s].label : s)}</span>`).join("")}</div>` : ""}</div>`;
  }).join("");
  const more = state.transcript.length < D.CALL_SCRIPT.length;
  return `${statusbar()}<div class="app-body">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div><b style="font-size:18px">${esc(AMMU_NUMBER)}</b><div class="note" style="font-family:var(--latin)">call active · 02:14</div></div>
      <span class="dot amber" title="on-device listening"></span>
    </div>
    ${state.softWarned ? voiceNote("সতর্ক থাকুন। পুলিশ কখনো ফোনে টাকা চায় না।", "Stay careful. Police never ask for money over the phone.", true) : ""}
    <div class="lines">${lines}</div>
    ${more ? `<button class="btn" data-action="next-line">পরের কথা<span class="en">Next line of the call</span></button>` : ""}
    <button class="btn red" data-action="to-thamun">আম্মু টাকা পাঠাতে শুরু করলেন<span class="en">She starts sending money</span></button>
    <div class="note">🔒 রেকর্ডিং হয় না · কোনো অডিও ফোনের বাইরে যায় না<br>Nothing is recorded or uploaded.</div>
  </div>`;
}

/* ── screen: the pause ────────────────── */
function scrThamun() {
  const res = state.lastResult;
  const overlay = state.paused ? `<div class="thamun">
      <div class="word">থামুন</div>
      <div class="ask">কেউ কি ফোনে ভয় দেখাচ্ছে বা তাড়াতাড়ি করতে বলছে?</div>
      <button class="btn big" data-action="verify">আসল কিনা যাচাই করুন<span class="en">Calls 999 or the official helpline for you</span></button>
      <button class="btn big family" data-action="family">পরিবারকে ফোন দিন<span class="en">Calls your trusted family member</span></button>
      <div class="why">${res ? "risk " + res.risk + "/100 · " + esc((res.scam && res.scam.label) || "") + " · " + (res.engine === "live" ? "live agent" : "on-device") : ""}</div>
      <button class="btn accept" style="background:#8f2a22;border-color:#a3352f;color:#ffd9d5" data-action="override">আমি জানি, পাঠিয়ে দিই<span class="en">Send anyway — respected, and reported to the radar</span></button>
    </div>` : "";
  const outcome = state.resolved === "family"
    ? `<div class="card ok"><h4>✅ পরিবারকে ফোন দেওয়া হয়েছে</h4><p>টাকা যায়নি।</p><span class="en">Money never left the phone.</span></div>`
    : state.resolved === "verify"
      ? `<div class="card ok"><h4>৯৯৯ — সংযোগ হচ্ছে</h4><p>“পুলিশ কি কখনো ফোনে টাকা চায়?” — না।</p><span class="en">Verified through the official line.</span></div>`
      : state.resolved === "override"
        ? `<div class="card stop"><h4>পাঠানো হয়েছে</h4><p>রিপোর্ট জমা হয়েছে, নম্বরটি রাডারে গেছে।</p><span class="en">Choice respected; the network still learns.</span></div>`
        : "";
  return `${statusbar()}<div class="app-body">
    <div class="sc-title">টাকা পাঠান</div>
    <div class="sc-sub">bKash · receiver</div>
    <div class="card"><div class="kv">
      <dt>নম্বর</dt><dd style="font-family:var(--latin)">${esc(AMMU_NUMBER)}</dd>
      <dt>নাম</dt><dd>রাকিব (ছেলে) — বলে দেওয়া</dd>
      <dt>পরিমাণ</dt><dd>${taka(30000)}</dd>
      <dt>মাধ্যম</dt><dd style="font-family:var(--latin)">*247# · অ্যাপ · এজেন্ট</dd></div></div>
    ${state.paused ? "" : `<button class="btn big" data-action="do-send">পাঠান<span class="en">Send — this is where a scam succeeds</span></button>
      <div class="note">The pause fires on the <b>action</b>: USSD, in-app transfer, an OTP read-out, a forwarding code, or an unknown install.</div>`}
    ${outcome}${overlay}
  </div>`;
}

/* ── screen: Apon Jon ─────────────────── */
function scrAponJon() {
  const alertCard = state.sonState === "idle"
    ? "<p>এখনো কোনো অ্যালার্ট যায়নি। এই অংশেই স্বস্তি।</p>"
    : state.sonState === "alert"
      ? `<p><b>আম্মুর ফোনে সন্দেহজনক কল চলছে</b></p><span class="en">Suspicious call running on Ammu's phone — one tap to call back.</span>`
      : `<p>${esc(D.FAMILY.son.name)} আম্মুকে ফোন দিয়েছেন।</p><span class="en">“আম্মু, আমি তো হলে! আমার কিছু হয়নি। ওটা প্রতারক, টাকা পাঠাবা না.”</span>`;
  return `${statusbar()}<div class="app-body">
    <div class="sc-title">আপনজন</div>
    <div class="sc-sub">Two minutes to set up for a parent, with a QR code.</div>
    <div class="qr">${pseudoQr()}</div>
    <div class="note" style="text-align:center;margin-bottom:12px">ডেমো QR — স্ক্যান করা যাবে না</div>
    <div class="card"><h4>গোপন পরিবার-শব্দ</h4>
      <p>কারো বিপদের কথা ফোনে শুনলে আগে এই শব্দটা জিজ্ঞেস করুন: <b>${esc(D.FAMILY.secretWord)}</b></p>
      <span class="en">A cloned voice of your own child cannot pass this.</span></div>
    <div class="card ${state.sonState === "alert" ? "warn" : ""}"><h4>সর্বশেষ অ্যালার্ট</h4>${alertCard}</div>
    <div class="card"><h4>${esc(D.FAMILY.ammu.name)} · ${esc(D.FAMILY.ammu.device)}</h4>
      <div class="chips"><span class="chip">স্পোকেন বাংলা</span><span class="chip">পড়া লাগে না</span><span class="chip">বড় বাটন</span><span class="chip calm">একবারে একটা প্রশ্ন</span></div>
      <span class="en" style="display:block;margin-top:8px">${esc(D.FAMILY.ammu.note)}</span></div>
  </div>`;
}

/* ── screen: agent ────────────────────── */
function scrAgent() {
  const rep = E.reputation(AMMU_NUMBER);
  const shop = D.AGENT_SHOPS[0];
  return `${statusbar()}<div class="app-body">
    <div class="sc-title">এজেন্ট অ্যাপ</div>
    <div class="sc-sub">${esc(shop.shop)} · ${esc(shop.area)}</div>
    <div class="card"><div class="kv">
      <dt>Cash out</dt><dd>${taka(30000)}</dd>
      <dt>রিসিভার</dt><dd style="font-family:var(--latin)">${esc(AMMU_NUMBER)}</dd>
      <dt>গ্রাহক</dt><dd>মেয়ে, ৫২ বছর</dd></div></div>
    <div class="card stop"><h4>⚠️ এই নম্বরে প্রতারণার প্রতিবেদন আছে</h4>
      <p>${rep.reports} জন একই কথা বলেছেন। গ্রাহককে জিজ্ঞেস করুন: “কাউকে পাঠাচ্ছেন, কেন?”</p>
      <span class="en">“Kake pathachchen, keno?” — the question that already saves people.</span>
      ${reputationChips(rep)}</div>
    <button class="btn big" data-action="agent-question">প্রশ্নটা করা হলো<span class="en">Shopkeeper asks the question</span></button>
    <div class="note">বাধ্যতামূলক ব্লক নয় — এজেন্টের ইনসেন্টিভ ও প্রশিক্ষণে চলে।<br>Advisory only, so it cannot be abused to hold people's money.</div>
  </div>`;
}

/* ── screen: after ────────────────────── */
function scrAfter() {
  const c = state.complaint;
  const signals = c && Array.isArray(c.signals) ? c.signals : [];
  return `${statusbar()}<div class="app-body">
    <div class="sc-title">কী হয়েছে, বলে ফেলুন</div>
    <div class="sc-sub">No form, no typing, no reading. Just speak in Bangla.</div>
    <div class="card"><p style="font-size:16px">“থানার ওসি বলে ফোন করছিল, ছেলেকে ইয়াবাসহ ধরা হয়েছে বলল, ৩০ হাজার টাকা বিকাশ করতে বলল, কাউকে বলতে মানা করল。”</p>
      <span class="en">Victim's spoken account, transcribed.</span></div>
    <button class="btn" data-action="make-complaint">${c ? "আবার তৈরি করুন" : "অভিযোগ তৈরি করুন"}<span class="en">Turn the story into a filing-ready complaint</span></button>
    ${c ? `<div class="card warn"><h4>প্রেরক: ${c.to.map(esc).join(" · ")}</h4>
      <div style="white-space:pre-wrap;font-size:15.5px">${esc(c.body)}</div>
      ${signalChips(signals)}
      <div class="note" style="margin-top:8px">AI খসড়া (${c.engine === "live" ? "hosted agent" : "ফোনের ভেতরেই"}) · জমার আগে আপনি নিশ্চিত করবেন।
      ${c.fallbackReason ? "<br>fallback: " + esc(c.fallbackReason) : ""}</div></div>
      <button class="btn big family" data-action="submit-complaint">জমা দিন<span class="en">File with GP fraud cell, MFS provider and 999</span></button>` : ""}
  </div>`;
}

/* ── screen: radar ────────────────────── */
function scrRadar() {
  const net = D.NETWORKS.find(n => n.id === state.radarOpen) || D.NETWORKS[0];
  const rows = D.REPORTS.filter(r => net.linked.includes(r.number)).slice(0, 8);
  const totalNumbers = D.NETWORKS.reduce((s, n) => s + n.linked.length, 0);
  return `${statusbar()}<div class="app-body" style="max-width:none">
    <div class="sc-title">স্ক্যাম রাডার</div>
    <div class="sc-sub">${D.STATS.attempts} attempts · ${D.STATS.stopped} stopped · ${D.STATS.stopRate}% interrupted</div>
    <div class="chips" style="margin-bottom:14px">${D.NETWORKS.map(n =>
      `<button class="tbtn" data-action="open-net" data-id="${n.id}" style="${n.id === net.id ? "background:var(--amber);color:#241703;border-color:var(--amber);font-weight:700" : ""}">${esc(n.name)}</button>`).join("")}</div>
    <div class="card"><h4>${esc(net.name)}</h4><div class="kv">
      <dt>স্ক্রিপ্ট</dt><dd>${esc(net.script)}</dd>
      <dt>মূল নম্বর</dt><dd style="font-family:var(--latin)">${esc(net.number)}</dd>
      <dt>লিংকড নম্বর</dt><dd>${net.linked.length} — একই ভাষা, আলাদা সিম</dd>
      <dt>জেলা</dt><dd>${net.districts}</dd>
      <dt>প্রতিবেদন</dt><dd>${net.reports}</dd>
      <dt>চাওয়া টাকা</dt><dd>${taka(net.amount)}</dd>
      <dt>অবস্থা</dt><dd>${net.blocked ? "✅ ব্লক প্রস্তাবিত" : "🔴 চলমান"}</dd></div>
      <div class="chips">${net.linked.map(l => `<span class="chip hot" style="font-family:var(--latin)">${esc(l)}</span>`).join("")}</div></div>
    <div class="card"><h4>প্রতিবেদন (ডেমো)</h4>
      <table><thead><tr><th>আইডি</th><th>জেলা</th><th>ধরন</th><th class="num">টাকা</th><th class="num">থামল</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td style="font-family:var(--latin)">${esc(r.id)}</td><td>${esc(r.district)}</td>
        <td>${esc(D.TYPE_LABELS[r.type] || r.type)}</td><td class="num">${r.amount ? Number(r.amount).toLocaleString("en-US") : "—"}</td>
        <td class="num">${r.stopped ? "✅" : "❌"}</td></tr>`).join("")}</tbody></table></div>
    <div class="card"><h4>একই স্ক্রিপ্ট, আলাদা নম্বর</h4>
      <div class="bars"><span class="note" style="width:78px;font-family:var(--latin)">authority</span><i class="bar" style="width:88%"></i></div>
      <div class="bars"><span class="note" style="width:78px;font-family:var(--latin)">urgency</span><i class="bar" style="width:71%"></i></div>
      <div class="bars"><span class="note" style="width:78px;font-family:var(--latin)">secrecy</span><i class="bar" style="width:64%"></i></div>
      <div class="note" style="margin-top:10px">ব্লকলিস্ট ${totalNumbers}টা নম্বর দেখে। Shotorko ${D.NETWORKS.length}টা নেটওয়ার্ক দেখে।</div></div>
  </div>`;
}

/* ── screen: free-play classifier ─────── */
function scrConsole() {
  const r = state.lastConsole;
  const sitKeys = Object.keys(state.consoleSituation);
  return `${statusbar()}<div class="app-body" style="max-width:none">
    <div class="sc-title">নিজে পরীক্ষা করুন</div>
    <div class="sc-sub">Paste or type any scam line — Bangla, Banglish, or a dialect spelling.</div>
    <textarea id="ctext" rows="4">${esc(state.consoleText)}</textarea>
    <div class="chips" style="margin:10px 0 12px">${sitKeys.map(k =>
      `<span class="chip ${state.consoleSituation[k] ? "hot" : ""}" data-action="sit" data-k="${k}" style="cursor:pointer;font-family:var(--latin)">${esc(k)} ${state.consoleSituation[k] ? "✓" : "—"}</span>`).join("")}</div>
    <button class="btn big" data-action="run-console">বিশ্লেষণ করুন<span class="en">Run the model</span></button>
    ${r ? `<div class="card ${r.wouldPause ? "stop" : "ok"}" style="margin-top:12px">
      <h4>${r.wouldPause ? "🔴 থামুন সক্রিয় হবে" : "🟢 থামুন নীরব থাকবে"}</h4>
      <div class="meter"><i style="width:${Math.max(0, Math.min(100, r.risk))}%"></i></div>
      <div class="meter-row"><span>risk ${r.risk}/100</span><span>threshold ${r.threshold}</span></div>
      <div class="kv" style="margin-top:12px">
        <dt>ধরন</dt><dd>${esc((r.scam && r.scam.label) || "শনাক্ত হয়নি")}</dd>
        <dt>ভয় / তাড়া / একা</dt><dd>${r.fear.scare ? "🔴" : "🟢"} · ${r.fear.rush ? "🔴" : "🟢"} · ${r.fear.isolate ? "🔴" : "🟢"}</dd>
        <dt>ইঞ্জিন</dt><dd>${r.engine === "live" ? "hosted agent (live)" : "অন-ডভাইস ফলব্যাক"}</dd></div>
      ${signalChips(r.hits)}${termList(r.hits)}
      ${r.fallbackReason ? `<div class="note" style="margin-top:10px">fallback: ${esc(r.fallbackReason)}</div>` : ""}</div>` : ""}
    <div class="card" style="margin-top:12px"><h4>একই উদ্দেশ্য, অন্য কথা</h4>
      <div class="note" style="margin-bottom:8px">Same intent, different words. A word list fails here; meaning does not.</div>
      ${D.ALT_SCRIPT.map((a, i) => `<button class="btn accept" style="text-align:left;font-size:15px" data-action="alt" data-i="${i}">${esc(a.bangla)}<span class="en">${esc(a.en)}</span></button>`).join("")}</div>
  </div>`;
}

function scrRejected() {
  return `${statusbar()}<div class="app-body">
    <div class="sc-title">কল কাটা হলো</div>
    <div class="card ok"><p>আপনিই ঠিক করেছেন। Shotorko কল ব্লক করে না — শুধু জানায়।</p>
      <span class="en">Warning, never blocking. Agency stays with the user.</span></div>
    <button class="btn" data-action="goto" data-m="precall">আবার দেখুন<span class="en">Back to the call</span></button></div>`;
}

/* ── devices ──────────────────────────── */
function renderSon() {
  const box = $("#son-screen");
  if (!box) return;
  if (state.sonState === "idle") {
    box.innerHTML = `${statusbar("রাকিব")}<div class="app-body">
      <div class="sc-title">রাকিব</div>
      <div class="sc-sub">Apon Jon · ${esc(D.FAMILY.ammu.name)}</div>
      <div class="card ok"><h4>🟢 সব ঠিক আছে</h4><p>আম্মুর ফোনে কোনো সন্দেহজনক কল নেই।</p>
        <span class="en">Quiet. No alert. That is the point.</span></div>
      <div class="card"><div class="kv"><dt>সেটআপ</dt><dd>QR · ২ মিনিট</dd>
        <dt>গোপন শব্দ</dt><dd>সেট করা আছে</dd>
        <dt>আম্মুর ফোন</dt><dd>${esc(D.FAMILY.ammu.device)}</dd></div></div>
    </div>`;
  } else if (state.sonState === "alert") {
    box.innerHTML = `${statusbar("রাকিব")}<div class="app-body">
      <div class="incoming"><div class="st">🔴 APON JON ALERT</div>
        <div class="who" style="font-size:26px;line-height:1.35">আম্মুর ফোনে সন্দেহজনক কল চলছে</div>
        <div class="num" style="font-size:15px">${esc(AMMU_NUMBER)} · ${esc(D.FAMILY.ammu.name)}</div>
        <div class="wave">${"<i></i>".repeat(9)}</div></div>
      <button class="btn big family" data-action="son-call">এক ট্যাপে ফোন<span class="en">Call Ammu right now</span></button>
      <div class="card"><span class="en">Nothing to read, one tap to act. 168 family call-backs this month.</span></div>
    </div>`;
  } else if (state.sonState === "talking") {
    box.innerHTML = `${statusbar("রাকিব")}<div class="app-body">
      <div class="incoming"><div class="st">কল চালু · ${esc(D.FAMILY.ammu.name)}</div><div class="who" style="font-size:34px">📞</div></div>
      <div class="card ok"><p style="font-size:18px">“আম্মু, আমি তো হলে! আমার কিছু হয়নি। ওটা প্রতারক, টাকা পাঠাবা না。”</p>
        <span class="en">“Ammu, I am in the hall. Nothing happened. That one is a scammer — don't send money.”</span></div>
      <button class="btn" data-action="son-done">আম্মু এখন নিরাপদ<span class="en">Ammu is safe</span></button>
    </div>`;
  } else {
    box.innerHTML = `${statusbar("রাকিব")}<div class="app-body">
      <div class="sc-title">রক্ষা পেয়েছেন ✅</div>
      <div class="card ok"><p>টাকা যায়নি। ৪১ সেকেন্ডের থামাটাই সব বদলে দিয়েছে।</p>
        <span class="en">Forty-one seconds of pause. That is the whole product.</span></div>
      <div class="card"><div class="kv"><dt>পথ</dt><dd>থামুন → পরিবার → যাচাই</dd>
        <dt>রাডারে</dt><dd>হ্যাঁ — NET-A তে যুক্ত</dd></div></div>
    </div>`;
  }
}

/* ── presenter rail ───────────────────── */
function renderRail() {
  const m = MODULES.find(x => x.key === state.module);
  const n = NOTES[m.key];
  const res = state.lastResult;
  const rail = $("#rail");
  rail.innerHTML = `
    <div class="block"><h3>Scene</h3>
      <p style="font-size:17px"><b>${esc(m.title)}</b></p>
      <p class="en">${esc(m.en)}</p>
      <p style="margin-top:10px">${esc(n.say)}</p></div>
    <div class="block"><h3>Engine output</h3>
      ${res ? `<div class="meter"><i style="width:${Math.max(0, Math.min(100, res.risk))}%"></i></div>
        <div class="meter-row"><span>risk ${res.risk}/100</span><span>${res.engine === "live" ? "live agent" : "on-device"}</span></div>
        <div class="kv" style="margin-top:12px">
          <dt>ধরন</dt><dd>${esc((res.scam && res.scam.label) || "—")}</dd>
          <dt>scare</dt><dd>${res.fear.scare ? "🔴 yes" : "🟢 no"}</dd>
          <dt>rush</dt><dd>${res.fear.rush ? "🔴 yes" : "🟢 no"}</dd>
          <dt>isolate</dt><dd>${res.fear.isolate ? "🔴 yes" : "🟢 no"}</dd>
          <dt>pause</dt><dd>${res.wouldPause ? "🔴 fires" : "🟢 stays quiet"}</dd></div>
        ${signalChips(res.hits)}${termList(res.hits)}`
        : `<p class="note">No analysis yet. Play the story, or open “নিজে যাচাই”.</p>`}</div>
    <div class="block"><h3>In production</h3><p class="note">${esc(n.prod)}</p></div>
    <div class="block"><h3>What is simulated</h3>
      <p class="note">Caller reputation, the live call audio, USSD and app triggers, the agent-shop feed and the Scam Radar records are demo data. The classifier, the pause decision and the complaint writer run for real in this page.</p></div>`;
}

function renderTabs() {
  $("#tabs").innerHTML = MODULES.map(m =>
    `<button role="tab" aria-selected="${m.key === state.module}" data-action="goto" data-m="${m.key}"><span class="num">${m.num}</span>${esc(m.tab)}</button>`).join("");
}
function renderEngineBadge() {
  const b = $("#engine-badge");
  b.className = "pill " + (state.engine === "live" ? "live" : "local");
  b.textContent = state.engine === "live" ? "Live AI" : "On-device engine";
}
function renderSound() { $("#sound-btn").textContent = state.sound ? "🔊 Sound" : "🔇 Muted"; }

/* ── decorative QR (does not encode anything) ── */
function pseudoQr() {
  let seed = 20261017;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const finder = (x, y) => {
    const fx = x < 7 ? 0 : x > 13 ? 14 : -1;
    const fy = y < 7 ? 0 : 14;
    if (fx < 0 || (x >= 7 && x <= 13 && y < 7 && y >= 7)) return null;
    const lx = x - fx, ly = y - fy;
    if (lx > 6 || ly > 6) return null;
    const ring = lx === 0 || lx === 6 || ly === 0 || ly === 6;
    const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
    return ring || core;
  };
  let cells = "";
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
    const f = finder(x, y);
    const on = f === null ? rnd() > .52 : f;
    if (on) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  return `<svg viewBox="0 0 21 21" shape-rendering="crispEdges" aria-hidden="true"><g fill="#0d1117">${cells}</g></svg>`;
}

/* ── actions ──────────────────────────── */
const ACTIONS = {
  goto: (d) => setModule(d.m),
  toggle: (d) => { state.consent[d.key] = !state.consent[d.key]; draw(); },
  "accept-call": () => { state.transcript = D.CALL_SCRIPT.slice(0, 2); setModule("during"); },
  "reject-call": () => { $("#ammu-screen").innerHTML = scrRejected(); },
  "next-line": () => {
    const i = state.transcript.length;
    if (i >= D.CALL_SCRIPT.length) return;
    const t = D.CALL_SCRIPT[i];
    state.transcript = D.CALL_SCRIPT.slice(0, i + 1);
    if (!state.softWarned && (t.signals.includes("payment") || t.signals.includes("urgency"))) {
      state.softWarned = true;
      setTimeout(() => speak("সতর্ক থাকুন। পুলিশ কখনো ফোনে টাকা চায় না।", true), 250);
    }
    draw();
  },
  "to-thamun": () => firePause(),
  "do-send": () => firePause(),
  verify: () => { state.resolved = "verify"; draw(); speak("আসল কিনা যাচাই করা হচ্ছে। পুলিশ কখনো ফোনে টাকা চায় না।"); },
  family: () => { state.resolved = "family"; state.sonState = "alert"; draw(); speak("আপনার ছেলেকে ফোন করা হচ্ছে।"); },
  override: () => { state.resolved = "override"; draw(); },
  "son-call": () => { state.sonState = "talking"; draw(); speak("আম্মু, আমি তো হলে! আমার কিছু হয়নি। ওটা প্রতারক, টাকা পাঠাবা না।"); },
  "son-done": () => { state.sonState = "done"; draw(); },
  "agent-question": () => {
    const box = $("#ammu-screen .app-body");
    if (!box || $("#agent-done")) return;
    box.appendChild(el(`<div class="card ok fadein" id="agent-done"><h4>“কাউকে পাঠাচ্ছেন, কেন?”</h4>
      <p>এজেন্ট প্রশ্ন করেছে। আম্মু থেমে গেছেন। টাকা যায়নি।</p>
      <span class="en">One question at the counter stops what no app can reach.</span></div>`));
  },
  "make-complaint": async (d, btn) => {
    if (btn) btn.disabled = true;
    if (state.engine === "live") markBusy("AI খসড়া লিখছে…");
    state.complaint = await generateComplaint({
      text: "থানার ওসি বলে ফোন করছিল, আমার ছেলেকে ইয়াবাসহ ধরা হয়েছে বলল, মামলা না চাইলে এখনই ৩০ হাজার টাকা বিকাশ করতে বলল, আর কাউকে বলতে মানা করল।",
      number: AMMU_NUMBER, time: "১৪ অক্টোবর, রাত ৯:৪১", amount: "৩০,০০০ টাকা"
    });
    draw();
  },
  "submit-complaint": () => {
    const box = $("#ammu-screen .app-body");
    if (!box || $("#complaint-sent")) return;
    box.appendChild(el(`<div class="card ok fadein" id="complaint-sent"><h4>✅ জমা হয়েছে</h4>
      <p>GP ফ্রড সেল · MFS প্রোভাইডার · পুলিশ / ৯৯৯</p>
      <span class="en">One spoken story became three actionable filings.</span></div>`));
  },
  "open-net": (d) => { state.radarOpen = d.id; draw(); },
  "run-console": async (d, btn) => {
    const ta = $("#ctext");
    if (ta) state.consoleText = ta.value;
    if (btn) btn.disabled = true;
    if (state.engine === "live") markBusy("বিশ্লেষণ চলছে…");
    const r = await analyze(state.consoleText, state.consoleSituation);
    state.lastConsole = r; state.lastResult = r;
    draw();
  },
  alt: async (d) => {
    const a = D.ALT_SCRIPT[+d.i];
    if (!a) return;
    state.consoleText = a.bangla;
    if (state.engine === "live") markBusy("বিশ্লেষণ চলছে…");
    const r = await analyze(a.bangla, state.consoleSituation);
    state.lastConsole = r; state.lastResult = r;
    draw();
    const box = $("#ammu-screen .app-body");
    if (box) box.insertBefore(el(`<div class="card warn fadein"><span class="en">Target class: ${esc(a.expect)} · model said: ${esc((r.scam && r.scam.key) || "none")} · risk ${r.risk}</span></div>`), box.firstChild);
  },
  sit: (d) => { state.consoleSituation[d.k] = !state.consoleSituation[d.k]; draw(); },
  "set-engine": (d) => { state.engine = d.v; renderEngineBadge(); },
  sound: () => { state.sound = !state.sound; renderSound(); },
  reset: () => { stopRun(); resetState(); draw(); }
};

async function firePause() {
  const convo = state.transcript.length ? state.transcript.map(t => t.bangla).join(" ") : CONVO;
  const r = await analyze(convo, {
    unknownCaller: true, callActive: true, newReceiver: true, unusualAmount: true, lateNight: true,
    optInConsent: state.consent.thamun
  });
  state.lastResult = r;
  state.paused = r.wouldPause;
  state.resolved = null;
  setModule("thamun");
  if (r.wouldPause) speak("কেউ কি ফোনে ভয় দেখাচ্ছে বা তাড়াতাড়ি করতে বলছে?");
}

function setModule(key) {
  if (!MODULES.find(m => m.key === key)) key = "home";
  state.module = key;
  if (key === "during" && !state.transcript.length) state.transcript = D.CALL_SCRIPT.slice(0, 1);
  if (key === "thamun" && !state.lastResult) firePause();
  if (history.replaceState) history.replaceState(null, "", "#" + key);
  draw();
}

function resetState() {
  Object.assign(state, {
    module: "home", transcript: [], softWarned: false, paused: false, resolved: null,
    lastResult: null, complaint: null, sonState: "idle", radarOpen: "NET-A", lastConsole: null, stepIndex: 0
  });
}

/* ── scripted presenter run ───────────── */
const SCENARIO = [
  { m: "home", hold: 2400 },
  { m: "precall", hold: 3600, say: "সাবধান, এই নম্বরটি সন্দেহজনক।" },
  { act: "accept-call", hold: 2200 },
  { act: "next-line", hold: 1800 }, { act: "next-line", hold: 1800 },
  { act: "next-line", hold: 1800 }, { act: "next-line", hold: 2000 },
  { m: "during", hold: 1800, say: "সতর্ক থাকুন। পুলিশ কখনো ফোনে টাকা চায় না।" },
  { act: "to-thamun", hold: 4600, say: "কেউ কি ফোনে ভয় দেখাচ্ছে বা তাড়াতাড়ি করতে বলছে?" },
  { act: "family", hold: 3000 },
  { act: "son-call", hold: 3800, say: "আম্মু, আমি তো হলে! আমার কিছু হয়নি। ওটা প্রতারক, টাকা পাঠাবা না।" },
  { act: "son-done", hold: 2400 },
  { m: "after", hold: 2200 },
  { act: "make-complaint", hold: 4600 },
  { m: "agent", hold: 2800 },
  { act: "agent-question", hold: 2800 },
  { m: "radar", hold: 3600 },
  { m: "console", hold: 1400 },
  { act: "run-console", hold: 5200 }
];

function stopRun() { clearTimeout(state.timer); state.running = false; $("#run-btn").textContent = "▶ Play the story"; }

async function runScenario() {
  if (state.running) return stopRun();
  state.running = true;
  resetState(); draw();
  for (let i = state.stepIndex; i < SCENARIO.length; i++) {
    if (!state.running) return;
    state.stepIndex = i;
    const s = SCENARIO[i];
    if (s.m) setModule(s.m);
    if (s.act) { const fn = ACTIONS[s.act]; if (fn) await fn({}, null); }
    if (s.say) speak(s.say);
    $("#run-btn").textContent = `⏸ Stop ${i + 1}/${SCENARIO.length}`;
    await new Promise(r => { state.timer = setTimeout(r, s.hold); });
  }
  state.stepIndex = 0;
  stopRun();
}

/* ── draw ─────────────────────────────── */
const RENDER = {
  home: scrHome, precall: scrPreCall, during: scrDuring, thamun: scrThamun,
  aponjon: scrAponJon, agent: scrAgent, after: scrAfter, radar: scrRadar, console: scrConsole
};

function draw() {
  const wide = state.module === "radar" || state.module === "console";
  $("#ammu-screen").innerHTML = (RENDER[state.module] || scrHome)();
  if (state.module === "precall") $("#basic-screen").innerHTML = scrPreCallBasic();
  $("#basic-device").classList.toggle("hide", state.module !== "precall");
  $("#son-device").classList.toggle("hide", wide);
  $("#devices").classList.toggle("wide", wide);
  $("#ammu-device").classList.toggle("widephone", wide);
  renderSon(); renderTabs(); renderRail();
  $("#step-label").textContent = MODULES.find(m => m.key === state.module).title;
}

function boot() {
  $("#brand-tag").innerHTML = "AI that stops scams at the moment of fear · <b>থামুন। যাচাই করুন। পরিবারকে জানান।</b>";
  const start = (location.hash || "").replace("#", "");
  if (MODULES.find(m => m.key === start)) setModule(start); else draw();
  renderEngineBadge(); renderSound();

  window.addEventListener("hashchange", () => {
    const k = (location.hash || "").replace("#", "");
    if (MODULES.find(m => m.key === k) && k !== state.module) setModule(k);
  });

  fetch("/functions/v1/app/health", { credentials: "same-origin" })
    .then(r => (r.ok ? r.json() : null))
    .then(j => { if (j && j.ok === true) { state.liveAvailable = true; $("#engine-switch").classList.remove("hide"); } })
    .catch(() => { /* offline is the designed state */ });

  document.addEventListener("click", ev => {
    const t = ev.target.closest("[data-action]");
    if (!t) return;
    const fn = ACTIONS[t.dataset.action];
    if (fn) fn(t.dataset, t);
  });
  document.addEventListener("keydown", ev => {
    if (ev.target && /^(TEXTAREA|INPUT)$/.test(ev.target.tagName)) return;
    const i = MODULES.findIndex(m => m.key === state.module);
    if (ev.key === " ") { ev.preventDefault(); runScenario(); }
    else if (ev.key === "ArrowRight") setModule(MODULES[(i + 1) % MODULES.length].key);
    else if (ev.key === "ArrowLeft") setModule(MODULES[(i - 1 + MODULES.length) % MODULES.length].key);
  });
  document.addEventListener("input", ev => { if (ev.target.id === "ctext") state.consoleText = ev.target.value; });

  $("#run-btn").addEventListener("click", runScenario);
  $("#sound-btn").addEventListener("click", () => ACTIONS.sound());
  $("#reset-btn").addEventListener("click", () => ACTIONS.reset());
  $("#engine-local").addEventListener("click", () => ACTIONS["set-engine"]({ v: "local" }));
  $("#engine-live").addEventListener("click", () => ACTIONS["set-engine"]({ v: "live" }));
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
