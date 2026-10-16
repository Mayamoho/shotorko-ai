# Shotorko (সতর্ক)

**AI that stops a phone scam at the moment of fear — not after the money is gone.**

An interactive, working prototype of a Bangla-first voice safety service. It listens on the call,
recognises the structure of a scam, and interrupts the user with one sentence before they can act.
Grameenphone is the launch partner, but nothing in the classifier is operator-specific.

This is a concept-pitch prototype built for the **GP FutureMakers 2026 Concept Pitch Round**.

---

## Live prototype

| Address | What is verified about it |
| --- | --- |
| **<https://abukawser.xyz>** | The primary deployment. Frontend and live backend both answering — `GET /functions/v1/app/health` returns `{"ok":true,"engine":"gemini","model":"gemini-2.5-flash"}`. |
| <https://shotorko-ai.vercel.app> | The same deployment on its default domain. Use it if a network cannot resolve `abukawser.xyz`. |
| <https://shotorko-demo-8604o4z09al.qoder.website> | The same prototype on Qoder Sites. It serves the page and the on-device engine; the backend there is not provisioned, so this build runs **on-device only**. |

No login, no install, no app store. It is a web page that behaves like the product, and it is usable
from a phone in the room.

**Try these three things:**

1. Press **▶ Play the story** — it runs the whole intervention end to end in under a minute.
2. Open **নিজে যাচাই** (last tab) and paste any scam line you were ever sent, in Bangla or Banglish.
3. Flip the engine pill between **On-device** and **Live agent** and watch the same sentence get
   judged twice, by a rule engine and by a model.

Every screen is deep-linkable: `https://abukawser.xyz/#thamun` opens the pause directly.

---

## The product rule

A scam has two halves, and the prototype keeps them separate on purpose.

- **Why it is dangerous** — the pressure applied to the listener: fake authority, a loved one in
  trouble, manufactured urgency, a demand for silence, a code ask, a money ask, a lure, a remote
  install.
- **What it wants** — the action that actually causes the loss: send money, share an OTP, dial a
  forwarding code, install an app.

Any single pressure is normal conversation. A mother asking for money is not a scam. The
interruption fires **only when both halves are true at once**:

```
pause = consent AND risk >= 50 AND the caller asked for an action
```

That is the design principle the whole prototype is built on: **stop the action, not the call.**
Shotorko does not block numbers and does not record conversations. It buys the user the one thing
that works — a few seconds and a second opinion.

---

## How the prototype works

### 1. On-device engine — `web/assets/engine.js`

This is the classifier that ships first in the proposal, because a cheap phone in a village has no
reliable network mid-call and no budget for a cloud round-trip. It is pure JavaScript, runs entirely
in the page, and needs no permission beyond opt-in consent.

**Eight weighted intent signals.** Each carries a Bangla and a Banglish term list, matched on
phrase stems rather than a fixed blocklist, so rewording a script keeps the signals.

| Signal | Weight | What it catches |
| --- | ---: | --- |
| `payment` | 30 | টাকা পাঠান, bikash, nagad, cash in |
| `credential` | 28 | ওটিপি, পিন, security code, IVRF, `*21` |
| `secrecy` | 26 | কাউকে বলবেন না, গোপন রাখ |
| `leverage` | 24 | ছেলে/মেয়ে/বাবা, হাসপাতাল, অ্যাক্সিডেন্ট, জেলে |
| `install` | 24 | অ্যাপ ডাউনলোড, স্ক্রিন শেয়ার, AnyDesk, APK |
| `authority` | 22 | থানার ওসি, পুলিশ, সিআইডি, মামলা, গ্রেপ্তার |
| `urgency` | 20 | এখনই, আজকের মধ্যে, তাড়াহুড়ো |
| `reward` | 18 | ইনাম, জ্যাকপট, ফ্রি, চাকরি দেব |

**Situation raises or lowers the score.** The same words from a saved contact at noon are not
danger; from a fresh unknown number mid-call they are. Text alone never decides.

```
unknownCaller +12   callActive +10   newReceiver +8   unusualAmount +8   lateNight +4
scare AND (rush OR isolate) +15      isolate alone +6
risk = round(raw / 1.7), clamped to 0..100
```

A worked example, run against the actual engine:

> `"থানার ওসি বলছি, আপনার ছেলেকে ধরা হয়েছে, এখনই বিকাশে টাকা পাঠান, কাউকে বলবেন না"`
> → signals `authority + leverage + urgency + secrecy + payment`, risk **97**, scam type
> **ভুয়া পুলিশ / মামলা**, **paused**.

