# Shotorko (সতর্ক) — GP FutureMakers 2026 Concept Pitch
## Deck copy, 10 projector slides + 3 appendix, with speaker notes

**Rule for this deck:** a slide carries keywords, the speaker note carries the sentence. The
room is reading the screen while somebody else is talking, so nothing on a slide needs a verb to
be understood. Everything that needs explaining lives below, in the notes pane of the .pptx.

**Second rule:** every number that is demo data is labelled demo data, and every market number
has a named source on Appendix A1. Judges trust a team that labels its own fixtures and states its
own assumptions.

**Criterion map.** 1 Clarity · 2–3 Depth of Problem Understanding · 4 market size and Impact ·
5–6 Solution Strength and Differentiation · 7 AI Application & Technical Rationale · 8 Business
Model · 9 Market Analysis, Feasibility & Scalability · 10 Clarity, the ask and live proof.
Business and technology are deliberately interleaved — 4, 8, 9 are business slides; 5, 6, 7 are
product and AI slides. Q&A handling is the bank at the end, and Appendix A3 is its one-page sheet.

**Prototype link for slide 10:** `https://abukawser.xyz` — make it a QR. It works on a phone, needs
no login and no install. **Ready image:** `pitch/qr-abukawser.png`, 900×900, error correction H,
decodes to exactly that address (checked with `zbarimg`).
If the venue network cannot resolve the domain, type `https://shotorko-ai.vercel.app` — the same
deployment on its host address, classifier included.
Last resort, no network at all: `https://shotorko-demo-8604o4z09al.qoder.website` — same prototype,
on-device engine only, no hosted classifier.

---

## Slide 1 — Title

**On slide**

> **সতর্ক · Shotorko**
> **Stop the scam. Not the call.**
> Bangla-first voice safety · any phone · no app store
> GP FutureMakers 2026 · Concept Pitch Round
> Live prototype · abukawser.xyz
>
> *[the home screen of the deployed prototype, full height, right]*

**Speaker note (15s)**
"Shotorko means *be alert*. One sentence: a phone scam only works for about ninety seconds, and this is built to win those ninety seconds on the cheapest phone in the room. Everything you will see screenshotted in this deck is a real capture of a working prototype, and you can open it yourself at the end."

---

## Slide 2 — The problem: fear, urgency, secrecy

**On slide**

> **ভয় · তাড়া · একা** — Fear. Urgency. Secrecy.
>
> "আমি থানার ওসি। আপনার ছেলেকে ধরা হয়েছে। এখনই ৩০,০০০ টাকা পাঠান। কাউকে বলবেন না।"
> *Fake police. Son arrested. Send the money now. Tell no one.*
>
> Who absorbs it: older parents in district towns, on the phone they already own
>
> **One call** — 0:00 ভয় · 0:20 তাড়া · 1:10 একা · 3:00 টাকা পাঠানো · +2 দিন নাম্বার বন্ধ
>
> **The gap: nobody defends those three minutes**

**Speaker note (30s)**
"Not ignorance — timing. The scam is not a knowledge problem; the victim is not stupid. Fear, urgency and a demand for secrecy arrive together, and that combination shuts down the part of the brain that checks. Look at the clock on the right: three minutes from the first sentence to the money leaving, and two days until the number is dead. Nobody — not the bank, not the family, not the network — is in that three minutes. That window is the product."

---

## Slide 3 — Every defence answers a different crime

**On slide**

> | Carrier spam filters | built for volume, not for one persuasive voice **×** |
> | Number blocklists | a new SIM can cost as little as Tk 200 **×** |
> | Bank and MFS rules | they see the transfer, never the call **×** |
> | Awareness campaigns | the script rewords faster than the poster prints **×** |
> | Smartphone security apps | the phone at risk costs about Tk 1,000 **×** |
>
> **Missing: a defender inside the call, in Bangla**

**Speaker note (25s)**
"Each of these is a real control, and each has a specific reason it misses this case. The important asymmetry: the bank sees a transaction and the operator sees a call, and nobody sees the moment a person is being frightened into pressing buttons. And note the last row — the handset most exposed is the one no app can protect, which is why an app company cannot solve this and an operator can."

---

## Slide 4 — The market the money is in

**On slide**

> **The money is already digital.**
>
> MOBILE FINANCIAL SERVICES — BANGLADESH BANK, JULY 2026 · SUBSCRIBERS — BTRC, AUGUST 2026
>
> | **Tk 2.17T** MFS volume | **Tk 182.7B** e-money float | **258.7M** MFS accounts | **191.09M** mobile SIMs | **87.20M** Grameenphone · 45.6% share |
>
> *[button-phone screen]* this phone too
> — over a billion MFS transactions in a month
> — 130.2M MFS accounts are rural
> — **68M subscribers are still outside 4G — so the defence cannot live in the cloud**
>
> **The buyer is not the victim:** a parent loses the money, Grameenphone loses the trust

