#!/usr/bin/env python3
"""
Build pitch/Shotorko-GP-FutureMakers-2026.pptx.

The on-slide copy here is the projector cut of pitch/deck-and-qa.md: image-led, a
fraction of the words, because a slide is read from the back of a room while somebody
else is talking. The markdown stays the source of truth for the speaker notes, which
are carried into the notes pane of every slide with the criterion that slide scores
and the Q&A answer to reach for if a judge pulls that thread.

Every picture is a real capture of the deployed prototype — dev/shoot.mjs against
https://abukawser.xyz — so the slides and the QR on slide 10 lead to one page.

    python3 dev/build-pptx.py
"""

import re
import struct
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "dev" / "shots" / "devices"
QR = ROOT / "pitch" / "qr-abukawser.png"
MD = ROOT / "pitch" / "deck-and-qa.md"
OUT = ROOT / "pitch" / "Shotorko-GP-FutureMakers-2026.pptx"

W, H = 13.333, 7.5
ML, MR = 0.72, 12.613          # left margin, right edge
CW = MR - ML                   # content width

BG = RGBColor(0x0D, 0x11, 0x17)
SURF = RGBColor(0x18, 0x21, 0x2D)
SURF2 = RGBColor(0x1F, 0x2A, 0x38)
LINE = RGBColor(0x2B, 0x3A, 0x4D)
TEXT = RGBColor(0xEE, 0xF3, 0xF8)
MUTED = RGBColor(0x93, 0xA6, 0xBA)
AMBER = RGBColor(0xF5, 0xB5, 0x3F)
CALM = RGBColor(0x4F, 0xD6, 0xA8)
ALERT = RGBColor(0xFF, 0x4D, 0x43)

LT = "Segoe UI"
BN = "Nirmala UI"              # ships with Windows, which is the machine in the room

In = Inches


def png_size(path):
    with open(path, "rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path} is not a PNG — re-run node dev/shoot.mjs")
    return struct.unpack(">II", head[16:24])


def aspect(name, path=None):
    p = Path(path) if path else SHOTS / f"{name}.png"
    pw, ph = png_size(p)
    return pw / ph


# ── primitives ───────────────────────────────────────────────


def set_fonts(run, face):
    """Bengali is a complex script: PowerPoint takes the face from a:cs, and
    font.name alone only ever writes a:latin. Both channels, always."""
    rPr = run._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea", "a:cs"):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {})
            rPr.append(el)
        el.set("typeface", face)


def style(run, size=16, color=TEXT, bold=False, italic=False, bn=False):
    f = run.font
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.color.rgb = color                      # solidFill has to precede the typefaces
    set_fonts(run, BN if bn else LT)


ALIGN = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}


def text(slide, x, y, w, h, paras, anchor="t", wrap=True):
    """paras: [{runs: [(txt, style_kwargs)], align, sb, sa, line}]"""
    box = slide.shapes.add_textbox(In(x), In(y), In(w), In(h))
    tf = box.text_frame
    tf.word_wrap = wrap
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
    for i, p in enumerate(paras):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = ALIGN[p.get("align", "l")]
        para.space_before = Pt(p.get("sb", 0))
        para.space_after = Pt(p.get("sa", 0))
        if p.get("line"):
            para.line_spacing = p["line"]
        for txt, kw in p["runs"]:
            r = para.add_run()
            r.text = txt
            style(r, **kw)
    return box


def rect(slide, x, y, w, h, fill=SURF, line=None, line_w=1.0, pill=False, radius=None):
    st = MSO_SHAPE.ROUNDED_RECTANGLE if (pill or radius is not None) else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(st, In(x), In(y), In(w), In(h))
    if pill:
        s.adjustments[0] = 0.5
    elif radius is not None:
        s.adjustments[0] = radius
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(line_w)
    s.shadow.inherit = False
    return s


def label_in(shape, txt, size, color, bold=True, bn=False):
    tf = shape.text_frame
    tf.word_wrap = False
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    para = tf.paragraphs[0]
    para.alignment = PP_ALIGN.CENTER
    r = para.add_run()
    r.text = txt
    style(r, size=size, color=color, bold=bold, bn=bn)


def chip_w(label, size, bn=False):
    return 0.3 + len(label) * size * (0.0108 if bn else 0.0072)


def chip_flow(slide, x, y, max_x, labels, color, size=12.5, bn=False, gap=0.13, row=0.42):
    """Flow the chips instead of overflowing them off the right edge."""
    cx, cy = x, y
    for lab in labels:
        w = chip_w(lab, size, bn)
        if cx + w > max_x and cx > x:
            cx, cy = x, cy + row
        s = rect(slide, cx, cy, w, row - 0.08, fill=SURF2, line=color, line_w=1.0, pill=True)
        label_in(s, lab, size, color, bold=False, bn=bn)
        cx += w + gap
    return cy + row