And the sentence that proves why one signal is not a warning:

> `"আসসালামু আলাইকুম, আজকে বাসায় আসার সময় একটা লেবু আর দুধ নিয়ে আসবা, বাবাকে বলে দিও"`
> → matches `leverage` on বাবা, risk **14**, **not paused**. A benign word still counts; it just
> cannot reach the gate on its own.

**Scam type is chosen by rules ordered by specificity**, so the most constrained pattern always
wins: `forward → remote → account → refund → police → emergency → otp → prize`. "bKash office, your
account is suspended, give the OTP" is read as an account takeover, never as a generic money ask,
even though it mentions bKash.

`reputation()` and `draftComplaint()` complete the local path: number lookups return a deterministic
result that is stable across reloads, and the complaint writer builds a factual skeleton from what
the victim actually said. **It invents nothing.**

### 2. Live agent path — `api/app/[...path].ts`

When the engine pill is switched to **Live agent**, the browser calls
`POST /functions/v1/app/analyze`. The frontend checks `GET /functions/v1/app/health` first and only
shows the switch if the backend actually answers — a page never offers a mode it cannot serve.

The model does the hard part the rules cannot: it reads meaning across dialects and rewordings, and
it turns a spoken, upset, unclear account into a complaint letter in standard Bangla that can be
filed as-is.

Three safety properties are held on purpose, and they are the reason the hosted path is not simply
"the model decides":

- **The model returns keys and numbers only.** Every label the page displays comes from a table the
  server owns (`SIGNALS`, `SCAM_TYPES`). Model output never reaches the page as display text, so a
  prompt-injected or hallucinated string cannot become product copy.
- **The model proposes; the server disposes.** `shapeAnalyze()` re-applies the gate itself:
  `wouldPause = model.wouldPause && risk >= 50 && asksSomething`. A model that says "pause" for a
  calm sentence is overridden.
- **Nothing upstream leaks out.** Errors are mapped to a fixed set of machine codes
  (`provider_rate_limited`, `agent_timeout`, `service_not_configured`); raw provider text never
  surfaces to a visitor, and the API key never leaves the server.

Abuse guards on a public page: a SHA-256 request fingerprint feeds a 15-minute cache, a per-minute
slot budget stops a visitor draining the key, and inputs are stripped of control characters and
capped (transcript 1200 chars, story 2000, letter 4000).

### 3. The Qoder Sites Function — `functions/`

`functions/handler.ts` is the same contract, served through Qoder Sites instead of Vercel, running a
fixed agent on Qoder Cloud Agents (`https://api.qoder.com`). The agent is bootstrapped once and
reused across restarts by matching on metadata, so a cold start does not pile up new agents and
environments. `functions/cloud-agents.mjs` holds the client; `functions/signals.ts` mirrors the
server-owned label table. One frontend runs unchanged against either host.

### 4. The page itself — `web/assets/app.js`

Nine modules, in the order a real call goes wrong:

| # | Tab | Screen |
| --- | --- | --- |
| 0 | হোম | Quiet when nothing is wrong |
| 1 | কলের আগে | Network-level Bangla warning before the call — on any phone, no app |
| 2 | কলের ভেতরে | On-device listening during the call, nothing recorded |
| 3 | থামুন | The pause — the heart of Shotorko |
| 4 | আপনজন | Family alert and one-tap call back |
| 5 | এজেন্ট সতর্কতা | The cash-in agent shop becomes a checkpoint |
| 6 | রিপোর্ট | Bangla speech into a filing-ready complaint |
| 7 | স্ক্যাম রাডার | The same script, one network, many victims |
| 8 | নিজে যাচাই | Paste any scam text yourself — Bangla or Banglish |

Three device mocks carry those screens: a smartphone, an **old button phone** (which proves the
pre-call network warning needs no smartphone at all), and a family member's phone. The presenter rail
labels each screen with the production component that would really serve it.

---

## What is real, and what is demo data

Stated plainly, because a prototype that hides this is worth nothing.

**Real, and running in the page right now:**

- the on-device classifier — signals, scoring, thresholds, ask-gate, type rules
- the pause decision itself, on both the local and the hosted path
- the hosted classifier and the generative complaint writer
- the server-side label ownership, the re-gating, and the rate limits

**Demo data, labelled as such in the interface:**

- caller reputation — reports, SIM age, fan-out (`source: "demo data"` on every record)
- the live call audio and the transcription timeline
- USSD and app-install triggers
- the agent-shop feed and the Scam Radar records