**Speaker note (30s)**
"This is the surface we are selling into, and it is published, not estimated. Bangladesh Bank's MFS tables record over a billion transactions in a single month, worth 2.17 trillion taka, on 258.7 million registered accounts — and more than half of those accounts are rural. BTRC counts 191 million mobile subscribers, 87.2 million of them Grameenphone. The business line at the bottom is the one to remember: the person who loses the money is not the person who buys the protection. Grameenphone buys it because 182.7 billion taka of e-money float is trust, and trust is the product."

---

## Slide 5 — Four moments, one defence

**On slide**

> **Four moments. One defence.**   *[captured from the live prototype]*
>
> *[precall]* ১ কলের আগে — before the call
> *[during]* ২ কলের ভেতরে — during the call
> *[thamun]* ৩ থামুন — the pause
> *[after]* ৪ রিপোর্ট — after
>
> **Two of the four need no smartphone at all.** They happen in the network.

**Speaker note (35s)**
"One continuous defence, four moments. Before the call, one Bangla sentence plays in the network before the phone rings — no app, no install, no smartphone. During the call, the handset understands intent and nothing is recorded. At the moment money or a code is about to move, the pause. And after, a spoken Bangla story becomes a complaint that can actually be filed, which feeds a radar that clusters numbers into the networks behind them. Two of those four need no software on the handset at all — that is the reach argument, and it is the reason the pilot can protect a button phone on day one."

---

## Slide 6 — থামুন: the pause

**On slide**

> **থামুন** — One question. Three buttons.
>
> [ যাচাই করুন ] we dial the verification number for you
> [ পরিবারকে ফোন ] the family you already saved, one tap
> [ আমি জানি ] the user decides — and it is still reported
>
> **Warn. Never block.**
> Wrong: one screen.  Right: Tk 30,000.
>
> *[the থামুন screen full height — live capture, risk 100/100]*

**Speaker note (40s)**
"This is the screen, and it is a live capture — that call scored risk 100 out of 100 on the on-device engine and was labelled fake police. Notice what it does not do. It does not block the call. It does not claim you are being scammed, because we may be wrong. It asks one question a frightened person can answer honestly, and offers three exits: verify, call family, or send it anyway — and *anyway* is honoured, and it still teaches the model. On a feature phone the same pause is a voice prompt with two keys. Warn, never block, because a wrong warning costs one screen and a right one keeps 30,000 taka."

---

## Slide 7 — The AI: intent, not a word list

**On slide**

> **Intent, not a word list.**
>
> EIGHT SIGNALS — `authority · leverage · urgency · secrecy · credential · payment · reward · install`
> × THE SITUATION AROUND THEM — `unknown caller · call in progress · first receiver · unusual amount · late night`
>
> **risk ≥ 50  +  an actual ask  =  থামুন**
>
> One signal is normal conversation. A mother asking for money is not a scam. The combination is.
>
> THE SAME SENTENCE, JUDGED LIVE *[verdict capture: risk 95/100, five signals in Bangla]*
> **0 of 10** ordinary sentences paused · **4 of 5** reworded scripts paused · **69** backend checks pass offline
>
> **On the handset. No cloud call, no per-call bill.**

**Speaker note (40s)**
"The claim you should test: the classifier does not look for the word OTP. It looks for pressure — authority claimed, a child in trouble, urgency, a demand for silence — and then an ask. Any one of those is normal conversation; the combination is the signature, and rewording does not escape it because the signals are semantic. Two gates sit on top: the situation multiplies the score, and nothing fires without an actual ask. I measured rather than hoped — ten ordinary sentences in friendly context produce zero pauses; five reworded scam scripts produce four. The reason it must run on the handset is not only privacy: 68 million subscribers are not on 4G, and a rural handset cannot round-trip to a cloud model inside a three-minute window."

---

## Slide 8 — Business model

**On slide**

> **Who pays, and why they keep paying.**
>
> WHO PAYS **Subscriber** · Tk 20 a month, opt-in → WHO BILLS **Grameenphone** · on the phone bill, as a pack → WHO BUILDS **Shotorko** · model, engine, report standard
>
> **Revenue** — Tk 20 × 1% of GP's 87.20M base = Tk 209M in year one
> **Cost avoided** — fraud refunds · hotline minutes · churn after a publicised loss
> **Later** — scam-network intelligence, licensed to MFS operators, 999 and BTRC
>
> PROOF THAT PEOPLE PAY FOR THIS
> — Truecaller: 4M+ paying subscribers, 0.75% of free users convert (Mar 2026)
> — Verizon Call Filter Plus: USD 3.99 a month — and it only blocks numbers
>
> **Margin:** the classifier runs on the handset, so a warning is not a cloud bill