def pic(slide, name, x, y, h=None, w=None, path=None):
    p = Path(path) if path else SHOTS / f"{name}.png"
    ar = aspect(None, p)
    if h is not None:
        w = h * ar
    else:
        h = w / ar
    slide.shapes.add_picture(str(p), In(x), In(y), In(w), In(h))
    return w, h


def kicker(slide, x, y, what, w=CW):
    text(slide, x, y, w, 0.28, [{"runs": [(what, dict(size=10.5, color=MUTED, bold=True))]}])


def slide_shell(prs, tag, page):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = BG
    text(s, ML, 0.44, 9.0, 0.28, [{"runs": [(tag, dict(size=11.5, color=AMBER, bold=True))]}])
    hline(s, ML, 1.5, CW)
    text(s, ML, H - 0.5, 7.0, 0.28, [{"runs": [
        ("Shotorko · সতর্ক · GP FutureMakers 2026 Concept Round", dict(size=9, color=MUTED, bn=True))]}])
    text(s, MR - 1.0, H - 0.5, 1.0, 0.28, [{"runs": [(f"{page} / 10", dict(size=9, color=MUTED))], "align": "r"}])
    return s


def hline(slide, x, y, w, color=LINE, weight=1.25):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, In(x), In(y), In(w), Pt(weight))
    s.fill.solid()
    s.fill.fore_color.rgb = color
    s.line.fill.background()
    s.shadow.inherit = False
    return s


def title(slide, runs, y=1.68, size=28, w=CW, x=ML):
    text(slide, x, y, w, 0.55, [{"runs": runs}])


def rows_table(slide, x, y, w, rows, col1, size=13.5, row_h=0.52, gap=0.08):
    """A table made of shapes: a real pptx table inherits PowerPoint's light theme
    borders and fills, which is the wrong surface for a dark deck."""
    for i, (a, b) in enumerate(rows):
        ry = y + i * (row_h + gap)
        rect(slide, x, ry, w, row_h, fill=SURF if i % 2 == 0 else SURF2, radius=0.12)
        text(slide, x + 0.2, ry, col1 - 0.3, row_h,
             [{"runs": [(a, dict(size=size, color=AMBER, bold=True))]}], anchor="m")
        text(slide, x + col1, ry, w - col1 - 0.25, row_h,
             [{"runs": [(b, dict(size=size, color=TEXT))]}], anchor="m")
    return y + len(rows) * (row_h + gap)


def pill(slide, x, y, w, h, txt, color, size=12):
    s = rect(slide, x, y, w, h, fill=None, line=color, line_w=1.25, pill=True)
    label_in(s, txt, size, color)
    return s


def notes(slide, note, criterion, if_asked):
    slide.notes_slide.notes_text_frame.text = (
        f"{note}\n\n— Scoring: {criterion}\n— If asked: {if_asked}"
    )


# ── speaker notes come from the markdown, not from here ──────

def load_notes():
    src = MD.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r"^## Slide (\d+) — .+$", src, re.M):
        num = int(m.group(1))
        note = re.search(r"^\*\*Speaker note(?: \(\d+s\))?\*\*\n(.*?)(?=^\*\*|^\n---|\Z)",
                         src[m.end():], re.M | re.S)
        if note:
            body = re.sub(r"\s+", " ", note.group(1)).replace('"', "").strip()
            out[num] = body
    return out


NOTES = load_notes()

CRIT = {
    1: ("Clarity", "one sentence, one promise, and the prototype named up front"),
    2: ("Depth of problem understanding", "the mechanism — fear, urgency and secrecy arriving together — not the fact that scams exist"),
    3: ("Depth of problem understanding", "knowing exactly why each existing control misses this case"),
    4: ("Solution strength", "four moments of one continuous defence, two of which need no handset at all"),
    5: ("Solution strength & differentiation", "the intervention itself, and the restraint inside it"),
    6: ("AI application & technical rationale", "semantic signals over a word list, and why they must run on the handset"),
    7: ("Differentiation & feasibility", "the capabilities only an operator holds, and the constraints we designed around"),
    8: ("Impact & scalability", "societal impact first, and the one metric we would defend in the room"),
    9: ("Feasibility & scalability", "a 90-day plan narrow enough to finish, and a specific ask"),
    10: ("Clarity", "the claim and the proof are the same page, and the judges can open it"),
}

