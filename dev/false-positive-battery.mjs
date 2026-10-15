/* Turns the deck's false-alarm claim into a measured number.
 *
 *   node dev/false-positive-battery.mjs local     # on-device engine, no quota, exact
 *   node dev/false-positive-battery.mjs [url]     # hosted classifier, live calls
 *
 * Ten ordinary Bangla and Banglish sentences — family, fees, delivery, a doctor's
 * bill, borrowing from a brother — run twice: once with friendly context, once with
 * every hostile situation flag on. Then five real scam scripts as controls, because
 * a classifier that never pauses is not better than one that always does.
 *
 * Local mode runs the same offline engine the page runs, in this process: no key, no
 * network, re-runnable anywhere. Hosted mode depends on Google's daily free quota. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runInThisContext } from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2] || "https://abukawser.xyz";
const LOCAL = arg === "local";
const endpoint = LOCAL ? "" : `${arg.replace(/\/$/, "")}/functions/v1/app/analyze`;
const GAP_MS = Number(process.env.GAP_MS ?? 7000);
const sleep = (ms) => new Promise(ok => setTimeout(ok, ms));

/* the page's offline engine, loaded the way a browser script tag loads it */
runInThisContext(readFileSync(resolve(here, "../web/assets/engine.js"), "utf8"), { filename: "web/assets/engine.js" });
const E = globalThis.ShotorkoEngine;

const CALM = { unknownCaller: false, callActive: false, newReceiver: false, unusualAmount: false, lateNight: false };
const HOSTILE = { unknownCaller: true, callActive: true, newReceiver: true, unusualAmount: true, lateNight: true };

const BENIGN = [
  ["family", "আম্মু, আমি বাসায় পৌঁছে গেছি। তুমি কি খেয়েছ? খাওনি হলে নিয়ে আসব।"],
  ["school fee", "স্যার, কালকের ক্লাসের ফি পাঁচশো টাকা, আপনি অফিসে থাকলে নিয়ে আসব।"],
  ["brother", "ভাই, দোকানের বাকি দুই হাজার বিকাশে পাঠাও, পরশু ফেরত দিয়ে দেব।"],
  ["delivery", "আপনার অর্ডার করা জিনিস নিচে পৌঁছে গেছে, দয়া করে নিতে আসেন।"],
  ["recharge", "গ্রামীণফোন থেকে আপনার ৫০০ টাকার রিচার্জ সফল হয়েছে, ধন্যবাদ।"],
  ["doctor", "ডাক্তার said, ঔষধের বিল এক হাজার দুইশো, কাল নিতে আসিস।"],
  ["wedding", "শুভ সংবাদ! তোমার ভাইয়ের বিয়ে, সাড়ে তিন হাজার টাকা লাগবে, পাঠাও।"],
  ["neighbour", "নেন, আপনার ছেলের চান্দায় পাঁচশো দিয়ে এসেছি, পরে নিয়ে নিলেই হবে।"],
  ["banglish", "Bhai, rickshawk 200 taka dey de, ami ghomr por phiriye nibo. Are kichu na."],
  ["secrecy, benign", "আম্মু, তুমি abbu ke bolba na, amar phone e 3000 taka lagbe, bujer kosto lagbe."],
];

const SCAMS = [
  ["police money", "থানার ওসি বলছে, তোমাকে ধরা হয়েছে, মামলা না চাইলে এখনই ত্রিশ হাজার টাকা বিকাশ করো, কাউকে বলবে না।"],
  ["otp theft", "আমি আপনার ব্যাংকের অ্যাকাউন্টে ঢুকে পড়েছি। যে ওটিপিটা এসেছে সেটা বলুন, না বললে দশ লাখ টাকা সরিয়ে নেব।"],
  ["prize fee", "অভিনন্দন! আপনি পঞ্চাশ লাখ টাকা জিতেছেন। শুধু দুই হাজার টাকা ভেরিফিকেশন ফি বিকাশ করলেই কাল টাকা পাবেন।"],
  ["screen share", "আমাদের অ্যাপটা এখনই ইনস্টল করুন, তারপর স্ক্রিন শেয়ার করে আপনার ব্যাংক অ্যাপটা খুলুন।"],
  ["call forward", "*21* এর পরে এই নম্বরটা ডায়াল করুন, আপনার সব কল সরাসরি আমাদের কাছে চলে আসবে।"],
];

async function run(text, situation) {
  if (LOCAL) {
    const r = E.score({ text, ...situation });
    return { risk: r.risk, pause: r.wouldPause, keys: r.hits.map(h => h.key), engine: "local" };
  }
  const body = JSON.stringify({ text, situation });
  // Google's free tier throttles by minute, so the battery paces itself and
  // waits out a 429 instead of counting a throttled call as "quiet".
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(attempt * 30_000);
    else await sleep(GAP_MS);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    if (!res.ok) { last = `HTTP ${res.status} ${(await res.text()).slice(0, 80)}`; continue; }
    const j = await res.json();
    return { risk: j.risk, pause: j.wouldPause, keys: (j.signals || []).map(s => s.key), engine: j.engine };
  }
  throw new Error(last || "no answer");
}

async function sweep(label, rows, situation) {
  console.log(`\n── ${label}`);
  let paused = 0, failed = 0;
  for (const [name, text] of rows) {
    let r;
    try {
      r = await run(text, situation);
    } catch (err) {
      failed++;
      console.log(`  ??  ${name.padEnd(15)} ${err.message}`);
      continue;
    }
    if (r.pause) paused++;
    console.log(`  ${r.pause ? "🔴 pause" : "·  quiet"}  ${name.padEnd(15)} risk ${String(r.risk).padStart(3)}  ${r.keys.join(",")}`);
  }
  console.log(`   → ${paused} paused of ${rows.length} (${failed} request errors)`);
  return paused;
}

console.log(LOCAL
  ? "Target: the on-device engine, loaded from web/assets/engine.js — no network, no key"
  : `Target ${endpoint} — hosted classifier, live calls`);

const calmPause = await sweep("benign sentences, friendly context", BENIGN, CALM);
const hostilePause = await sweep("the same sentences, every hostile flag on", BENIGN, HOSTILE);
const scamPause = await sweep("scam controls", SCAMS, HOSTILE);

console.log(`\n═══ measured: benign paused ${calmPause}/10 calm · ${hostilePause}/10 hostile · scams paused ${scamPause}/5`);
process.exit(calmPause === 0 && scamPause >= 4 ? 0 : 1);