The production shape — a fine-tuned Bangla model small enough to run on a cheap phone, network-level
signalling before the call, and operator-side pattern aggregation — is proposed, not built here.

---

## Layout

```
web/                     the prototype (static, no framework, no build step)
  index.html             shell, tabs, the Play-the-story run
  assets/engine.js       the on-device classifier
  assets/app.js          the nine screens and their interactions
  assets/data.js         demo fixtures — the call script, family, reports, radar, agent shops
  assets/app.css         styling
api/app/[...path].ts     Vercel Edge Function — Gemini backend (what abukawser.xyz serves)
functions/               the same contract as a Qoder Sites Function (Cloud Agents backend)
  handler.ts             routes, gates, guards
  cloud-agents.mjs       Cloud Agents client
  signals.ts             server-owned label table
  index.ts               Deno.serve(handler)
vercel.json              static output web/, rewrite /functions/v1/app/* -> /api/app/*
dev/                     checks, batteries, capture and deck tooling (see below)
pitch/                   deck source, HTML, the .pptx, presenter brief, the QR
Shotorko_Video_Pitch.mp4 the recorded walkthrough
```

## Running it locally

No dependencies, no build, no package manager.

```bash
cd web && python3 -m http.server 4173
# → http://localhost:4173
```

Served this way there is no backend, so the page runs **on-device only** — which is the honest
default, and the health probe hides the Live agent switch rather than offering a dead button.

## Checks

The offline checks need no key and no network. They import the TypeScript handler directly, so they
want **Node.js 23.6 or newer** (native type stripping). Verified on Node 26.

```bash
node dev/engine-check.js                        # classifier behaviour, on-device
node dev/backend-check.mjs                      # 69 checks — the Vercel edge handler, fetch faked
node dev/function-check.mjs                     # the Qoder Sites handler, Cloud Agents faked
node dev/false-positive-battery.mjs local       # on-device: no key, no quota, re-runnable anywhere
node dev/false-positive-battery.mjs https://abukawser.xyz   # same battery against the hosted model
```

The battery runs three sweeps in one pass — ten ordinary sentences with friendly context, the same
ten with every hostile situation flag forced on, then five real scam scripts as controls, because a
classifier that never pauses is not better than one that always does. On the on-device engine it
measures **0 of 10 · 1 of 10 · 4 of 5**, which is exactly what the deck prints.

`backend-check` and `function-check` assert the safety properties specifically: that the model
returns keys, that every display label is server-owned, that the pause needs the server's own
ask-gate, and that no upstream text or credential can reach a visitor.

The live probes drive a real browser over CDP and need a Chromium that speaks it
(`/snap/bin/chromium` here); nothing is installed and nothing is clicked by hand.

```bash
node dev/live-probe.mjs https://abukawser.xyz   # the live path renders in the page, not just in curl
node dev/shoot.mjs https://abukawser.xyz        # re-captures every screen into dev/shots/
node dev/record.mjs https://abukawser.xyz       # writes dev/clip/shotorko-story.mp4
```

The hosted battery depends on the provider's free quota, which is measured **per day**. Throttled
runs return HTTP 429; those are a quota artifact and must never be quoted as a classifier result.

## Pitch kit

```bash
node dev/build-deck.mjs        # pitch/deck-and-qa.md -> pitch/deck.html (browsable, 13 pages)
python3 dev/build-pptx.py      # -> pitch/Shotorko-GP-FutureMakers-2026.pptx (10 slides + 3 appendix)
python3 dev/render-pptx.py     # re-renders the .pptx with PIL to verify layout
python3 dev/build-brief.py     # -> pitch/Shotorko-Presenter-Brief.docx (the studying document)
```

`pitch/deck-and-qa.md` is the single source of truth: ten projector slides, three appendix slides,
their speaker notes and a 23-question Q&A bank. `dev/build-deck.mjs` generates the browsable HTML
entirely from it. The .pptx deliberately ships with **no speaker notes** — nothing in a notes pane
is spoken text, so nothing can leak into a PDF export or onto a projector. `dev/build-pptx.py` writes
only the hand-condensed projector cut; the sentences and the Q&A number to reach for stay in the
markdown, for the presenter to study separately. `dev/build-brief.py` assembles that separate study
document — `pitch/Shotorko-Presenter-Brief.docx` — by reading the engine source for the numbers, the
built .pptx for what is actually on each slide, and this markdown for the sentences to say.