ASKED = {
    1: "Q&A 11 — isn't this a feature? The loop is the product, not the screen.",
    2: "Q&A 13 — Google and Samsung already do this: they need the right handset and a supported language.",
    3: "Q&A 6 — can you really inject before the ring? An operator capability, with an honest weaker fallback.",
    4: "Q&A 5 — what does the model see? Nothing is stored; opt out of call listening and two layers still work.",
    5: "Q&A 2 — false positives: three gates, and warn-never-block means a wrong answer costs one screen.",
    6: "Q&A 3 — a scoring function, not a neural net: the contract is the design work, the corpus is the ask.",
    7: "Q&A 7 — Android can't read USSD, so we don't claim it: AccessibilityService, or operator-side gating.",
    8: "Q&A 9 — what breaks at 100,000 users: reputation staleness, and trust in the alert.",
    9: "Q&A 16 — what would make us stop: if four weeks of real speech can't hold the false-positive rate, the pause is dropped and the network layer ships alone.",
    10: "Q&A 1 and 3b — why on-device, and is the pause a cloud call? The offline engine is what ships first.",
}


def add_note(slide, num, extra=""):
    what, why = CRIT[num]
    notes(slide, (NOTES.get(num, "") + (" " + extra if extra else "")).strip(), f"{what} — {why}", ASKED[num])


# ── the deck ─────────────────────────────────────────────────

prs = Presentation()
prs.slide_width = Emu(int(W * 914400))
prs.slide_height = Emu(int(H * 914400))
prs.core_properties.title = "Shotorko (সতর্ক) — GP FutureMakers 2026 Concept Pitch"
prs.core_properties.author = "Shotorko"
prs.core_properties.comments = (
    "Every screenshot is captured from the deployed prototype at https://abukawser.xyz. "
    "Speaker notes carry the timing, the criterion each slide scores and the Q&A answer to reach for."
)

# 1 ─────────────────────────────────────────────────────────── Title
s = prs.slides.add_slide(prs.slide_layouts[6])
s.background.fill.solid()
s.background.fill.fore_color.rgb = BG
ar = aspect("home")
ph = 6.2
pw = ph * ar
px = MR - pw
rect(s, px - 0.3, 0.6, pw + 0.6, ph + 0.4, fill=None, line=LINE, radius=0.08)
pic(s, "home", px, 0.75, h=ph)
lw = px - 0.7 - ML
text(s, ML, 1.15, lw, 4.4, [
    {"runs": [("সতর্ক", dict(size=72, color=AMBER, bold=True, bn=True))], "sa": 4},
    {"runs": [("Shotorko", dict(size=28, color=TEXT, bold=True))], "sa": 22},
    {"runs": [("The 90 seconds when a phone scam", dict(size=25, color=TEXT, bold=True))], "line": 1.1},
    {"runs": [("is actually winnable.", dict(size=25, color=AMBER, bold=True))], "line": 1.1, "sa": 16},
    {"runs": [("AI that warns a grandmother in Bangla, on any phone — before she sends the money.",
               dict(size=15, color=MUTED))], "line": 1.3},
])
text(s, ML, 5.95, lw, 0.9, [
    {"runs": [("GP FutureMakers 2026 · Concept Pitch Round · 17 October 2026", dict(size=12.5, color=TEXT))], "sa": 5},
    {"runs": [("A working prototype is inside this deck — live at abukawser.xyz", dict(size=12.5, color=CALM, bold=True))]},
])
add_note(s, 1)

# 2 ─────────────────────────────────────────────────────────── The problem
s = slide_shell(prs, "THE PROBLEM", 2)
title(s, [("It is not ignorance. It is ", dict(size=28, color=TEXT, bold=True)),
          ("timing.", dict(size=28, color=AMBER, bold=True))])