**Speaker note (40s)**
"The subscriber pays 20 taka a month, Grameenphone bills it as an ordinary value-added pack, and we supply the model, the engine and the report standard. Year one at one percent attach on GP's base is 209 million taka — small money for an operator, which is honest, and the bigger line is cost avoided: fraud refunds, contact-centre minutes, and the churn that follows a publicised loss in a wallet holding 182.7 billion taka of float. One percent is not a hope: Truecaller converts 0.75 percent of its free base into paid subscribers, and Verizon sells the weaker version of this product — caller blocking — at four dollars a month. Our margin is structural: inference runs on the handset, so serving a warning costs no cloud call."

---

## Slide 9 — Market size and go-to-market

**On slide**

> **TAM · SAM · SOM**
>
> | **Tk 45.9B** TAM · every mobile subscriber — 191.09M × Tk 20 × 12, calculated | **Tk 20.9B** SAM · Grameenphone's base — 87.20M × Tk 20 × 12, calculated | **Tk 209M** SOM · year one — 1% attach, Truecaller converts 0.75% |
>
> GO-TO-MARKET
> **Phase 1 · 0–6 months** — one district, 5,000 opt-in, GP fraud-cell audio, the network warning first
> **Phase 2 · 6–18 months** — nationwide add-on pack, MFS agent shops, 999 and fraud-cell handoff
> **Phase 3 · 18 months+** — a shared report standard, other operators, licensed to MFS and BTRC
>
> Denominators are BTRC and Bangladesh Bank; the Tk 20 price and 1% attach are our assumptions.
> **Entry wedge:** the pre-call network warning reaches every handset GP already serves — no install, no upgrade

**Speaker note (30s)**
"The sizing is arithmetic you can redo on a napkin: 191 million subscribers at 20 taka a month is 45.9 billion taka, GP's own base is 20.9 billion, and a one percent attach is 209 million in year one. I want to be explicit that the price and the attach rate are our assumptions — no Bangladeshi willingness-to-pay survey covers this category, and I will not pretend one does. The sequencing matters more than the number: phase one is the pre-call network warning, because it needs no handset software, no upgrade and no app store, so it reaches all 87 million subscribers on the day it switches on."

---

## Slide 10 — Impact, the ask, and live proof

**On slide**

> **সতর্ক থাকুন।** — Stay alert. Tell the family.
>
> WHAT CHANGES IF THIS WORKS
> — Tk 30,000 stays with the person least able to lose it
> — one filed report instead of one family argument
> — trust in digital money stays with Grameenphone
>
> WHAT WE ASK GP FOR — 1 fraud-call audio and CDR patterns, anonymised · 2 one network announcement slot ·
> 3 one USSD gating test on *21 · 4 one pilot district, 90 days
>
> **[QR]** **abukawser.xyz** — no login, no install, works on a phone
>
> On the site: **Play the story** runs the whole intervention in under a minute; **নিজে যাচাই** takes a scam line you were actually sent.
> Reputations and radar records are demo data, and the page says so on every screen.

**Speaker note (25s)**
"Three things change: the money stays with the person least able to lose it, a victim's spoken story becomes a filed record instead of a family argument, and trust in digital finance stays inside Grameenphone. To find out whether that is real I need four things — the fraud cell's recordings, one announcement slot, one USSD gating test, and a district for ninety days. Everything you saw screenshotted is live on this address right now. The on-device engine answers with no network at all, and flip to Live agent to watch the same sentence judged by a hosted model. Thank you."

---

## Appendix A1 — Sources

**On slide**

> **Every number, and where it came from.**
>
> | Tk 2.17T · Tk 182.7B · 258.7M | Bangladesh Bank, MFS statistics: transactions table 9, accounts table 8, 2026 — bb.org.bd/econdata/fin_digitalfstat |
> | 191.09M · 87.20M | BTRC, mobile subscribers by operator, August 2026 — btrc.gov.bd/pages/static-pages/6922dda8933eb65569e15c3d |
> | 122.71M on 4G · 69.18% mobile-internet penetration | BTRC, teledensity and penetration, August 2026 — btrc.gov.bd/pages/static-pages/teledensity-penetration-8ecc0e-6922e009933eb65569e2524c |
> | 4M+ subscribers · 0.75% conversion | Truecaller AB, 10 March 2026 — news.cision.com/truecaller-ab/r/truecaller-surpasses-4-million-premium-subscribers,c4318816 |
> | USD 3.99 a month | Verizon Call Filter Plus — verizon.com/support/call-filter-faqs |
> | USD 3.5B lost to imposter scams | US Federal Trade Commission, 15 June 2026 — ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025 |
> | Tk 45.9B · 20.9B · 209M | calculated by us from the tables above; the Tk 20 price and 1% attach rate are our own assumptions |
>
> **What we will not claim:** there is no published Bangladeshi national fraud-loss figure, and we did not invent one

