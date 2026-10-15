/* Engine check: run the real classifier against the pitch scenarios and assert
   the pause fires when it should and stays quiet when it should not.
   Usage: node dev/engine-check.js */

require("../web/assets/engine.js");
require("../web/assets/data.js");

const E = globalThis.ShotorkoEngine;
const D = globalThis.ShotorkoData;

let fails = 0;
function check(name, actual, expected) {
  const ok = expected === undefined ? !!actual : actual === expected;
  if (!ok) fails++;
  console.log((ok ? "  PASS  " : "  FAIL  ") + name + "  →  " + JSON.stringify(actual));
}

console.log("\n1. The Scene 1 / Scene 5 scam call must trigger the pause");
const convo = D.CALL_SCRIPT.map(t => t.bangla).join(" ");
const r1 = E.score({ text: convo, unknownCaller: true, callActive: true, newReceiver: true, unusualAmount: true });
check("risk above threshold", r1.risk >= r1.threshold, true);
check("would pause", r1.wouldPause, true);
check("classified as a police scam", r1.scam && r1.scam.key, "police");
check("sees scare", r1.fear.scare, true);
check("sees rush", r1.fear.rush, true);
check("sees isolate", r1.fear.isolate, true);

console.log("\n2. A normal family call must stay quiet");
const r2 = E.score({ text: "মা, আমি হলে ঠিক আছি, রাতে খিচুড়ি খেয়েছি, তুই ভালো আছ তো?", unknownCaller: false, callActive: true });
check("would not pause", r2.wouldPause, false);
check("low risk", r2.risk < 30, true);

console.log("\n3. Same intent, reworded — the point of using meaning, not a word list");
D.ALT_SCRIPT.forEach((a, i) => {
  const r = E.score({ text: a.bangla, unknownCaller: true, callActive: true, newReceiver: true });
  check(`ALT ${i + 1} classified as ${a.expect}`, r.scam && r.scam.key, a.expect);
  check(`ALT ${i + 1} pauses`, r.wouldPause, true);
});

console.log("\n4. Consent is respected");
const r4 = E.score({ text: convo, unknownCaller: true, callActive: true, optInConsent: false });
check("opt-out means no pause", r4.wouldPause, false);

console.log("\n5. Number reputation lookup");
check("demo number resolves", E.reputation("01711-234567").reports, 41);
check("official helpline is clean", E.reputation("16247").verdict, "official");
check("unknown number is unknown", E.reputation("01301-111222").known, false);

console.log("\n6. Complaint writer keeps the facts and invents nothing");
const c = E.draftComplaint({ text: "আমাকে ৩০ হাজার টাকা পাঠাতে বলা হয়েছে", number: "01711-234567", time: "রাত ৯:৪১", amount: "৩০,০০০ টাকা" });
check("three recipients", c.to.length, 3);
check("keeps the number", c.body.indexOf("01711-234567") !== -1, true);
check("keeps the amount", c.body.indexOf("৩০,০০০") !== -1, true);

console.log("\n7. Money-transfer trigger detection");
check("detects bKash send", E.detectTriggers("এখনই বিকাশ করুন").length >= 1, true);
check("detects OTP", E.detectTriggers("ওটিপিটা বলুন").some(t => t.key === "share_otp"), true);
check("detects forwarding code", E.detectTriggers("*21 ডায়াল করুন").some(t => t.key === "forward_code"), true);

console.log("\n8. Radar demo data is self-consistent");
D.NETWORKS.forEach(n => {
  const rows = D.REPORTS.filter(r => n.linked.indexOf(r.number) !== -1);
  check(`${n.id} has reports to show`, rows.length > 0, true);
});

console.log("\n9. Benign calls must NOT pause (the false-alarm question)");
const BENIGN = [
  "বাবা, আমার এই মাসের ৫০০০ টাকা দরকার, কাল পাঠাইও",
  "স্যার, আপনার রিপোর্টটা কাল অফিসে দিতে হবে",
  "মা, আমি হোস্টেলের খাবার খেয়েছি, তুই চিন্তা করিস না",
  "আমাদের বিয়ের কার্ডে নাম লিখতে হবে, কার্ডটা নিয়ে আসেন",
  "আপনার একাউন্ট আপডেট করতে অফিসে আসুন, ওটিপি দিয়ে কিছু করা হয় না",
  "নদীতে ঘুরতে যাবি? আব্বুকে তোকে জিজ্ঞেস করেছি",
  "কাউকে বলো না কিন্তু, আসলে আমরা সারপ্রাইজ পার্টি করছি",
  "৩০০০ টাকা ইলেকট্রিক বিল, আপনার বিল কত এসেছে?",
  "১০০০ টাকা মাইক্রোবাস ভাড়া লাগবে, তুই কি আছিস?",
  "স্কুলের ফি জমা দিতে হবে, ২০০০ টাকা"
];
let falseAlarms = 0;
BENIGN.forEach(t => {
  const r = E.score({ text: t, unknownCaller: true, callActive: true });
  if (r.wouldPause) { falseAlarms++; console.log("        ↳ would pause: " + t); }
});
check("benign corpus pauses", falseAlarms, 0);

console.log("\n10. The same benign words turn dangerous when rushed and secretive");
const r10 = E.score({ text: "আমার ৫০০০ টাকা এখনই পাঠাও, কাউকে বলবেন না", unknownCaller: true, callActive: true, newReceiver: true });
check("escalates to a pause", r10.wouldPause, true);

console.log("\n" + (fails === 0 ? "ALL CHECKS PASSED" : fails + " CHECK(S) FAILED"));
process.exit(fails === 0 ? 0 : 1);