colw = 6.5
rect(s, ML, 2.32, colw, 1.92, fill=SURF, radius=0.08)
rect(s, ML, 2.32, 0.07, 1.92, fill=ALERT)
text(s, ML + 0.32, 2.5, colw - 0.6, 1.6, [
    {"runs": [("“আমি থানার ওসি। আপনার ছেলেকে ইয়াবাসহ ধরা হয়েছে। এখনই ৩০,০০০ টাকা পাঠান। কাউকে বলবেন না।”",
               dict(size=18, color=TEXT, bn=True))], "line": 1.35, "sa": 10},
    {"runs": [("“I am the officer in charge. Your son was caught with yaba. Send 30,000 taka now. Tell no one.”",
               dict(size=12, color=MUTED, italic=True))], "line": 1.2},
])
text(s, ML, 4.52, colw, 2.1, [
    {"runs": [("WHY THE SCRIPT WORKS", dict(size=10.5, color=MUTED, bold=True))], "sa": 11},
    {"runs": [("—  ", dict(size=14, color=ALERT)), ("Fear arrives before verification is possible.", dict(size=14, color=TEXT))], "sa": 11},
    {"runs": [("—  ", dict(size=14, color=ALERT)), ("Silence is demanded, so nobody can correct them.", dict(size=14, color=TEXT))], "sa": 11},
    {"runs": [("—  ", dict(size=14, color=ALERT)), ("Cash moves through an agent shop or USSD in under five minutes.", dict(size=14, color=TEXT))], "sa": 11},
    {"runs": [("—  ", dict(size=14, color=ALERT)), ("By the time the family hears about it, the number is dead.", dict(size=14, color=TEXT))]},
])
tx = 7.75
tw = MR - tx
kicker(s, tx, 2.32, "THE SAME CALL, SECOND BY SECOND", tw)
rect(s, tx + 0.09, 2.78, 0.022, 3.0, fill=LINE)
for i, (t, lab, col) in enumerate([
    ("0:00", "“Your son has been arrested.”", ALERT),
    ("0:20", "“Tell no one or the case grows.”", ALERT),
    ("3:00", "The money leaves.", AMBER),
    ("+2 days", "The number is gone. The script is not.", MUTED),
]):
    cy = 2.86 + i * 0.86
    rect(s, tx, cy, 0.2, 0.2, fill=col, pill=True)
    text(s, tx + 0.42, cy - 0.1, tw - 0.42, 0.75, [
        {"runs": [(t, dict(size=12.5, color=col, bold=True))], "sa": 1},
        {"runs": [(lab, dict(size=13, color=TEXT))], "line": 1.1},
    ])
text(s, tx, 6.28, tw, 0.72, [{"runs": [
    ("Who absorbs it: ", dict(size=12.5, color=AMBER, bold=True)),
    ("older parents in district towns, and every dialect no product was built for.",
     dict(size=12.5, color=TEXT))], "line": 1.25}])
add_note(s, 2)

# 3 ─────────────────────────────────────────────────────────── Why defences lose
s = slide_shell(prs, "DEPTH OF PROBLEM UNDERSTANDING", 3)
title(s, [("Every existing control has a reason it misses this case.", dict(size=27, color=TEXT, bold=True))])
y = rows_table(s, ML, 2.35, CW, [
    ("Carrier spam filters", "Built for nuisance volume, not for one persuasive human voice"),
    ("Number blocklists", "A fresh SIM costs Tk 200 — the script survives, the number doesn't"),
    ("Bank and MFS fraud rules", "They see the transfer, never the call that caused it"),
    ("Awareness campaigns", "They teach a phrase list; scammers reword faster than campaigns print"),
    ("Smartphone security apps", "Useless on the Tk 800 button phone that is most at risk"),
], 3.35, size=14, row_h=0.56, gap=0.1)
rect(s, ML, y + 0.24, CW, 0.95, fill=SURF2, radius=0.1)
text(s, ML + 0.3, y + 0.24, CW - 0.6, 0.95, [{"runs": [
    ("The gap:  ", dict(size=17, color=AMBER, bold=True)),
    ("nobody intervenes ", dict(size=17, color=TEXT)),
    ("between the call and the money", dict(size=17, color=TEXT, bold=True)),
    (" — in Bangla, on the phone the victim actually owns.", dict(size=17, color=TEXT))]}], anchor="m")
add_note(s, 3)

# 4 ─────────────────────────────────────────────────────────── What Shotorko does
s = slide_shell(prs, "THE SOLUTION", 4)
title(s, [("Four moments, one continuous defence.", dict(size=27, color=TEXT, bold=True))])
gap = 0.24
cwid = (CW - 3 * gap) / 4
cards = [
    ("precall", "১", "কলের আগে", "Before the call",
     "One Bangla sentence plays in the network, before the phone rings. No app, no install."),
    ("during", "২", "কলের ভেতরে", "During the call",
     "On-device listening understands intent. Nothing recorded, nothing uploaded."),
    ("thamun", "৩", "থামুন", "The pause",
     "The moment money or an OTP is about to move: one question, two buttons."),
    ("after", "৪", "রিপোর্ট", "After",
     "A spoken story becomes a complaint that can be filed, and feeds the radar."),
]
top, cardh = 2.24, 3.98
for i, (shot_name, num, bnlab, enlab, body) in enumerate(cards):
    x = ML + i * (cwid + gap)
    rect(s, x, top, cwid, cardh, fill=SURF, radius=0.06)
    text(s, x + 0.18, top + 0.12, cwid - 0.36, 0.3, [{"runs": [
        (num + "  ", dict(size=15, color=AMBER, bold=True, bn=True)),
        (enlab.upper(), dict(size=10, color=MUTED, bold=True))]}])
    ih = 2.05
    iw = ih * aspect(shot_name)
    pic(s, shot_name, x + (cwid - iw) / 2, top + 0.5, h=ih)
    text(s, x + 0.16, top + 2.62, cwid - 0.32, 1.28, [
        {"runs": [(bnlab, dict(size=15, color=TEXT, bold=True, bn=True))], "align": "c", "sa": 4},
        {"runs": [(body, dict(size=10.5, color=MUTED))], "align": "c", "line": 1.18},
    ])