**Speaker note (15s, only if a number is challenged)**
"Two primary sources carry every market number in this deck: Bangladesh Bank's MFS statistics for July 2026, and BTRC's subscriber and penetration tables for August 2026. The behavioural benchmarks are Truecaller's published subscriber count and conversion rate, and Verizon's published price. The FTC figure is there to show the category, not the market — it is American. Anything marked calculated is arithmetic on those tables, and the price and attach rate are ours, which is the first thing I would want tested in a pilot."

---

## Appendix A2 — Unit economics

**On slide**

> **Sensitivity, and what it costs to serve.**
>
> GP BASE OF 87.20M SUBSCRIBERS, AT Tk 20 A MONTH
> 0.5% ▓ Tk 105M/yr · **1% ▓▓ Tk 209M/yr** *base case* · 2% ▓▓▓ Tk 419M/yr · 3% ▓▓▓▓▓ Tk 628M/yr
>
> COST TO SERVE
> — the classifier runs on the handset — no inference per call
> — the cloud is used only to write the complaint letter
> — no app-store royalty: the product is a network service
>
> WHY GP WOULD BUY IT
> — retention: safety is a reason to stay on the network
> — Tk 182.7B of e-money float depends on trust
> — fewer fraud tickets in the contact centre
> — consumer-protection leadership with BTRC

**Speaker note (20s)**
"The revenue case is linear in attach rate, so the only assumption worth arguing about is that rate: half a percent is 105 million taka, three percent is 628 million. Cost does not scale with it, because the classifier is inference the handset already pays for; the cloud is only in the complaint letter, which the user starts. That is why the margin survives a hundredfold in volume — the thing that breaks at scale is trust in the alert, not the infrastructure."

---

## Appendix A3 — Backup: Judge Q&A

**On slide**

> **What each question is really asking.**
>
> | Revenue opportunity? | Tk 45.9B all operators · Tk 20.9B on GP's base — gross, before cost |
> | Tk 20 and 1% — on what basis? | Truecaller 0.75% conversion, global; our 1% is a target only |
> | No-app phones — how? | GP signals before the ring; the Bangla listening is on the handset |
> | Prototype vs production? | this demo uses a hosted model; production runs on the handset |
> | What still costs money? | USSD and airtime, complaint handling, updates, support — unmeasured |
> | GP nets more than it spends? | unknown today — the 90-day pilot exists to show it |
> | Do people pay for this? | evidence users pay for safety, not proof of this price point |
> | What would change the plan? | real Bangla speech that cannot hold the false-positive rate |

**Speaker note (reference slide — not presented)**
"This page is the answer sheet. The rule for the three minutes: the direct answer first, then the honest limit, then what would change the answer. Never quote the demo dashboard as if it were a field trial, and never quote the hosted battery while Google's free quota is throttling — the on-device numbers are the ones on the slide because they are the ones that re-run identically anywhere."

---
---

# Q&A bank

*Seven scored criteria; six of them are won or lost here. Answer in this order: the direct answer, then the honest limit, then what would change the answer.*

### On the AI

**1. Why on-device at all? Just run a big model in the cloud.**
"Because of the pause window. We have seconds while a person is mid-conversation, on a rural handset that may be on 2G. A round trip is not the failure — the failure is the round trip failing silently and the user never hearing anything. On-device also solves the privacy objection permanently: there is no audio upload to secure. The cloud is used for the part that genuinely needs generation — turning a spoken story into a written complaint — where a few seconds is acceptable."

**2. How do you stop false positives? Warning someone during their son's real call to ask for money is a disaster.**
"Three gates. First, the pause needs an actual ask — payment, a code, an install, or call forwarding. Words alone don't fire it. Second, the situation multiplies the score: a saved caller, daytime, familiar amount stays quiet. Third, the threshold is deliberately conservative, and the product is allowed to be wrong quietly — it warns, it never blocks, so a false positive costs one screen, not a broken transaction.

