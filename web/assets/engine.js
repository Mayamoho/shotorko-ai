/*
 * Shotorko on-device risk engine (the offline fallback of the prototype).
 *
 * Two separate jobs, because a scam has two halves:
 *   1. WHY IT IS DANGEROUS — intent signals (fake authority, leverage, rush,
 *      secrecy, a code ask, a money ask, a lure, an install).
 *   2. WHAT IT WANTS — the action that actually causes the loss.
 * The pause fires only when both are true: high risk AND a requested action.
 * That is the product rule "stop the action, not the call".
 *
 * Matching is phrase-stem based, not a fixed blocklist, so rewording a script
 * keeps the signals. It is still a fallback: the production model reads meaning.
 */
(function (global) {
  "use strict";

  const SIGNALS = {
    authority: {
      label: "ভুয়া ক্ষমতা · fake authority", weight: 22,
      terms: ["থানার ওসি", "ওসি বলছি", "ওসি সাহেব", "থানা", "পুলিশ", "পুলিশ অফিসার", "ডিবি", "সিআইডি", "পিবিআই", "র‍্যাব", "র্যাব", "মামলা", "জিডি", "case", "গ্রেপ্তার", "ধরা হয়েছে", "আটক", "আদালত", "কোর্টে", "বিকাশ অফিস", "নগদ অফিস", "রকেট অফিস", "অফিস থেকে বলছি", "সাবস্ক্রিপশন বাতিল", "account suspend", "thanar oci", "police", "polish", "db officer", "cid", "pbi", "rab", "mamla", "gd hoyeche", "arrest", "court", "adalat", "officer theke", "suspend", "blocked", "bapman"]
    },
    leverage: {
      label: "আপনজনের বিপদ · loved one in trouble", weight: 24,
      terms: ["ছেলে", "মেয়ে", "বাবা", "আব্বু", "আম্মু", "স্বামী", "স্ত্রী", "জামাই", "বউ", "হাসপাতাল", "অ্যাক্সিডেন্ট", "দুর্ঘটনা", "জেলে", "ইয়াবা", "ছেড়াতে", "ছাড়াতে", "ভিসা", "চাকরি দিচ্ছি", "chele", "chhele", "maye", "bappa", "abu", "ammu", "hospital", "accident", "jail", "yaba", "charate", "charabe", "taka lagbe", "girehtar"]
    },
    urgency: {
      label: "তাড়াতাড়ি করা হচ্ছে · being rushed", weight: 20,
      terms: ["এখনই", "এখনি", "এখোনি", "এই মুহূর্তে", "আজকের মধ্যে", "তাড়াহুড়ো", "দেড়ি", "মিনিটে", "লাইন কেটে", "বন্ধ হয়ে যাবে", "পরে করলে", "শুধু এখন", "ekhoni", "ekhon", "ekkhon", "ekhonoi", "ajker moddhe", "taratadi", "turanto", "right now", "just now", "minute lagbe", "bondho hoye jabe", "kete jabe"]
    },
    secrecy: {
      label: "কাউকে বলতে নিষেধ · told to stay silent", weight: 26,
      terms: ["কাউকে বলবেন না", "কাউকে বলো না", "কাউকে বলবা না", "কাউকে বলা যাবে না", "কারওকে বলবেন না", "কারওকে বলো না", "কাকেও বলবেন না", "কাউকে জানাবেন না", "কাউকে कहेंगे না", "কাউকে কিছু বলো না", "কেউ জানলে", "গোপন রাখ", "গোপন", "kauke bolben na", "kauke bolna", "kauke bolba na", "kakeo bolben na", "karoke bolna", "gopon", "jana korben na", "nobody should know", "don't tell"]
    },
    credential: {
      label: "গোপন কোড চাওয়া · secret code asked", weight: 28,
      terms: ["ওটিপি", "otp", "পিন নম্বর", "পিন", "সিকিউরিটি কোড", "পাসওয়ার্ড", "কনফার্ম কোড", "ভেরিফিকেশন কোড", "আইভিআরএফ", "ivrf", "কোডটা", "কোড বলুন", "security code", "password", "confirm code", "pin number", "verification code", "call forwarding", "ফরোয়ার্ডিং", "*21", "*247#"]
    },
    payment: {
      label: "টাকা পাঠাতে বলা · money asked for", weight: 30,
      terms: ["টাকা", "তাকা", "বিকাশ", "নগদ", "রকেট", "ইউপাই", "পাঠান", "পাঠাবেন", "পাঠাইয়া", "পাঠাও", "সেন্ড", "ট্রান্সফার", "ক্যাশ", "ফেরত", "রিফান্ড", "হাজার", "লক্ষ", "জামানত", "একাউন্ট ফি", "অ্যাকাউন্ট ফি", "ফি দিতে", "চার্জ", "taka", "money", "bikash", "bkash", "nagad", "rocket", "send", "transfer", "cash", "refund", "hazar", "lakh", "cash in"]
    },
    reward: {
      label: "লোভ দেখানো · tempting reward", weight: 18,
      terms: ["ইনাম", "জ্যাকপট", "প্রাইজ", "লটারি", "ফ্রি", "বোনাস", "জিতেছেন", "নির্বাচিত", "অফার", "মেগা ডিল", "চাকরি দেব", "ঋণ মিলবে", "inam", "jackpot", "prize", "lottery", "free", "bonus", "you won", "selected", "offer", "loan"]
    },
    install: {
      label: "অ্যাপ বা স্ক্রিন শেয়ার · app or screen share", weight: 24,
      terms: ["অ্যাপ ইনস্টল", "অ্যাপ ডাউনলোড", "ডাউনলোড করুন", "লিংক সেন্ড করলাম", "লিংকে ক্লিক", "স্ক্রিন শেয়ার", "রিমোট অ্যাক্সেস", "app install", "download korun", "link e click", "anydesk", "teamviewer", "screen share", "remote access", "apk"]
    }
  };

  const SCAM_TYPES = [
    { key: "police", label: "ভুয়া পুলিশ / মামলা" },
    { key: "account", label: "অ্যাকাউন্ট ব্লক / ভুয়া MFS অফিসার" },
    { key: "otp", label: "ওটিপি / অ্যাকাউন্ট হ্যাক" },
    { key: "emergency", label: "আপনজনের জরুরি বিপদ" },
    { key: "refund", label: "ভুল পাঠানো / রিফান্ড" },
    { key: "prize", label: "ইনাম / চাকরি / ঋণ" },
    { key: "forward", label: "কল ফরোয়ার্ডিং দখল" },
    { key: "remote", label: "ফেক অ্যাপ / স্ক্রিন শেয়ার" }
  ];

  const TRIGGERS = [
    { key: "send_money", label: "টাকা পাঠানো", terms: ["টাকা পাঠান", "বিকাশ করুন", "taka pathan", "bikash koren", "send money", "cash in", "*247#", "টাকা দিন", "পাঠাও"], path: "USSD · app · agent shop" },
    { key: "share_otp", label: "ওটিপি শেয়ার", terms: ["ওটিপি", "otp", "পিন", "security code", "ivrf", "ভেরিফিকেশন"] },
    { key: "forward_code", label: "কল ফরোয়ার্ডিং কোড", terms: ["*21", "ফরোয়ার্ডিং", "forward"] },
    { key: "install_app", label: "অজানা অ্যাপ ইনস্টল", terms: ["app install", "download korun", "link e click", "anydesk", "screen share", "অ্যাপ"] }
  ];

  const PHRASES = {
    suspend: ["সাসপেন্ড", "ব্লক", "বাতিল", "হ্যাঁক", "হ্যাক", "suspend", "block", "batil", "hack"],
    forwarding: ["*21", "ফরোয়ার্ডিং", "forward"],
    refund: ["ফেরত", "রিফান্ড", "ফেরত পাবেন", "refund", "return korbo"],
    otpAsk: ["ওটিপি", "otp", "ভেরিফিকেশন", "কনফার্ম", "ivrf", "security code", "pin"]
  };

  /* Numbers the demo dataset marks. Keys are the last 10 digits. */
  const DEMO_NUMBERS = {
    "1711234567": { number: "01711-234567", reports: 41, age: "৪ দিনের নতুন সিম", fanout: "২৪৭ অজানা নম্বরে কল", verdict: "suspicious", script: "থানার ওসি — ইয়াবা মামলা", source: "demo data" },
    "1919876543": { number: "01919-876543", reports: 17, age: "৯ দিনের নতুন সিম", fanout: "৮৯ অজানা নম্বরে কল", verdict: "suspicious", script: "বিকাশ অফিস — অ্যাকাউন্ট সাসপেন্ড / ওটিপি", source: "demo data" },
    "1875555123": { number: "01875-555123", reports: 3, age: "২ সপ্তাহ", fanout: "২১ অজানা নম্বরে কল", verdict: "watch", script: "প্রাইজ জয় — লটারি ফি", source: "demo data" },
    "16247": { number: "16247", reports: 0, age: "অফিশিয়াল হেল্পলাইন", fanout: "—", verdict: "official", script: "অফিশিয়াল হেল্পলাইন", source: "demo data" }
  };

  const THRESHOLD = 50;
  const NORMALIZE = 1.7;

  function norm(text) {
    return String(text == null ? "" : text)
      .replace(/[০-৯]/g, d => String("০১২৩৪৫৬৭৮৯".indexOf(d)))
      .replace(/[।,!?;:…\n\r]/g, " ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasAny(n, list) {
    for (let i = 0; i < list.length; i++) if (n.indexOf(list[i]) !== -1) return true;
    return false;
  }

  function scanSignals(text) {
    const n = norm(text);
    const hits = [];
    Object.keys(SIGNALS).forEach(key => {
      const s = SIGNALS[key];
      const found = [];
      s.terms.forEach(term => { const t = norm(term); if (t && n.indexOf(t) !== -1) found.push(t); });
      if (found.length) hits.push({ key, label: s.label, weight: s.weight, terms: found.filter((v, i, a) => a.indexOf(v) === i).slice(0, 4) });
    });
    return hits.sort((a, b) => b.weight - a.weight);
  }

  function detectTriggers(text) {
    const n = norm(text);
    return TRIGGERS.filter(t => t.terms.some(term => n.indexOf(norm(term)) !== -1));
  }

  /* Ordered by specificity: the most constrained pattern must win, so "bKash
     office, your account is suspended, give the OTP" is never read as a generic
     money request even though it mentions bKash. */
  const RULES = [
    { key: "forward", test: k => k.credential && k.forwarding },
    { key: "remote", test: k => k.install && (k.credential || k.payment) },
    { key: "account", test: k => k.authority && k.otpAsk && k.suspend },
    { key: "refund", test: k => k.refund && k.otpAsk },
    { key: "police", test: k => k.authority && (k.leverage || k.payment || k.urgency || k.secrecy) },
    { key: "emergency", test: k => k.leverage && (k.payment || k.urgency) },
    { key: "otp", test: k => k.otpAsk && (k.reward || k.suspend) },
    { key: "prize", test: k => k.reward && (k.payment || k.install || k.urgency) }
  ];

  function classify(hits, n) {
    const present = {};
    hits.forEach(h => { present[h.key] = true; });
    present.otpAsk = hasAny(n, PHRASES.otpAsk);
    present.suspend = hasAny(n, PHRASES.suspend);
    present.forwarding = hasAny(n, PHRASES.forwarding);
    present.refund = hasAny(n, PHRASES.refund);
    const rule = RULES.find(r => r.test(present));
    if (!rule) return null;
    return { key: rule.key, label: (SCAM_TYPES.find(t => t.key === rule.key) || {}).label };
  }

  /* The situation raises or lowers risk: the same words from a saved contact at
     noon are not danger; from a fresh unknown number mid-call they are. */
  function score(situation) {
    const s = situation || {};
    const n = norm(s.text);
    const hits = scanSignals(s.text);
    const unknownCaller = s.unknownCaller !== false;
    const callActive = !!s.callActive;
    const newReceiver = !!s.newReceiver;
    const unusualAmount = !!s.unusualAmount;
    const lateNight = !!s.lateNight;
    const optInConsent = s.optInConsent !== false;

    let raw = hits.reduce((sum, h) => sum + h.weight, 0);
    if (unknownCaller) raw += 12;
    if (callActive) raw += 10;
    if (newReceiver) raw += 8;
    if (unusualAmount) raw += 8;
    if (lateNight) raw += 4;

    const keys = hits.map(h => h.key);
    const scare = keys.indexOf("authority") !== -1 || keys.indexOf("leverage") !== -1;
    const rush = keys.indexOf("urgency") !== -1;
    const isolate = keys.indexOf("secrecy") !== -1;
    if (scare && (rush || isolate)) raw += 15;
    if (isolate) raw += 6;

    const triggers = detectTriggers(s.text);
    const asksSomething = keys.indexOf("payment") !== -1 || keys.indexOf("credential") !== -1 || keys.indexOf("install") !== -1 || triggers.length > 0;

    const risk = Math.max(0, Math.min(100, Math.round(raw / NORMALIZE)));
    return {
      risk, hits, triggers,
      scam: classify(hits, n),
      fear: { scare, rush, isolate },
      asksSomething: asksSomething,
      wouldPause: optInConsent && risk >= THRESHOLD && asksSomething,
      threshold: THRESHOLD,
      engine: "local"
    };
  }

  function reputation(number) {
    const digits = String(number == null ? "" : number).replace(/\D/g, "");
    const key = digits.length >= 11 ? digits.slice(-10) : digits;
    if (DEMO_NUMBERS[key]) {
      const d = DEMO_NUMBERS[key];
      return { number: d.number, reports: d.reports, age: d.age, fanout: d.fanout, verdict: d.verdict, script: d.script, source: d.source, known: true };
    }
    let hash = 0;
    for (let i = 0; i < digits.length; i++) hash = (hash * 31 + digits.charCodeAt(i)) >>> 0;
    const reports = hash % 7 === 0 ? (hash % 40) + 3 : 0;
    return {
      number: String(number == null ? "" : number), reports,
      age: reports ? "৩ দিনের নতুন সিম" : "পরিচিত নয়",
      fanout: reports ? (hash % 200) + 30 + " অজানা নম্বরে কল" : "—",
      verdict: reports >= 3 ? "suspicious" : "unknown", script: "", source: "demo data", known: false
    };
  }

  /* Fallback complaint writer: a factual skeleton from what the victim said.
     It invents nothing. Production uses a generative model for the prose. */
  function draftComplaint(incident) {
    const i = incident || {};
    const res = score({ text: i.text || "", unknownCaller: true, callActive: true });
    const lines = [];
    lines.push("বিষয়: " + (res.scam ? res.scam.label : "ফোন প্রতারণার চেষ্টা") + " সম্পর্কে জরুরি অভিযোগ।");
    if (i.number) lines.push("সন্দেহভাজন নম্বর: " + i.number);
    if (i.time) lines.push("সময়: " + i.time);
    if (i.amount) lines.push("চাওয়া হয়েছে: " + i.amount);
    lines.push("ঘটনা: " + String(i.text || "").trim());
    lines.push("পদ্ধতি: ভয় দেখানো হয়েছে, তাড়াতাড়ি করা হয়েছে এবং কাউকে জানানো থেকে বিরত রাখা হয়েছে।");
    lines.push("অনুরোধ: নম্বরটি ট্র্যাক করে সংশ্লিষ্ট নেটওয়ার্ক শনাক্ত ও ব্যবস্থা গ্রহণের অনুরোধ রইল।");
    return {
      to: ["Grameenphone ফ্রড সেল", "MFS প্রোভাইডার", "পুলিশ / ৯৯৯"],
      subject: res.scam ? res.scam.label : "Phone fraud attempt",
      body: lines.join("\n"),
      signals: res.hits.map(h => h.label),
      engine: "local"
    };
  }

  global.ShotorkoEngine = {
    score, classify, draftComplaint, reputation, scanSignals, detectTriggers, norm,
    SIGNALS, SCAM_TYPES, TRIGGERS, PHRASES, DEMO_NUMBERS, THRESHOLD, NORMALIZE
  };
})(typeof window !== "undefined" ? window : globalThis);