The rule the deck is written to is **a slide carries keywords, the speaker note carries the
sentence**. Business and technology are balanced on purpose: 4, 8 and 9 are the market, the business
model and the sizing; 5, 6 and 7 are the product and the AI; 1, 2, 3 and 10 are the problem, the
competition and the close. Appendix A1 is every source, A2 is the sensitivity analysis behind the
revenue case, A3 reframes each question a judge is likely to ask as the concern behind it.

`dev/render-pptx.py` exists because PowerPoint is not available here: it redraws the actual .pptx at
128 px/inch with metrically close fonts and reports off-slide shapes, text that will not fit its box,
words too long to break and colliding copy. A clean report is not proof the deck is finished; a dirty
report is proof that it is not.

The .pptx embeds images captured from the deployed prototype, not mockups — `dev/shoot.mjs` against
`https://abukawser.xyz`. The story video is **not** embedded in the .pptx: slide 10 is a QR code that
points judges at `▶ Play the story` on the live site.

Bengali is a complex script: PowerPoint must be told the typeface through `a:cs` (and `a:ea`),
because `font.name` alone writes only `a:latin` and Bengali silently falls back. `build-pptx.py`
handles that.

## Market figures and where they come from

Every number a judge can challenge, with its primary source. Nothing in the deck is estimated, and
the two figures that *are* ours — the Tk 20 price and the 1% attach rate — are labelled as
assumptions on the slides that use them.

| Figure | Source |
|---|---|
| Tk 2.17T MFS value · Tk 182.7B e-money float · 258.7M accounts · 1.03bn transactions · 130.2M rural | [Bangladesh Bank, MFS statistics — transactions table 9, accounts table 8, 2026](https://www.bb.org.bd/econdata/fin_digitalfstat) (the tables are linked from that page as `tab9.pdf` / `tab8.pdf`; bb.org.bd serves a JavaScript challenge to non-browser clients, so open it in a browser) |
| 191.09M mobile subscribers · 87.20M Grameenphone (45.6%) | [BTRC, subscriber data by operator, August 2026](https://btrc.gov.bd/pages/static-pages/6922dda8933eb65569e15c3d) |
| 122.71M on 4G · 69.18% mobile-internet penetration | [BTRC, teledensity and penetration, August 2026](https://btrc.gov.bd/pages/static-pages/teledensity-penetration-8ecc0e-6922e009933eb65569e2524c) |
| 4M+ premium subscribers · 0.75% average conversion in Q4 2025 — **global figures, not Bangladeshi** | [Truecaller AB, 10 March 2026](https://corporate.truecaller.com/newsroom/press-release/truecaller-surpasses-4-million-premium-subscribers) |
| `##002#` cancels all call forwarding · `*#21#` shows its status (the codes the pilot ask names) | [Grameenphone, Useful Information](https://www.grameenphone.com/useful-information) |
| USD 3.99 a month for caller-line safety | [Verizon Call Filter Plus](https://www.verizon.com/support/call-filter-faqs/) |
| USD 3.5B reported lost to imposter scams in 2025 — **US, cited as a shape, not a size** | [US Federal Trade Commission, 15 June 2026](https://www.ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025) (the canonical page is Akamai-gated to non-browser clients; the Wayback snapshot of that URL resolves) |
| Tk 45.9B TAM · Tk 20.9B SAM · Tk 209M SOM | **calculated**: subscribers × Tk 20 × 12, then 1% attach — arithmetic on the rows above |

**What is deliberately not claimed:** there is no published Bangladeshi national fraud-loss figure,
so the deck prints none. BTRC publishes complaint counts dominated by general nuisance, not scam
losses. Appendix A1 ends with that sentence on purpose — a safety pitch that labels its own gaps is
easier to trust than one that rounds them away.

## Deploying

**Vercel** (what `abukawser.xyz` runs). The repo deploys as-is: `vercel.json` sets
`outputDirectory: "web"`, installs nothing and builds nothing, and rewrites `/functions/v1/app/:path*`
to `/api/app/:path*` so the frontend URL is identical on every host.

Set `GEMINI_API_KEY` in the project's environment — that is the only required variable.
`GEMINI_MODEL` is optional and defaults to `gemini-2.5-flash`. Without a key the health endpoint
returns `service_not_configured` and the page quietly runs on-device.

**Qoder Sites.** `functions/` is the alternative backend, using Qoder Cloud Agents. The access token
is a platform Secret (`QODER_PAT`) and must never appear in source, the browser bundle, prompts or
logs.

Either way, the frontend is untouched — `/functions/v1/app/*` is the contract.

---

Built for the GP FutureMakers 2026 Concept Pitch Round · Saturday 17 October 2026, GP House.