I measured it rather than hoping: ten ordinary sentences — a son home from school, a class fee, borrowing from a brother, a delivery, a recharge SMS, a doctor's bill, a wedding, a neighbour's advance, a Banglish rickshaw fare, and a child asking her mother not to tell her father — run through the classifier twice, once with friendly context and once with every hostile flag forced on. Friendly context: **zero pauses out of ten**, the worst one scoring 32 against a threshold of 50. Every hostile flag on: **one pause in ten**, and it was the last sentence — 'tell abbu nothing, I need 3000 taka' — which under 'unknown caller, mid-call, unusual amount, 2am' is the definition of the attack, so I count it as correct behaviour with a false alarm attached. The five scam scripts as controls paused four. The fifth was a bare `*21` instruction with no money, no code and no pressure: it stayed quiet on purpose, because the pause is not how we stop forwarding — that's the network-side gating on Appendix A3. And we ship a 'ঠিক ছিল' button on every warning so the false-alarm count is a live number, not a hope."

**3. Your 'model' in the prototype is a scoring function, not a neural network. Isn't that overclaiming?**
"The prototype's default engine is a deterministic implementation of the signal model — on purpose, because it's the part that must be inspectable and it runs instantly offline. The same page can flip to a hosted classifier over the identical output contract, and that's the point: the schema, the gates and the labels are the design work, and any model that fills that contract drops in without touching the product. What I'd need is the training corpus, which is exactly item one on the ask slide."

**3b. You flipped it to 'Live agent' — so is the pause a cloud call after all?**
"Only as a demonstration of the contract. The hosted call returns risk, signal keys and a pause flag; the page never renders a string from the model, every label is fixed server-side, and the pause still needs the server's own ask-gate before it interrupts. Two properties we'd keep either way: if the network is slow, blocked or rate-limited, the page falls back to the on-device verdict with no visible failure, because a safety product that depends on connectivity is worse than none; and the classifier's answer is never allowed to decide the interruption alone."

**4. Bangla dialects, Chittagonian, Sylheti, and Banglish typing. How does that work?**
"Two things. The prototype already normalises Banglish — Latin-typed Bangla — and dialect spellings, because that's how people actually write, and it's cheap to handle with stems. For speech, dialect is the hardest item in the plan and I won't pretend otherwise; that's why the first milestone is real recordings, and why the network-side pre-call warning works with no speech recognition at all. We do not need the model to be perfect for the first layer to save money."

**5. What does the model see — the whole call?**
"No. It sees the current utterance and the rolling signal set, and nothing is stored. There is no recording, no upload, and no call history. If a user has not opted in to during-call listening, the product still has the pre-call warning and the radar, which need no audio at all."

### On feasibility

**6. Can you really inject an announcement before the ring?**
"That's a network capability GP has, not something we'd have to invent — it's the same class of mechanism as operator voice prompts and ringback content. It's item two on the ask slide precisely because it needs a test slot, not because it's theoretically impossible. And the fallback is honest: if injection can't be reached, the same warning plays as a USSD or SMS flash at call setup, which is weaker but still network-side and still reaches a button phone."

**7. Android can't read USSD responses. So how does the pause fire when someone is doing `*247#`?**
"It can't, which is why we don't claim it. Two real options: an AccessibilityService watching the dialer and payment apps, which works but is a permission we'd have to earn carefully; or operator-side gating on the forwarding and cash-out codes, which is the stronger design and only an operator can do. The prototype's pause fires on the intent — the request for money or a code — not on a fake claim of reading the screen."

**8. What's the cost per user? Does this need a data centre?**
"The pre-call warning and the radar are network-side and cheap: a lookup at call setup and a nightly clustering job over complaints. The on-device model costs GP nothing in inference because the handset pays for it. The cloud is for generation only, and it is user-initiated — a hosted classifier or a written complaint. On the prototype today that round trip is about a second and a half end to end, and nothing in the pause path waits for it, because the interruption decision is made locally first and independently."

**9. What breaks first at 100,000 users?**
"Number reputation staleness and report quality. A blocklist decays in days. The radar is the answer — clustering by script rather than by number means a fresh SIM inherits the network's history the moment it repeats the phrasing. The second thing that breaks is trust: at scale, a few loud false positives will end the product, which is why the false-alarm count is a first-class metric from day one."

### On differentiation

**10. Why won't another operator just copy this in six months?**
"They can, and eventually one will. The durable advantage isn't the algorithm — it's being the operator whose users learned that their network warned them, and having the largest report corpus in the country feeding the clustering. That's also why we'd push the report format as a cross-operator and police standard early: as the originator, GP's data is in every cluster; as a follower, it isn't."

**11. Isn't this a feature, not a product?**
"As a single screen, yes. As a loop — warn, pause, notify family, checkpoint at the agent, convert the story into a filing, and cluster filings back into reputation — it's a product with its own retention reason and its own data asset. The evidence it's not a feature is that half the loop needs no handset software at all."

