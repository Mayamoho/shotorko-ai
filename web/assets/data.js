/* Demo dataset. Everything here is simulated for the prototype — no real person,
   number or complaint. Production sources would be operator signalling data,
   the MFS agent app and user reports. */
(function (global) {
  "use strict";

  const CALL_SCRIPT = [
    { speaker: "scammer", bangla: "হ্যালো, আমি থানার ওসি বলছি।", en: "Hello, I am the officer-in-charge of the police station.", signals: ["authority"] },
    { speaker: "scammer", bangla: "আপনার ছেলেকে ইয়াবাসহ ধরা হয়েছে।", en: "Your son has been arrested with yaba.", signals: ["leverage"] },
    { speaker: "ammu", bangla: "না না… আমি এখনই পাঠাচ্ছি…", en: "No no… I am sending it right now…", signals: [] },
    { speaker: "scammer", bangla: "মামলা না চাইলে এখনই ৩০ হাজার টাকা বিকাশ করেন।", en: "If you don't want a case filed, send 30,000 taka by bKash right now.", signals: ["urgency", "payment"] },
    { speaker: "scammer", bangla: "কাউকে বলবেন না।", en: "Do not tell anyone.", signals: ["secrecy"] },
    { speaker: "scammer", bangla: "আমার কথা কাউকে জানালে আপনার ছেলেকে জেলে দিব।", en: "If you tell anyone, your son goes to jail.", signals: ["secrecy", "authority"] }
  ];

  /* Same intent, different words. A word list cannot follow this; meaning can. */
  const ALT_SCRIPT = [
    { bangla: "আমি বিকাশ অফিস থেকে বলছি, আপনার একাউন্ট সাসপেন্ড হয়ে যাবে। OTP বলুন।", en: "This is bKash office, your account will be suspended. Tell me the OTP.", expect: "account" },
    { bangla: "ওটিপিটা দিলেই টাকা ফেরত পাবেন, কারওকে বলবেন না।", en: "Give the OTP and you get the money back, don't tell anyone.", expect: "refund" },
    { bangla: "আপনি লটারিতে জিতেছেন, শুধু ৫০০ টাকা একাউন্ট ফি লাগবে এখনই।", en: "You won the lottery, only a 500 taka fee, right now.", expect: "prize" },
    { bangla: "Taka ta ekhoni bikash kore dio, kauke bolba na, police case reflect kore dibo.", en: "Send the money by bKash now, don't tell anyone, I'll drop the police case.", expect: "police" },
    { bangla: "আপনার ছেলের অ্যাক্সিডেন্ট হয়েছে, হাসপাতালে এখনই টাকা লাগবে।", en: "Your son met with an accident, the hospital needs money right now.", expect: "emergency" }
  ];

  const FAMILY = {
    ammu: { name: "আম্মু", relation: "মা", device: "সিমেইন্স বটন ফোন", note: "দীর্ঘ লেখা পড়তে পারেন না, কথা বলে বোঝেন" },
    son: { name: "রাকিব", relation: "ছেলে", device: "অ্যান্ড্রয়েড", note: "বিশ্ববিদ্যালয় হলে, ঢাকা" },
    daughter: { name: "নাদিয়া", relation: "মেয়ে", device: "অ্যান্ড্রয়েড", note: "চাকরি, ঢাকা" },
    secretWord: "শেখেরচালা",
    setupMinutes: 2
  };

  const REPORTS = [
    { id: "R-2291", district: "ঢাকা", date: "১২ অক্টোবর", type: "police", number: "01711-234567", amount: 30000, stopped: true, words: "থানার ওসি, ইয়াবা, ৩০ হাজার" },
    { id: "R-2294", district: "গাজীপুর", date: "১২ অক্টোবর", type: "police", number: "01711-234567", amount: 15000, stopped: false, words: "থানার ওসি, ছেলেকে ধরা" },
    { id: "R-2301", district: "নারায়ণগঞ্জ", date: "১৩ অক্টোবর", type: "police", number: "01711-234567", amount: 50000, stopped: false, words: "ওসি সাহেব, মামলা, বিকাশ" },
    { id: "R-2312", district: "রাজবাড়ী", date: "১৩ অক্টোবর", type: "emergency", number: "01919-876543", amount: 50000, stopped: false, words: "ছেলে গ্রেপ্তার, ডিবি" },
    { id: "R-2318", district: "কুষ্টিয়া", date: "১৪ অক্টোবর", type: "police", number: "01711-234567", amount: 8000, stopped: true, words: "ওসি, জিডি, তাড়াতাড়ি" },
    { id: "R-2320", district: "চট্টগ্রাম", date: "১৪ অক্টোবর", type: "account", number: "01919-876543", amount: 12000, stopped: true, words: "বিকাশ অফিস, সাসপেন্ড, ওটিপি" },
    { id: "R-2325", district: "চট্টগ্রাম", date: "১৪ অক্টোবর", type: "account", number: "01919-876543", amount: 0, stopped: true, words: "অ্যাকাউন্ট ব্লক, আইভিআরএফ" },
    { id: "R-2331", district: "সিলেট", date: "১৫ অক্টোবর", type: "otp", number: "01875-555123", amount: 0, stopped: true, words: "হোয়াটসঅ্যাপ ভেরিফিকেশন কোড" },
    { id: "R-2336", district: "খুলনা", date: "১৫ অক্টোবর", type: "refund", number: "01875-555123", amount: 4000, stopped: false, words: "ভুল করে টাকা পাঠাইছি, রিফান্ড" },
    { id: "R-2340", district: "বরিশাল", date: "১৫ অক্টোবর", type: "prize", number: "01600-111222", amount: 500, stopped: true, words: "লটারি জিতেছেন, একাউন্ট ফি" },
    { id: "R-2344", district: "রাজশাহী", date: "১৬ অক্টোবর", type: "emergency", number: "01919-876543", amount: 25000, stopped: true, words: "ছেলের অ্যাক্সিডেন্ট, হাসপাতাল" },
    { id: "R-2349", district: "ঢাকা", date: "১৬ অক্টোবর", type: "forward", number: "01711-234567", amount: 0, stopped: true, words: "*21 কোড ডায়াল করতে বলা" },
    { id: "R-2352", district: "ময়মনসিংহ", date: "১৬ অক্টোবর", type: "remote", number: "01500-333444", amount: 60000, stopped: false, words: "অ্যাপ ডাউনলোড, স্ক্রিন শেয়ার" },
    { id: "R-2357", district: "রংপুর", date: "১৬ অক্টোবর", type: "police", number: "01711-234567", amount: 0, stopped: true, words: "সিআইডি, মামলা, কাউকে বলবেন না" },
    { id: "R-2361", district: "চাঁদপুর", date: "১৬ অক্টোবর", type: "prize", number: "01600-111222", amount: 1200, stopped: false, words: "বোনাস, ফি, এখনই" },
    { id: "R-2366", district: "পাবনা", date: "১৬ অক্টোবর", type: "account", number: "01919-876543", amount: 0, stopped: true, words: "নগদ অফিস, ওটিপি, বন্ধ হয়ে যাবে" }
  ];

  const NETWORKS = [
    {
      id: "NET-A", name: "“ওসি সাহেব” নেটওয়ার্ক", script: "থানার ওসি + ইয়াবা/মামলা + তাৎক্ষণিক বিকাশ",
      number: "01711-234567", linked: ["01711-234567", "01744-909010", "01766-202030"],
      reports: 41, districts: 6, amount: 103000, blocked: false
    },
    {
      id: "NET-B", name: "“বিকাশ অফিস” নেটওয়ার্ক", script: "অ্যাকাউন্ট সাসপেন্ড + ওটিপি/আইভিআরএফ",
      number: "01919-876543", linked: ["01919-876543", "01933-454566"],
      reports: 17, districts: 4, amount: 87000, blocked: false
    },
    {
      id: "NET-C", name: "“রিফান্ড ও ইনাম” নেটওয়ার্ক", script: "ভুল পাঠানো বা লটারি + ছোট ফি",
      number: "01875-555123", linked: ["01875-555123", "01600-111222", "01500-333444"],
      reports: 9, districts: 5, amount: 64500, blocked: true
    }
  ];

  const AGENT_SHOPS = [
    { shop: "রহিম মোবাইল স্টোর", area: "মিরপুর ১০, ঢাকা", cashIn: 4, cashOut: 19 },
    { shop: "করিম কমিউনিকেশন", area: "সাতক্ষীরা সদর", cashIn: 1, cashOut: 7 }
  ];

  const STATS = {
    protectedUsers: 10000, attempts: 1284, stopped: 796, stopRate: 62,
    falseAlarms: 31, pauses: 412, familyAlerts: 168, agentWarnings: 97, avgPauseSeconds: 41
  };

  const TYPE_LABELS = {
    police: "ভুয়া পুলিশ", account: "অ্যাকাউন্ট ব্লক", otp: "ওটিপি চুরি", emergency: "আপনজনের বিপদ",
    refund: "রিফান্ড প্রতারণা", prize: "ইনাম/লটারি", forward: "কল ফরোয়ার্ডিং", remote: "ফেক অ্যাপ", unknown: "অন্য"
  };

  global.ShotorkoData = { CALL_SCRIPT, ALT_SCRIPT, FAMILY, REPORTS, NETWORKS, AGENT_SHOPS, STATS, TYPE_LABELS };
})(typeof window !== "undefined" ? window : globalThis);