cy = top + cardh + 0.2
extra = [
    ("আপনজন", "family alert, set up by QR in two minutes", CALM),
    ("এজেন্ট সতর্কতা", "the shopkeeper gets a warning and one question to ask", AMBER),
    ("স্ক্যাম রাডার", "reports cluster numbers into the networks behind them", MUTED),
]
ew = (CW - 2 * gap) / 3
for i, (lab, detail, col) in enumerate(extra):
    x = ML + i * (ew + gap)
    rect(s, x, cy, ew, 0.62, fill=SURF2, radius=0.14)
    text(s, x + 0.2, cy, ew - 0.4, 0.62, [{"runs": [
        (lab + "  ", dict(size=13, color=col, bold=True, bn=True)),
        (detail, dict(size=11.5, color=MUTED))], "line": 1.1}], anchor="m")
add_note(s, 4)

# 5 ─────────────────────────────────────────────────────────── থামুন
s = slide_shell(prs, "THE INTERVENTION", 5)
ar = aspect("thamun")
hh = 5.05
ww = hh * ar
px = MR - ww - 0.15
pic(s, "thamun", px, 1.66, h=hh)
text(s, px - 0.2, 1.66 + hh + 0.06, ww + 0.4, 0.24, [{"runs": [
    ("captured live from abukawser.xyz", dict(size=10.5, color=MUTED, italic=True))], "align": "c"}])
lw = px - ML - 0.6
text(s, ML, 1.7, lw, 1.05, [{"runs": [("থামুন", dict(size=58, color=ALERT, bold=True, bn=True))]}])
text(s, ML, 2.82, lw, 1.05, [
    {"runs": [("কেউ কি ফোনে ভয় দেখাচ্ছে বা তাড়াতাড়ি করতে বলছে?", dict(size=19, color=TEXT, bn=True))], "line": 1.28, "sa": 6},
    {"runs": [("Is someone on the phone scaring you, or rushing you?", dict(size=13, color=MUTED, italic=True))]},
])
by = 3.98
for lab, en, col in [
    ("আসল কিনা যাচাই করুন", "calls 999 or the official helpline for them", CALM),
    ("পরিবারকে ফোন দিন", "calls the trusted family member", CALM),
    ("আমি জানি, পাঠিয়ে দিই", "respected — and reported to the radar", MUTED),
]:
    rect(s, ML, by, 5.4, 0.58, fill=SURF, line=col, line_w=1.25, radius=0.18)
    text(s, ML + 0.22, by, 5.0, 0.58, [{"runs": [
        (lab + "   ", dict(size=14, color=TEXT, bold=True, bn=True)),
        (en, dict(size=11, color=col))]}], anchor="m")
    by += 0.68
text(s, ML, by + 0.14, lw, 0.86, [
    {"runs": [("Shotorko never blocks. The user always keeps the last button.",
               dict(size=16, color=AMBER, bold=True))], "line": 1.15, "sa": 6},
    {"runs": [("On a feature phone the same pause is a voice prompt with two keys.",
               dict(size=12.5, color=MUTED))]},
])
add_note(s, 5, "The pause here scored risk 100/100 on the on-device engine, with ভুয়া পুলিশ and মামলা as the two intent labels.")

# 6 ─────────────────────────────────────────────────────────── The AI
s = slide_shell(prs, "AI APPLICATION & TECHNICAL RATIONALE", 6)
title(s, [("The model reads ", dict(size=27, color=TEXT, bold=True)),
          ("intent", dict(size=27, color=AMBER, bold=True)),
          (", not a word list.", dict(size=27, color=TEXT, bold=True))])
lc, lcw = ML, 6.4
kicker(s, lc, 2.24, "EIGHT SIGNALS — MEANINGS, NOT STRINGS", lcw)
y = chip_flow(s, lc, 2.54, lc + lcw, ["authority", "leverage", "urgency", "secrecy",
                                      "credential", "payment", "reward", "install"], AMBER, size=12.5)