**12. Who pays? What's the revenue?**
"The subscriber pays, Grameenphone bills it, and the justification is not only ARPU — it's float trust and support cost. Every fraud loss on an MFS wallet is a customer who stops trusting digital finance, plus a call-centre case, plus a regulatory story. The secondary path is the one every operator eventually sells: verified fraud intelligence to banks, MFS providers and police."

**13. Google and Samsung already have scam detection. Why does Bangladesh need another one?**
"They need a smartphone, English-first or a limited language list, and handset-level permissions, and they block rather than intervene. The at-risk person here is on a Tk 800 button phone in a district town speaking Sylheti. Anything that requires them to own the right handset has already excluded them."

### On the market and the business

**14. How big is this market, really?**
"Arithmetic on two published tables, not a survey. 191.09 million mobile subscribers at a Tk 20 monthly pack is Tk 45.9 billion a year as a theoretical ceiling; Grameenphone's own 87.20 million base makes the serviceable market Tk 20.9 billion; one percent attach is Tk 209 million in year one. I'd defend the denominators, because Bangladesh Bank and BTRC publish them, and I'd flag the price and the attach rate as ours, because nobody has surveyed willingness to pay for caller safety in Bangladesh. That gap is the first thing a pilot measures."

**15. Is anyone anywhere proven to pay for this?**
"Yes, and on a much bigger free base than ours. Truecaller reported in March 2026 that it had passed four million premium subscribers, converting 0.75 percent of its active free users — so our one percent assumption on an *opt-in* paid pack is deliberately above their measured rate, and the pilot has to earn it. Verizon sells the weaker version — caller blocking, no Bangla, no intervention — at USD 3.99 a month per line. Both benchmarks are on Appendix A1 with their links."

**16. What does it cost to serve a million users?**
"Not a million cloud calls. The classifier is inference the handset already pays for, so interruption volume does not move GP's bill. The network-side pre-call warning is a lookup at call setup. The cloud is used for the generative complaint letter, which the user starts deliberately, and for a nightly clustering job over reports. That is why the revenue line is linear in attach rate while the cost line is not — the constraint at scale is trust in the alert, not capacity."

**17. Why would an operator price it at Tk 20? That's above what people pay for tunes.**
"It is priced as a pack, not as content, and the comparison I'd make is the cost of the loss it prevents: one interrupted scam keeps Tk 30,000 in a district town, which is a year of household income for the segment at risk. And the pack does not have to carry the whole case — the network warning, which needs no handset software, is the part GP could give the whole base for free as a retention benefit, and charge only for the family circle and the on-device pause. That split is a pricing experiment I would want GP to run, not an assumption I want to defend on stage."

**18. What is the growth path past Grameenphone?**
"Three phases, in order of reach rather than revenue. Phase one is GP-only, one district, the network warning first because it works on every handset already on the network. Phase two is the nationwide add-on pack plus the agent-shop checkpoint, which is where the money actually leaves. Phase three is the report standard — because the scripts are national, not per-operator, a Robi user reporting a number that also rings GP users is GP's data improving, and licensing the clustered network view to MFS providers, 999 and BTRC is the line that scales past a single operator's subscriber base."

**19. What is the total addressable loss, i.e. how much fraud happens in Bangladesh?**
"I don't have a verified number, and I won't print one. There is no published national fraud-loss statistic for Bangladesh; BTRC publishes complaint counts that are dominated by general nuisance, not scam losses. That is exactly why Appendix A1 ends with 'what we will not claim'. The proxy I would use in a room is the American one, clearly labelled as a proxy: the US FTC recorded USD 3.5 billion lost to imposter scams in 2025, the single most-reported fraud category — which tells you the shape of the problem, not its size in taka."

**20. If this is a network service, why does it need an AI team at all?**
"Because the network can prove who is calling, but only a model can tell whether what they are saying is a scam. Reputation gates the volume; semantics carry the one sentence that stops a grandmother who trusts the voice. The AI is also what makes the product Bangla-first rather than English-first, which is the entire reason a global handset feature does not already cover this market."

### On impact and ethics

**21. What about surveillance? A service that listens to calls is exactly what people fear about operators.**
"The design answer is that the sensitive part never leaves the handset and nothing is stored — that's why on-device is a product decision, not a technical preference. The parts that are network-side use call metadata, not content. And the family alert sends 'a suspicious call is running', never what was said. If we can't state that in one sentence a user believes, we shouldn't ship it."

