// Server-side copy of the classifier's vocabulary table. The browser bundle and
// the edge package are separate artifacts, so this mirrors web/assets/engine.js.
// The agent returns signal keys only; labels are owned here so no model output
// can reach the page as display text.

export const SIGNALS: Record<string, { label: string; weight: number }> = {
  authority: { label: "ভুয়া ক্ষমতা · fake authority", weight: 22 },
  leverage: { label: "আপনজনের বিপদ · loved one in trouble", weight: 24 },
  urgency: { label: "তাড়াতাড়ি করা হচ্ছে · being rushed", weight: 20 },
  secrecy: { label: "কাউকে বলতে নিষেধ · told to stay silent", weight: 26 },
  credential: { label: "গোপন কোড চাওয়া · secret code asked", weight: 28 },
  payment: { label: "টাকা পাঠাতে বলা · money asked for", weight: 30 },
  reward: { label: "লোভ দেখানো · tempting reward", weight: 18 },
  install: { label: "অ্যাপ বা স্ক্রিন শেয়ার · app or screen share", weight: 24 },
};

export const SCAM_TYPES: Record<string, string> = {
  police: "ভুয়া পুলিশ / মামলা",
  account: "অ্যাকাউন্ট ব্লক / ভুয়া MFS অফিসার",
  otp: "ওটিপি / অ্যাকাউন্ট হ্যাক",
  emergency: "আপনজনের জরুরি বিপদ",
  refund: "ভুল পাঠানো / রিফান্ড",
  prize: "ইনাম / চাকরি / ঋণ",
  forward: "কল ফরোয়ার্ডিং দখল",
  remote: "ফেক অ্যাপ / স্ক্রিন শেয়ার",
};

export const TRIGGERS: Record<string, string> = {
  send_money: "টাকা পাঠানো",
  share_otp: "ওটিপি শেয়ার",
  forward_code: "কল ফরোয়ার্ডিং কোড",
  install_app: "অজানা অ্যাপ ইনস্টল",
};

export const THRESHOLD = 50;

export const COMPLAINT_TO = ["Grameenphone ফ্রড সেল", "MFS প্রোভাইডার", "পুলিশ / ৯৯৯"];