kicker(s, lc, y + 0.08, "×  THE SITUATION AROUND THEM", lcw)
y = chip_flow(s, lc, y + 0.38, lc + lcw, ["unknown caller", "call in progress",
                                         "first-time receiver", "unusual amount", "late night"], MUTED, size=11.5)
kicker(s, lc, y + 0.12, "THE SAME WORDS, DIFFERENT RISK", lcw)
ry = y + 0.44
for line_bn, ctx, verdict, col in [
    ("টাকাটা পাঠিয়ে দিও", "saved contact · daytime · familiar amount", "quiet", CALM),
    ("টাকাটা পাঠিয়ে দিও, কাউকে বলো না", "new number · mid-call · first time", "pause", ALERT),
]:
    rect(s, lc, ry, lcw, 0.56, fill=SURF, radius=0.14)
    text(s, lc + 0.2, ry, lcw - 1.4, 0.56, [
        {"runs": [(line_bn, dict(size=13, color=TEXT, bold=True, bn=True))], "sa": 1},
        {"runs": [(ctx, dict(size=10, color=MUTED))]}], anchor="m")
    pill(s, lc + lcw - 1.05, ry + 0.13, 0.86, 0.3, verdict, col)
    ry += 0.64
rc = lc + lcw + 0.45
rcw = MR - rc
kicker(s, rc, 2.24, "WHAT THE MODEL ANSWERS", rcw)
vh = rcw / aspect("verdict")
pic(s, "verdict", rc, 2.54, w=rcw)
text(s, rc, 2.54 + vh + 0.1, rcw, 0.62, [{"runs": [
    ("the free-play console, on a real hosted model call: risk 95/100 against a threshold of 50, "
     "five intent signals named in Bangla.", dict(size=11, color=MUTED))], "line": 1.2}])
text(s, rc, 2.54 + vh + 0.82, rcw, 1.3, [
    {"runs": [("On-device, in Bangla, Banglish and dialect spelling.", dict(size=14, color=TEXT, bold=True))],
     "line": 1.2, "sa": 7},
    {"runs": [("No audio stored, nothing uploaded — and a handset on 2G cannot round-trip to a cloud model "
               "inside the pause window.", dict(size=12.5, color=MUTED))], "line": 1.25},
])
text(s, ML, 6.24, CW, 0.62, [{"runs": [
    ("Measured, not hoped:  ", dict(size=11, color=AMBER, bold=True)),
    ("69 backend checks pass offline · 5 reworded scripts → 4 pauses · 10 ordinary sentences → 0 false pauses, "
     "1 with every hostile flag forced on · the pause needs risk ≥ 50, consent, and an actual ask.",
     dict(size=11, color=MUTED))], "line": 1.2}])
add_note(s, 6, "Any one of those eight signals is normal conversation; the combination is the signature. The hosted model "
               "carries only the generative part — a spoken story into a filed complaint — and never decides the interruption alone.")

# 7 ─────────────────────────────────────────────────────────── Why GP
s = slide_shell(prs, "DIFFERENTIATION · FEASIBILITY", 7)
title(s, [("The moat is the network.", dict(size=27, color=AMBER, bold=True)),
          ("  What an app company cannot do from outside it.", dict(size=17, color=MUTED))])
y = rows_table(s, ML, 2.3, CW, [
    ("Warn before the ring", "Network announcement injection — no handset permission needed"),
    ("Reach a Tk 800 button phone", "It happens in the network, so the device is irrelevant"),
    ("Caller reputation on day one", "GP's own call records: new SIM, fan-out pattern, report history"),
    ("Stop the forwarding scam", "USSD gating on *21 — GP-side, not app-side"),
    ("The agent-shop checkpoint", "Inside the MFS agent app GP already operates"),
    ("Close the loop", "The GP fraud cell already receives these complaints"),
], 3.5, size=13.5, row_h=0.46, gap=0.07)
rect(s, ML, y + 0.22, CW, 0.98, fill=SURF2, radius=0.1)
text(s, ML + 0.28, y + 0.22, CW - 0.56, 0.98, [{"runs": [
    ("What we can't do, designed around:  ", dict(size=12.5, color=AMBER, bold=True)),
    ("Android cannot read USSD responses, so the on-device trigger is an AccessibilityService over the dialer — or, "
     "stronger, operator-side gating. Live-call Bangla recognition on the handset is the hardest piece in this plan, "
     "and it is where the R&D clock starts.", dict(size=12.5, color=TEXT))], "line": 1.25}], anchor="m")
add_note(s, 7)