**22. What if a scammer uses Shotorko — say, to find out whether a number is protected?**
"The radar only ever answers about a caller, not about the listener, and the reputation answer is a warning string, not a user record. Nothing in the product tells a caller whether the person they're ringing has protection on. The abuse surface I'd worry about more is false reports poisoning a number's reputation, which is why reports are clustered and a single complaint never silently blocks anything — the product doesn't block at all."

**23. What would make you stop working on this?**
"If after four weeks of real recordings the false-positive rate can't be pushed low enough that a warning is worth less than the annoyance it causes. In that case the pre-call warning and the radar still stand on their own, and the pause gets dropped. I'd rather name that now than be asked for it."

---

# Layout notes for whoever builds the slides

- **A rendered preview of this copy exists:** open `pitch/deck.html` (arrow keys, `N` for notes,
  Ctrl-P prints landscape pages). Regenerate it after any edit with `node dev/build-deck.mjs`.
  It reads this file — the copy and the preview cannot disagree. It also flags any slide whose text
  runs past one 16:9 frame at projector size, which is the cut list for the day.

- **The .pptx is generated, not hand-built:** `python3 dev/build-pptx.py` writes
  `pitch/Shotorko-GP-FutureMakers-2026.pptx` — the speaker notes are read from this file, so the deck
  and these notes cannot disagree. Edit `dev/build-pptx.py`, never the .pptx. The projector copy on the
  slides is the keyword cut above, deliberately thinner than this markdown.
- **Nothing on this machine can open PowerPoint**, so `python3 dev/render-pptx.py` re-draws the real
  .pptx with PIL at 128 px/inch into `.deckcheck/` and reports off-slide shapes, text that will not fit
  its box, unbreakable words and colliding copy. Read the PNGs before believing any claim about how a
  slide looks. A clean report is not proof the deck is finished; a dirty one is proof it isn't.
- **Slide 6 is the money slide.** `dev/shots/devices/thamun.png` full-height. Bangla headline stays at
  least 58pt — it has to be read on a projector from the back.
- **Slides 4, 8 and 9 are the business slides** and they carry the weight in a Q&A that will be about
  the market. Every number on them is on Appendix A1 with a named publication and a month; the ones
  that are ours — Tk 20 and 1% — are labelled as assumptions on the slide itself.
- **No business chart exists as an image.** The stat cards, the TAM/SAM/SOM row, the revenue flow and
  the attach-rate ladder on A2 are composed from shapes by the builder, not screenshots.
- **The 46-second clip is deliberately NOT embedded** (`dev/clip/shotorko-story.mp4`). There is no
  renderer here to prove a media part opens clean, and a "repair this deck" prompt on the graded upload
  is the one failure that cannot be recovered from. Carry the clip as a file on the laptop instead: if
  the venue network dies, play it and keep talking. A clip of the real product beats an apology for a router.
- **Which images the slides use:** everything in `dev/shots/devices/` is a 2× crop of the single handset
  element on the live page — a whole dashboard shrunk into a PowerPoint is unreadable, a phone is not.
  `dev/shots/*.png` are the full pages, kept for reference. `verdict.png` is the console's verdict card
  alone, and it is the only slide image produced by a real hosted model call. Re-shoot all of it with
  `node dev/shoot.mjs https://abukawser.xyz` after any UI change.
- **Slide 7**: the eight signals are chips, not a bullet list, and `devices/verdict.png` sits beside them
  so the "type anything" claim is visibly a real answer, not a mock.
- **Appendix slides are page-numbered A1/A2/A3, not 11/12/13**, so nobody mistakes them for part of the
  ten. Upload them after slide 10 only if the form allows more than ten files or more than ten slides —
  read the submission page before the deadline, and if it hard-caps at ten, drop A3 (the Q&A sheet is
  already in the notes pane of every slide) and keep A1 and A2.
- **Bangla is a complex script:** PowerPoint reads the face from `a:cs`, and `font.name` only ever writes
  `a:latin`. `set_fonts()` in the builder writes all three channels, and `runs_of()` splits any run that
  mixes Bangla into an English sentence so the Latin keeps Segoe UI. The taka sign `৳` is avoided in
  favour of `Tk` — it is not reliably in Segoe UI, and a missing glyph on a stat card is fatal.