# 8 ─────────────────────────────────────────────────────────── Impact and scale
s = slide_shell(prs, "IMPACT · SCALABILITY", 8)
title(s, [("What changes if this works.", dict(size=27, color=TEXT, bold=True))], w=8.2)
pill(s, MR - 3.3, 1.66, 3.3, 0.42, "DEMO DATA — prototype simulation", ALERT, size=11.5)
cw3, ch3, g3 = 3.55, 1.16, 0.22
cards = [
    ("62%", "interruption rate", [("796 of 1,284 scam attempts stopped", False)]),
    ("41s", "average pause", [("long enough for a second human to enter", False)]),
    ("31", "false alarms, counted",
     [("a “", False), ("ঠিক ছিল", True), ("” button on every warning", False)]),
    ("168", "family alerts fired", [("and 97 warnings at the agent shop", False)]),
]
for i, (num, lab, sub) in enumerate(cards):
    x = ML + (i % 2) * (cw3 + g3)
    y = 2.3 + (i // 2) * (ch3 + 0.2)
    col = ALERT if i == 2 else AMBER
    rect(s, x, y, cw3, ch3, fill=SURF, radius=0.1)
    text(s, x + 0.22, y + 0.14, cw3 - 0.44, 0.6, [{"runs": [(num, dict(size=30, color=col, bold=True))]}])
    text(s, x + 0.22, y + 0.68, cw3 - 0.44, 0.45, [
        {"runs": [(lab, dict(size=11.5, color=TEXT, bold=True))], "sa": 2},
        {"runs": [(t, dict(size=10.5, color=MUTED, bn=b)) for t, b in sub]},
    ])
text(s, ML, 2.3 + 2 * ch3 + 0.36, 7.4, 0.3, [{"runs": [
    ("of 10,000 protected users · 1,284 scam attempts · 412 pauses fired", dict(size=10.5, color=MUTED))]}])
iy = 2.3 + 2 * ch3 + 0.85
kicker(s, ML, iy, "WHERE THE VALUE LANDS", 7.4)
for j, line in enumerate([
    "Money stays with the person least able to lose it — 30,000 taka is a year, not a number.",
    "Every intervened call becomes a structured report instead of a family argument.",
    "Trust in digital finance is GP's own MFS float, and support cost is the second line.",
]):
    text(s, ML, iy + 0.36 + j * 0.34, 7.5, 0.34, [{"runs": [
        ("—  ", dict(size=12.5, color=AMBER)), (line, dict(size=12.5, color=TEXT))]}])
rhh = 3.7
rww = rhh * aspect("radar")
rx = MR - rww
pic(s, "radar", rx, 2.3, h=rhh)
text(s, rx - 0.2, 2.3 + rhh + 0.12, rww + 0.4, 0.8, [
    {"runs": [("স্ক্যাম রাডার", dict(size=13, color=AMBER, bold=True, bn=True))], "align": "c", "sa": 2},
    {"runs": [("same script, one network: reports cluster numbers into the people behind them",
               dict(size=10.5, color=MUTED))], "align": "c", "line": 1.15}])
add_note(s, 8)

# 9 ─────────────────────────────────────────────────────────── 90 days and the ask
s = slide_shell(prs, "FEASIBILITY · THE ASK", 9)
title(s, [("Ninety days, narrow enough to finish.", dict(size=27, color=TEXT, bold=True))])
pw4 = (CW - 2 * 0.22) / 3
for i, (wk, head, body) in enumerate([
    ("WEEKS 1–4", "Prove it on real language",
     "2,000 consented scam-call recordings from the GP fraud cell. Fine-tune the small Bangla model. Publish a false-positive rate, not just recall."),
    ("WEEKS 5–8", "Network slice, one district",
     "Reputation, the pre-call Bangla announcement, a 999 handoff. Feature-phone path only, so the pilot reaches the people at risk. 5,000 users, opt-in."),
    ("WEEKS 9–12", "Measure, then decide",
     "Interruption rate, money preserved, false-alarm rate, complaint-to-filing conversion. If the classifier can't hold, the network layer ships without it."),
]):
    x = ML + i * (pw4 + 0.22)
    rect(s, x, 2.28, pw4, 2.3, fill=SURF, radius=0.07)
    rect(s, x, 2.28, pw4, 0.06, fill=AMBER)
    text(s, x + 0.22, 2.5, pw4 - 0.44, 2.0, [
        {"runs": [(wk, dict(size=10.5, color=AMBER, bold=True))], "sa": 4},
        {"runs": [(head, dict(size=15.5, color=TEXT, bold=True))], "sa": 8},
        {"runs": [(body, dict(size=11.5, color=MUTED))], "line": 1.22},
    ])
half = (CW - 0.5) / 2
kicker(s, ML, 4.85, "WHAT WE'RE ASKING GP FOR", half)
for j, ask in enumerate([
    "Fraud-call CDR patterns and complaint text, anonymised",
    "A network announcement slot and one USSD gating test",
    "Introductions: the fraud cell, one MFS agent region",
    "A pilot district, and 90 days",
]):
    text(s, ML, 5.22 + j * 0.36, half, 0.34, [{"runs": [
        (f"{j + 1}.  ", dict(size=13, color=AMBER, bold=True)), (ask, dict(size=13, color=TEXT))]}])
rx2 = ML + half + 0.5
kicker(s, rx2, 4.85, "HOW IT SCALES BEYOND GP", half)
for j, step in enumerate([
    "GP-only pilot: reputation, warning, radar",
    "Android adds the on-device pause where handsets allow",
    "Any operator, via a shared report format",
    "999 and BTRC get the clustered network view",
]):
    text(s, rx2, 5.22 + j * 0.36, half, 0.34, [{"runs": [
        ("→  ", dict(size=13, color=CALM, bold=True)), (step, dict(size=13, color=TEXT))]}])
add_note(s, 9)

# 10 ────────────────────────────────────────────────────────── Try it
s = slide_shell(prs, "LIVE PROOF", 10)
text(s, ML, 1.66, 8.6, 0.6, [{"runs": [
    ("সতর্ক থাকুন। পরিবারকে জানান।", dict(size=30, color=AMBER, bold=True, bn=True))]}])
text(s, ML, 2.32, 8.6, 0.35, [{"runs": [
    ("Stay alert. Tell the family.", dict(size=13.5, color=MUTED, italic=True))]}])
qs = 2.45
qx = MR - qs
rect(s, qx - 0.14, 1.62, qs + 0.28, qs + 0.28, fill=TEXT, line=AMBER, line_w=1.5, radius=0.05)
pic(s, None, qx, 1.76, h=qs, path=QR)
text(s, qx - 0.6, 1.62 + qs + 0.34, qs + 1.2, 0.5, [
    {"runs": [("abukawser.xyz", dict(size=17, color=CALM, bold=True))], "align": "c", "sa": 2},
    {"runs": [("no login · no install · works on a phone", dict(size=10.5, color=MUTED))], "align": "c"}])
thumbs = [
    ("aponjon", "আপনজন", "the family circle, set up by QR"),
    ("agent", "এজেন্ট", "the shopkeeper gets one question"),
    ("after", "রিপোর্ট", "spoken story → a filed complaint"),
]
th = 2.3
x = ML
for name, lab, cap in thumbs:
    w = th * aspect(name)
    pic(s, name, x, 2.85, h=th)
    text(s, x - 0.15, 2.85 + th + 0.1, w + 0.4, 0.62, [
        {"runs": [(lab, dict(size=13, color=AMBER, bold=True, bn=True))], "align": "c", "sa": 2},
        {"runs": [(cap, dict(size=10, color=MUTED))], "align": "c", "line": 1.1}])
    x += w + 0.5
bx = x + 0.3
text(s, bx, 2.9, 9.45 - bx, 2.9, [
    {"runs": [("Nine screens, the whole journey.", dict(size=16, color=TEXT, bold=True))], "sa": 8},
    {"runs": [("On the site, press ", dict(size=12.5, color=MUTED)), ("▶ Play the story", dict(size=12.5, color=TEXT, bold=True)),
              (" — it runs end to end in under a minute.", dict(size=12.5, color=MUTED))], "line": 1.22, "sa": 8},
    {"runs": [("Then open ", dict(size=12.5, color=MUTED)), ("নিজে যাচাই", dict(size=12.5, color=TEXT, bold=True, bn=True)),
              (" and type any scam line you were ever sent, in Bangla or Banglish. Two classifiers answer: "
               "the on-device one — no network needed, and what ships first — and a hosted one behind Live agent.",
               dict(size=12.5, color=MUTED))], "line": 1.22},
])
text(s, ML, 6.02, CW, 0.42, [{"runs": [
    ("Nothing in the classifier is a mock — type into it. Number reputations and radar records are demo data, and the page says so on every screen.",
     dict(size=12, color=AMBER))], "line": 1.2}])
text(s, ML, 6.5, CW, 0.3, [{"runs": [
    ("if the venue network cannot resolve the domain: shotorko-ai.vercel.app  ·  no network at all: "
     "shotorko-demo-8604o4z09al.qoder.website (same prototype, on-device engine only)",
     dict(size=9.5, color=MUTED))]}])
add_note(s, 10)

prs.save(str(OUT))
print(f"wrote {OUT.relative_to(ROOT)} · {len(prs.slides._sldIdLst)} slides")