- Palette already used by the prototype, keep the deck consistent: background `#0d1117`, amber `#f5b53f` (Shotorko's voice), calm green `#4fd6a8`, red `#ff4d43` reserved **only** for থামুন.
- Type: Noto Sans Bengali / Hind Siluri for Bangla, a clean grotesque for Latin.

# Pre-flight — run these before the deck is uploaded, and again on the morning

Everything above is a claim until these four commands say otherwise. They need no key and no
browser, and they take about five minutes.

| | Command | What it proves |
|---|---|---|
| 1 | `node dev/backend-check.mjs` | The classifier's contract: server-owned labels, the ask-gate, no credential or provider text ever reaching the browser. 69 checks, all offline. |
| 2 | `node dev/false-positive-battery.mjs local` | The false-alarm numbers on slide 7 and in Q&A 2, against the on-device engine. Deterministic, no quota, re-runnable anywhere. |
| 3 | `node dev/false-positive-battery.mjs https://abukawser.xyz` | The same battery against the hosted model. **This one depends on Google's free quota, which is measured per day** — run it early in the day, not at 4pm. |
| 4 | `node dev/live-probe.mjs` | A real browser opens the deployed page, flips to Live agent, reads the rendered Bangla labels and files a complaint. The only check that proves the demo a judge sees. |

Then by hand, on a phone, on the venue network rather than the office one:

- Scan the QR on `pitch/qr-abukawser.png` and press **Play the story** once, end to end.
- Type one scam line you actually received into **নিজে যাচাই**, in Bangla or Banglish.
- Flip **Live agent** and run the same line. If it comes back on-device with no visible error, that
  is the fallback working, not a failure — say so out loud, it is a better answer than a green tick.
- Re-check every figure on Appendix A1 against its source, the morning of. BTRC publishes subscriber
  numbers monthly; if September has landed, use it and change the month on the slide, not the claim.

**If the hosted engine is throttled on the day:** nothing about the pitch changes. The on-device
engine is the version phase one ships, it answers with no network at all, and Q&A 3b already says
the cloud call is a demonstration of the contract. Lead with the offline engine, flip to live if it
answers, and never let a demo depend on a quota you don't control.

## Run log — re-run these against the numbers printed on the slides

| 15–16 Oct | Check | Result |
|---|---|---|
| 1 | `backend-check.mjs` | **69/69 pass**, offline |
| 2 | `false-positive-battery.mjs local` | **0/10 calm · 1/10 hostile · 4/5 scams** — exactly the line on slide 7. Worst calm score 32 against a threshold of 50; the one hostile pause is "tell abbu nothing, I need 3000 taka", which under unknown-caller/mid-call/2am is the attack, so it is correct behaviour with a false alarm attached. The 5th scam stayed quiet on purpose: a bare `*21` with no money, code or pressure is stopped network-side, not by the pause. |
| 3 | `false-positive-battery.mjs https://abukawser.xyz` | **Did not complete — 12 of 25 requests came back HTTP 429 `rate_limited`.** Its `0 paused of 5` footer is a quota artifact and must never be quoted as a hosted result. Re-run after the daily reset. |
| 4 | `live-probe.mjs` | **9 of 10 pass; the 1 failure is the quota, not the product.** The hosted console call came back `HTTP 429` and the page answered on-device anyway — risk 83, pause fired, four server-owned signal keys, chips rendered as labels not objects, and the spoken story became a 1065-character complaint draft. That is Q&A 3b's fallback claim observed in a real browser, which is a better thing to have proven than a green tick. |
| — | `shoot.mjs` | The console verdict on slide 7 **is** a real hosted answer: `engine=live`, risk 95/100 against threshold 50, five intent signals named in Bangla. One observed call, described as one observed call. |
| 16 Oct | market figures on slides 4, 8, 9 and A1 | Re-fetched from source and re-read: BTRC mobile subscribers for **August 2026** (GP 87.20M, total 191.09M), BTRC teledensity for August 2026 (4G 122.71M, mobile internet 69.18%), Bangladesh Bank MFS **transaction** statistics for July 2026 (1,027,196,369 transactions, Tk 2,165,120.41 million = Tk 2.17T, e-money float Tk 182.7B) and **account** statistics for July 2026 (258,684,285 total, rural 130,239,663 > urban 128,444,622). Truecaller's four-million-premium-subscriber release of 10 March 2026 (0.75% conversion). Verizon Call Filter Plus at USD 3.99/month. |

So every number printed on a slide is either a published figure re-read from its own source, or an
arithmetic on published figures labelled *calculated*, or an assumption labelled as ours. The
prototype numbers on slide 7 are **on-device** numbers, re-measured today. The only hosted claim on
any slide is the single verdict card, and it says "judged live" rather than implying a rate.

---

# Timing

Slides 1–4 ≈ 1:40 · slides 5–7 ≈ 1:55 · slides 8–9 ≈ 1:10 · slide 10 ≈ 0:25.
**Total ≈ 4:50**, which leaves the three minutes of Q&A intact.
To cut to 3:30: drop slide 3 to three rows, merge slide 9's phases into slide 8, and take slide 4
down to the four stat cards without the reach lines. Never cut slide 6 or slide 10.
Appendix slides are not timed — they are walked back to from a question.
