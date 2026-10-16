#!/usr/bin/env python3
"""
Build pitch/Shotorko-GP-FutureMakers-2026.pptx — 10 projector slides + 3 appendix.

The rule this generator is written to: a slide carries keywords, the speaker note
carries the sentence. Anything that needs a verb to be understood belongs in the notes
pane, not on the screen, because the room reads the slide while somebody else talks.
So the copy here is deliberately thin and the weight of the pitch sits on real captures
of the deployed prototype.

Speaker notes are read from pitch/deck-and-qa.md, which stays the source of truth; each
slide's notes carry the criterion it scores and the Q&A answer to reach for. Every
picture is a real capture — dev/shoot.mjs against https://abukawser.xyz — so the slides
and the QR on slide 10 lead to one page.

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

N_SLIDES = 10
N_APPENDIX = 3


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

BN_LO, BN_HI = "\u0980", "\u09ff"


def runs_of(txt, size, color, bold=False, italic=False):
    """Split one string into Bengali and Latin runs.

    A run carries a single typeface, so mixed copy like "থামুন (pause)" would
    otherwise render its English in the Bengali face. Digits and punctuation stay
    with the run they follow, which is what a reader expects.
    """
    runs, cur, bn = [], "", None
    for ch in txt:
        is_bn = BN_LO <= ch <= BN_HI
        is_lt = ch.isascii() and ch.isalpha()
        if (is_bn or is_lt) and bn is not None and is_bn != bn:
            runs.append((cur, dict(size=size, color=color, bold=bold, italic=italic, bn=bn)))
            cur, bn = "", is_bn
        elif bn is None and (is_bn or is_lt):
            bn = is_bn
        cur += ch
    if cur:
        runs.append((cur, dict(size=size, color=color, bold=bold, italic=italic, bn=bool(bn))))
    return runs


def para(txt, size, color, bold=False, italic=False, align="l", sb=0, sa=0, line=None):
    return {"runs": runs_of(txt, size, color, bold, italic),
            "align": align, "sb": sb, "sa": sa, "line": line}


def dash(txt, size=13.5, color=TEXT, mark="—", mark_col=AMBER, bold=False):
    return {"runs": [(mark + "  ", dict(size=size, color=mark_col, bold=True)),
                     *runs_of(txt, size, color, bold=bold)]}


def text(slide, x, y, w, h, paras, anchor="t", wrap=True):
    """paras: [{runs: [(txt, style_kwargs)], align, sb, sa, line}]"""
    box = slide.shapes.add_textbox(In(x), In(y), In(w), In(h))
    tf = box.text_frame
    tf.word_wrap = wrap
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
    for i, p in enumerate(paras):
        pel = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        pel.alignment = ALIGN[p.get("align", "l")]
        pel.space_before = Pt(p.get("sb", 0))
        pel.space_after = Pt(p.get("sa", 0))
        if p.get("line"):
            pel.line_spacing = p["line"]
        for txt, kw in p["runs"]:
            r = pel.add_run()
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
    pel = tf.paragraphs[0]
    pel.alignment = PP_ALIGN.CENTER
    r = pel.add_run()
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
    text(slide, x, y, w, 0.26, [para(what, 10.5, MUTED, bold=True)])


def slide_shell(prs, tag, page, total=N_SLIDES):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = BG
    text(s, ML, 0.44, 9.0, 0.26, [para(tag, 11.5, AMBER, bold=True)])
    hline(s, ML, 1.5, CW)
    text(s, ML, H - 0.46, 7.0, 0.26, [para("Shotorko · সতর্ক · GP FutureMakers 2026", 9, MUTED)])
    text(s, MR - 1.1, H - 0.46, 1.1, 0.26, [para(f"{page} / {total}", 9, MUTED, align="r")])
    return s


def hline(slide, x, y, w, color=LINE, weight=1.25):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, In(x), In(y), In(w), Pt(weight))
    s.fill.solid()
    s.fill.fore_color.rgb = color
    s.line.fill.background()
    s.shadow.inherit = False
    return s


def title(slide, runs, y=1.66, w=CW, x=ML):
    text(slide, x, y, w, 0.6, [{"runs": runs}])


def stat(slide, x, y, w, h, big, lab, sub="", col=AMBER, big_size=27, lab_size=13):
    """A number and two short lines — the shape this deck argues with."""
    rect(slide, x, y, w, h, fill=SURF, radius=0.08)
    ps = [para(big, big_size, col, bold=True, sa=5), para(lab, lab_size, TEXT, bold=True)]
    if sub:
        ps.append(para(sub, 10.5, MUTED, line=1.18, sb=4))
    text(slide, x + 0.24, y + 0.18, w - 0.48, h - 0.36, ps)


def card(slide, x, y, w, h, head, body, col=AMBER, head_size=14.5, body_size=11.5, top_bar=False):
    rect(slide, x, y, w, h, fill=SURF, radius=0.07)
    if top_bar:
        rect(slide, x, y, w, 0.055, fill=col)
    text(slide, x + 0.22, y + 0.17, w - 0.44, h - 0.34,
         [para(head, head_size, col, bold=True, sa=5), para(body, body_size, MUTED, line=1.22)])


def flow_box(slide, x, y, w, h, tag, head, sub, col=AMBER):
    rect(slide, x, y, w, h, fill=SURF, radius=0.08)
    text(slide, x + 0.2, y, w - 0.4, h,
         [para(tag, 10, MUTED, bold=True, align="c", sa=4),
          para(head, 17, col, bold=True, align="c", sa=4),
          para(sub, 11.5, TEXT, align="c", line=1.18)], anchor="m")


def arrow(slide, x, y, w=0.55, col=MUTED):
    text(slide, x, y, w, 0.4, [{"runs": [("→", dict(size=19, color=col, bold=True))], "align": "c"}],
         anchor="m")


def hbar(slide, x, y, w_lab, w_max, h, frac, col, lab, val, note=""):
    text(slide, x, y, w_lab - 0.12, h, [para(lab, 13, TEXT, bold=True)], anchor="m")
    bx = x + w_lab
    by = y + (h - 0.3) / 2
    rect(slide, bx, by, w_max, 0.3, fill=SURF2, radius=0.5)
    rect(slide, bx, by, max(w_max * frac, 0.34), 0.3, fill=col, radius=0.5)
    text(slide, bx + w_max + 0.16, y, 1.55, h, [para(val, 13.5, col, bold=True)], anchor="m")
    if note:
        text(slide, bx + w_max + 1.7, y, 1.0, h, [para(note, 10.5, MUTED, italic=True)], anchor="m")


def band(slide, y, runs, x=ML, w=CW, h=0.55, fill=SURF2):
    rect(slide, x, y, w, h, fill=fill, radius=0.1)
    text(slide, x + 0.28, y, w - 0.56, h, [{"runs": runs}], anchor="m")


def source(slide, y, txt, x=ML, w=CW, size=9.5, h=0.3):
    text(slide, x, y, w, h, [para(txt, size, MUTED, italic=True)])


def rows_table(slide, x, y, w, rows, col1, size=13.5, row_h=0.52, gap=0.08,
               size_r=None, col_r=TEXT, mark=False):
    """A table made of shapes: a real pptx table inherits PowerPoint's light theme
    borders and fills, which is the wrong surface for a dark deck."""
    size_r = size_r or size
    for i, (a, b) in enumerate(rows):
        ry = y + i * (row_h + gap)
        rect(slide, x, ry, w, row_h, fill=SURF if i % 2 == 0 else SURF2, radius=0.12)
        text(slide, x + 0.2, ry, col1 - 0.3, row_h, [para(a, size, AMBER, bold=True)], anchor="m")
        rw = w - col1 - (0.8 if mark else 0.25)
        text(slide, x + col1, ry, rw, row_h, [para(b, size_r, col_r)], anchor="m")
        if mark:
            text(slide, x + w - 0.66, ry, 0.44, row_h,
                 [{"runs": [("×", dict(size=size + 3, color=ALERT, bold=True))], "align": "c"}], anchor="m")
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
    pat = re.compile(r"^## (?:(Slide (\d+))|(Appendix (A\d))) — .+$", re.M)
    for m in pat.finditer(src):
        key = int(m.group(2)) if m.group(2) else m.group(4)
        note = re.search(r"^\*\*Speaker note(?: \(([^)]*)\))?\*\*\n(.*?)(?=^\*\*|^\n---|\Z)",
                         src[m.end():], re.M | re.S)
        if note:
            body = re.sub(r"\s+", " ", note.group(2)).replace('"', "").strip()
            when = re.sub(r"^\d+s,?\s*", "", (note.group(1) or "").strip())
            out[key] = f"[{when}] {body}" if when else body
    return out


NOTES = load_notes()

CRIT = {
    1: ("Clarity", "the whole promise in three words, and the prototype named on the first screen"),
    2: ("Depth of problem understanding", "the mechanism of the scam — fear, urgency and silence arriving together — not the fact that scams exist"),
    3: ("Depth of problem understanding & differentiation", "knowing exactly why each existing control misses this case"),
    4: ("Impact & market understanding", "the measured size of the money that moves digitally, from primary sources"),
    5: ("Solution strength", "four moments of one continuous defence, two of which need no handset at all"),
    6: ("Solution strength & clarity", "the intervention itself, and the restraint inside it"),
    7: ("AI application & technical rationale", "semantic signals over a word list, and why they must run on the handset"),
    8: ("Feasibility, scalability & business sense", "who pays, what they pay for, and evidence that people pay for this"),
    9: ("Market analysis & scalability", "sizing a judge can redo on a napkin, and a go-to-market that is sequenced"),
    10: ("Clarity & impact", "the claim, the ask and the proof are all on one page the judges can open"),
    "A1": ("Credibility", "every number traces to a named publication and date, and the gaps are stated out loud"),
    "A2": ("Feasibility & business sense", "the sensitivity of the revenue case, and the cost structure behind the margin"),
    "A3": ("Q&A handling", "the market questions taken in advance, answered in one line each"),
}

ASKED = {
    1: "Q&A 11 — isn't this a feature? The loop is the product, not the screen.",
    2: "Q&A 13 — Google and Samsung already do this: they need the right handset and a supported language.",
    3: "Q&A 6 — can you really inject before the ring? An operator capability, with an honest weaker fallback.",
    4: "Q&A 14 — how big is this really: Appendix A1 for the denominators, A2 for the attach-rate ladder.",
    5: "Q&A 5 — what does the model see? Nothing is stored; opt out of call listening and two layers still work.",
    6: "Q&A 2 — false positives: three gates, and warn-never-block means a wrong answer costs one screen.",
    7: "Q&A 3 — a scoring function, not a neural net: the contract is the design work, the corpus is the ask.",
    8: "Q&A 15 — will anyone pay for safety: Truecaller's measured 0.75% conversion, and Verizon's price point.",
    9: "Q&A 18 and 19 — the growth path past Grameenphone, and the national fraud-loss figure we refuse to invent.",
    10: "Q&A 23 — what would make us stop: if four weeks of real speech can't hold the false-positive rate, the pause is dropped and the network layer ships alone.",
    "A1": "Any number a judge challenges — name the publication, the month, and what is calculated rather than published.",
    "A2": "Q&A 8, 16 and 17 — cost to serve, the price point, and why the on-device engine is a margin argument as well as a coverage one.",
    "A3": "This slide is the Q&A sheet itself; the full bank is in pitch/deck-and-qa.md.",
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
    "10 projector slides + 3 appendix. Screenshots from the live prototype at abukawser.xyz. "
    "Market figures trace to Bangladesh Bank, BTRC, Truecaller, Verizon and the US FTC "
    "(Appendix A1). Speaker notes carry timing, criterion and Q&A pointers."
)

# 1 ─────────────────────────────────────────────────────────── Title
s = prs.slides.add_slide(prs.slide_layouts[6])
s.background.fill.solid()
s.background.fill.fore_color.rgb = BG
ph = 5.9
pw = ph * aspect("home")
px = MR - pw
rect(s, px - 0.26, 0.62, pw + 0.52, ph + 0.34, fill=None, line=LINE, radius=0.07)
pic(s, "home", px, 0.78, h=ph)
lw = px - ML - 0.62
text(s, ML, 1.05, lw, 4.9, [
    {"runs": [("সতর্ক", dict(size=74, color=AMBER, bold=True, bn=True))], "sa": 4},
    {"runs": [("Shotorko", dict(size=27, color=TEXT, bold=True))], "sa": 30},
    {"runs": [("Stop the scam.", dict(size=33, color=TEXT, bold=True))], "line": 1.08},
    {"runs": [("Not the call.", dict(size=33, color=AMBER, bold=True))], "line": 1.08, "sa": 22},
    {"runs": [("Bangla-first voice safety  ·  any phone  ·  no app store",
               dict(size=15, color=MUTED))], "line": 1.25},
])
text(s, ML, 5.86, lw, 0.8, [
    para("GP FutureMakers 2026 · Concept Pitch Round", 12.5, TEXT, sa=6),
    para("Live prototype · abukawser.xyz", 13, CALM, bold=True),
])
add_note(s, 1)

# 2 ─────────────────────────────────────────────────────────── The problem
s = slide_shell(prs, "THE PROBLEM", 2)
title(s, [("ভয় · তাড়া · একা", dict(size=34, color=ALERT, bold=True, bn=True))])
text(s, ML, 2.26, CW, 0.3, [para("Fear. Urgency. Secrecy.", 14, MUTED, italic=True)])
qw = 6.1
rect(s, ML, 2.95, 0.07, 1.95, fill=ALERT)
rect(s, ML + 0.07, 2.95, qw - 0.07, 1.95, fill=SURF, radius=0.06)
text(s, ML + 0.36, 3.16, qw - 0.68, 1.6, [
    para("আমি থানার ওসি। আপনার ছেলেকে ধরা হয়েছে। এখনই ৩০,০০০ টাকা পাঠান। কাউকে বলবেন না।",
         17, TEXT, line=1.32, sa=10),
    para("Fake police. Son arrested. Send the money now. Tell no one.", 11.5, MUTED, italic=True),
])
text(s, ML, 5.14, qw, 0.55, [
    para("Who absorbs it:", 13.5, AMBER, bold=True, sa=4),
    para("older parents in district towns, on the phone they already own", 13.5, TEXT, line=1.2),
])
tx = 7.3
kicker(s, tx, 2.95, "ONE CALL", MR - tx)
rect(s, tx + 0.07, 3.3, 0.022, 2.75, fill=LINE)
for i, (t, bn_lab, en, col) in enumerate([
    ("0:00", "ভয়", "fear", ALERT),
    ("0:20", "তাড়া", "rush", ALERT),
    ("1:10", "একা", "alone", ALERT),
    ("3:00", "টাকা পাঠানো", "money leaves", AMBER),
    ("+2 দিন", "নাম্বার বন্ধ", "number dead", MUTED),
]):
    cy = 3.3 + i * 0.56
    rect(s, tx, cy + 0.11, 0.16, 0.16, fill=col, pill=True)
    text(s, tx + 0.4, cy, MR - tx - 0.4, 0.54, [
        {"runs": [(t, dict(size=11.5, color=col, bold=True))], "sa": 1},
        {"runs": runs_of(bn_lab + "   ", 18, TEXT, bold=True)
                + [(en, dict(size=11.5, color=MUTED, italic=True))]},
    ])
band(s, 6.3, [("The gap:  ", dict(size=17, color=AMBER, bold=True)),
              ("nobody defends those three minutes", dict(size=17, color=TEXT))])
add_note(s, 2)

# 3 ─────────────────────────────────────────────────────────── Why controls miss
s = slide_shell(prs, "PROBLEM DEPTH · COMPETITION", 3)
title(s, [("Every defence answers a different crime.", dict(size=27, color=TEXT, bold=True))])
y = rows_table(s, ML, 2.42, CW, [
    ("Carrier spam filters", "built for volume, not for one persuasive voice"),
    ("Number blocklists", "a fresh SIM costs Tk 200"),
    ("Bank and MFS rules", "they see the transfer, never the call"),
    ("Awareness campaigns", "the script rewords faster than the poster prints"),
    ("Smartphone security apps", "the target phone is a Tk 800 button phone"),
], 3.5, size=14.5, row_h=0.62, gap=0.14, size_r=14, mark=True)
band(s, 6.32, [("Missing:  ", dict(size=18, color=AMBER, bold=True)),
               ("a defender inside the call, in Bangla", dict(size=18, color=TEXT, bold=True))])
add_note(s, 3)

# 4 ─────────────────────────────────────────────────────────── Money at risk
s = slide_shell(prs, "THE MARKET THE MONEY IS IN", 4)
title(s, [("The money is already digital.", dict(size=27, color=TEXT, bold=True))])
kicker(s, ML, 2.3, "MOBILE FINANCIAL SERVICES — BANGLADESH BANK, JULY 2026  ·  SUBSCRIBERS — BTRC, AUGUST 2026")
cw5, ch5, g5 = (CW - 4 * 0.2) / 5, 1.42, 0.2
for i, (big, lab, sub, col, bsize) in enumerate([
    ("Tk 2.17T", "MFS volume", "", ALERT, 27),
    ("Tk 182.7B", "e-money float", "", ALERT, 24),
    ("258.7M", "MFS accounts", "", AMBER, 27),
    ("191.09M", "mobile SIMs", "", AMBER, 27),
    ("87.20M", "Grameenphone", "45.6% share", CALM, 27),
]):
    stat(s, ML + i * (cw5 + g5), 2.6, cw5, ch5, big, lab, sub, col=col, big_size=bsize)
pich = 1.9
piw = pich * aspect("precall")
pic(s, "precall", ML, 4.16, h=pich)
text(s, ML - 0.2, 6.1, piw + 0.6, 0.26, [para("this phone too", 10, MUTED, italic=True, align="c")])
lx = ML + piw + 0.66
kicker(s, lx, 4.16, "WHY THAT MATTERS FOR GP", MR - lx)
for j, (line, bold) in enumerate([
    ("1.03 billion MFS transactions in one month", False),
    ("130.2M MFS accounts are rural", False),
    ("68M subscribers are still outside 4G — so the defence cannot live in the cloud", True),
]):
    text(s, lx, 4.48 + j * 0.5, MR - lx, 0.5, [dash(line, 14.5, TEXT, bold=bold)])
source(s, 6.14, "Bangladesh Bank MFS statistics (July 2026) · BTRC mobile subscribers (August 2026) · "
                "links and what is calculated: Appendix A1", x=lx, w=MR - lx)
band(s, 6.45, [("The buyer is not the victim:  ", dict(size=14.5, color=AMBER, bold=True)),
               ("a parent loses the money, Grameenphone loses the trust", dict(size=14.5, color=TEXT))],
     h=0.5)
add_note(s, 4)

# 5 ─────────────────────────────────────────────────────────── Four moments
s = slide_shell(prs, "THE SOLUTION", 5)
title(s, [("Four moments. One defence.", dict(size=27, color=TEXT, bold=True))], w=8.2)
pill(s, MR - 3.6, 1.68, 3.6, 0.42, "captured from the live prototype", CALM, size=11)
gap = 0.24
cwid = (CW - 3 * gap) / 4
top, ih = 2.3, 3.2
for i, (shot_name, num, bn_lab, en_lab) in enumerate([
    ("precall", "১", "কলের আগে", "before the call"),
    ("during", "২", "কলের ভেতরে", "during the call"),
    ("thamun", "৩", "থামুন", "the pause"),
    ("after", "৪", "রিপোর্ট", "after"),
]):
    x = ML + i * (cwid + gap)
    iw = ih * aspect(shot_name)
    pic(s, shot_name, x + (cwid - iw) / 2, top, h=ih)
    text(s, x, top + ih + 0.14, cwid, 0.75, [
        {"runs": [(num + "  ", dict(size=14, color=AMBER, bold=True, bn=True)),
                  *runs_of(bn_lab, 17, TEXT, bold=True)], "align": "c", "sa": 4},
        para(en_lab, 12, MUTED, align="c"),
    ])
band(s, 6.32, [("Two of the four need no smartphone at all.", dict(size=16, color=AMBER, bold=True)),
               ("  They happen in the network.", dict(size=15, color=MUTED))], h=0.52)
add_note(s, 5)

# 6 ─────────────────────────────────────────────────────────── থামুন
s = slide_shell(prs, "THE INTERVENTION", 6)
hh = 4.9
ww = hh * aspect("thamun")
px = MR - ww
pic(s, "thamun", px, 1.72, h=hh)
text(s, px - 0.3, 6.66, ww + 0.6, 0.26,
     [para("live capture · risk 100/100", 10.5, MUTED, italic=True, align="c")])
lw = px - ML - 0.6
text(s, ML, 1.62, lw, 1.0, [{"runs": [("থামুন", dict(size=58, color=ALERT, bold=True, bn=True))]}])
text(s, ML, 2.74, lw, 0.34, [para("One question. Three buttons.", 15, MUTED)])
by = 3.36
for bn_lab, en, col in [
    ("যাচাই করুন", "we dial the verification number for you", CALM),
    ("পরিবারকে ফোন", "the family you already saved, one tap", CALM),
    ("আমি জানি", "the user decides — and it is still reported", MUTED),
]:
    rect(s, ML, by, 6.3, 0.62, fill=SURF, line=col, line_w=1.25, radius=0.16)
    text(s, ML + 0.26, by, 2.4, 0.62, [{"runs": runs_of(bn_lab, 17, TEXT, bold=True)}], anchor="m")
    text(s, ML + 2.78, by, 3.4, 0.62, [para(en, 11.5, col)], anchor="m")
    by += 0.72
text(s, ML, 5.72, lw, 0.6, [{"runs": [("Warn. Never block.", dict(size=30, color=AMBER, bold=True))]}])
text(s, ML, 6.36, lw, 0.42, [
    {"runs": [("Wrong:  ", dict(size=15, color=MUTED)), ("one screen.", dict(size=15, color=TEXT, bold=True)),
              ("      Right:  ", dict(size=15, color=MUTED)),
              *runs_of("Tk 30,000.", 15, CALM, bold=True)]},
])
add_note(s, 6, "On the on-device engine this call scored risk 100/100 and was labelled ভুয়া পুলিশ / মামলা.")

# 7 ─────────────────────────────────────────────────────────── The AI
s = slide_shell(prs, "AI APPLICATION & TECHNICAL RATIONALE", 7)
title(s, [("Intent", dict(size=27, color=AMBER, bold=True)),
          (", not a word list.", dict(size=27, color=TEXT, bold=True))])
lc, lcw = ML, 6.15
kicker(s, lc, 2.3, "EIGHT SIGNALS")
y = chip_flow(s, lc, 2.6, lc + lcw, ["authority", "leverage", "urgency", "secrecy",
                                     "credential", "payment", "reward", "install"], AMBER, size=12.5)
kicker(s, lc, y + 0.14, "×  THE SITUATION AROUND THEM")
y = chip_flow(s, lc, y + 0.44, lc + lcw, ["unknown caller", "call in progress",
                                          "first receiver", "unusual amount", "late night"], MUTED, size=11.5)
gy = y + 0.2
rect(s, lc, gy, lcw, 0.78, fill=SURF2, radius=0.09)
text(s, lc + 0.24, gy, lcw - 0.48, 0.78, [
    {"runs": [("risk ≥ 50", dict(size=19, color=AMBER, bold=True)),
              ("   +   ", dict(size=16, color=MUTED)),
              ("an actual ask", dict(size=19, color=AMBER, bold=True)),
              ("   =   ", dict(size=16, color=MUTED)),
              *runs_of("থামুন", 20, ALERT, bold=True)]}], anchor="m")
text(s, lc, gy + 0.94, lcw, 0.8, [
    para("One signal is normal conversation.", 15, TEXT, bold=True, sa=5),
    para("A mother asking for money is not a scam. The combination is.", 12.5, MUTED, line=1.2),
])
rc = lc + lcw + 0.45
rcw = MR - rc
kicker(s, rc, 2.3, "THE SAME SENTENCE, JUDGED LIVE", rcw)
vh = rcw / aspect("verdict")
pic(s, "verdict", rc, 2.6, w=rcw)
text(s, rc, 2.6 + vh + 0.1, rcw, 0.52, [
    para("A hosted model call from the free-play console: risk 95/100, five signals named in Bangla.",
         11, MUTED, line=1.2)])
my = 2.6 + vh + 0.72
for big, lab, col in [("0 of 10", "ordinary sentences paused", CALM),
                      ("4 of 5", "reworded scam scripts paused", AMBER),
                      ("69", "backend checks pass offline", CALM)]:
    text(s, rc, my, 1.5, 0.34, [{"runs": [(big, dict(size=16, color=col, bold=True))]}])
    text(s, rc + 1.55, my, rcw - 1.55, 0.34, [para(lab, 12.5, TEXT)])
    my += 0.4
text(s, rc, my + 0.14, rcw, 0.5, [
    para("On the handset. No cloud call, no per-call bill.", 14, AMBER, bold=True, line=1.2)])
add_note(s, 7, "Any one of those eight signals is normal conversation; the combination is the signature. The hosted "
               "model carries only the generative part — a spoken story into a filed complaint — and never decides "
               "the interruption alone.")

# 8 ─────────────────────────────────────────────────────────── Business model
s = slide_shell(prs, "BUSINESS MODEL", 8)
title(s, [("Who pays, and why they keep paying.", dict(size=27, color=TEXT, bold=True))])
bw, bh, ag = 3.4, 1.22, 0.55
for i, (tag, head, sub, col) in enumerate([
    ("WHO PAYS", "Subscriber", "Tk 20 a month · opt-in", CALM),
    ("WHO BILLS", "Grameenphone", "on the phone bill, as a pack", AMBER),
    ("WHO BUILDS", "Shotorko", "model · engine · report standard", TEXT),
]):
    x = ML + i * (bw + ag)
    flow_box(s, x, 2.3, bw, bh, tag, head, sub, col=col)
    if i < 2:
        arrow(s, x + bw, 2.71, w=ag)
cw3 = (CW - 2 * 0.24) / 3
for i, (head, body, col) in enumerate([
    ("Revenue", "Tk 20 × 1% of GP's 87.20M base = Tk 209M in year one", AMBER),
    ("Cost avoided", "fraud refunds · hotline minutes · churn after a publicised loss", CALM),
    ("Later", "scam-network intelligence, licensed to MFS operators, 999 and BTRC", MUTED),
]):
    card(s, ML + i * (cw3 + 0.24), 3.78, cw3, 1.42, head, body, col=col, top_bar=True)
kicker(s, ML, 5.44, "PROOF THAT PEOPLE PAY FOR THIS")
text(s, ML, 5.76, CW, 0.32, [dash("Truecaller: 4M+ paying subscribers, 0.75% of free users convert (Mar 2026)",
                                  13.5, TEXT)])
text(s, ML, 6.1, CW, 0.32, [dash("Verizon Call Filter Plus: USD 3.99 a month — and it only blocks numbers",
                                 13.5, TEXT)])
band(s, 6.5, [("Margin:  ", dict(size=14, color=AMBER, bold=True)),
              ("the classifier runs on the handset, so a warning is not a cloud bill",
               dict(size=14, color=TEXT))], h=0.48)
add_note(s, 8)

# 9 ─────────────────────────────────────────────────────────── Market size & strategy
s = slide_shell(prs, "MARKET SIZE · GO-TO-MARKET", 9)
title(s, [("TAM · SAM · SOM", dict(size=29, color=AMBER, bold=True))])
c9 = (CW - 2 * 0.24) / 3
for i, (big, lab, sub, col) in enumerate([
    ("Tk 45.9B", "TAM · every mobile subscriber", "191.09M × Tk 20 × 12 · calculated", MUTED),
    ("Tk 20.9B", "SAM · Grameenphone's base", "87.20M × Tk 20 × 12 · calculated", AMBER),
    ("Tk 209M", "SOM · year one", "1% attach · Truecaller converts 0.75%", CALM),
]):
    stat(s, ML + i * (c9 + 0.24), 2.3, c9, 1.5, big, lab, sub, col=col)
kicker(s, ML, 4.1, "GO-TO-MARKET")
for i, (head, body) in enumerate([
    ("Phase 1 · 0–6 months", "one district · 5,000 opt-in · GP fraud-cell audio · the network warning first"),
    ("Phase 2 · 6–18 months", "nationwide add-on pack · MFS agent shops · 999 and fraud-cell handoff"),
    ("Phase 3 · 18 months +", "a shared report standard · other operators · licensed to MFS and BTRC"),
]):
    card(s, ML + i * (c9 + 0.24), 4.42, c9, 1.34, head, body, col=AMBER, head_size=14)
source(s, 5.96, "Denominators: BTRC subscribers (Aug 2026), Bangladesh Bank MFS (Jul 2026). The Tk 20 price "
                "and the 1% attach rate are our assumptions, not a surveyed willingness to pay.", h=0.42)
band(s, 6.36, [("Entry wedge:  ", dict(size=14, color=AMBER, bold=True)),
               ("the pre-call network warning reaches every handset GP already serves — no install, no upgrade",
                dict(size=14, color=TEXT))], h=0.5)
add_note(s, 9)

# 10 ────────────────────────────────────────────────────────── Impact, ask, proof
s = slide_shell(prs, "IMPACT · THE ASK · LIVE PROOF", 10)
text(s, ML, 1.62, 9.0, 0.7, [{"runs": [("সতর্ক থাকুন।", dict(size=40, color=AMBER, bold=True, bn=True))]}])
text(s, ML, 2.32, 9.0, 0.28, [para("Stay alert. Tell the family.", 13, MUTED, italic=True)])
kicker(s, ML, 2.78, "WHAT CHANGES IF THIS WORKS")
for j, line in enumerate([
    "Tk 30,000 stays with the person least able to lose it",
    "one filed report instead of one family argument",
    "trust in digital money stays with Grameenphone",
]):
    text(s, ML, 3.08 + j * 0.38, 8.9, 0.36, [dash(line, 13.5, TEXT, mark_col=AMBER)])
kicker(s, ML, 4.4, "WHAT WE ASK GP FOR")
for j, ask in enumerate([
    "fraud-call audio and CDR patterns, anonymised",
    "one network announcement slot",
    "one USSD gating test on *21",
    "one pilot district · 90 days",
]):
    text(s, ML, 4.7 + j * 0.36, 8.9, 0.34, [dash(ask, 13.5, TEXT, mark=f"{j + 1}.", mark_col=CALM)])
qs = 2.7
qx = MR - qs
rect(s, qx - 0.13, 1.66, qs + 0.26, qs + 0.26, fill=TEXT, line=AMBER, line_w=1.5, radius=0.05)
pic(s, None, qx, 1.8, h=qs, path=QR)
text(s, qx - 0.6, 4.72, qs + 1.2, 0.5, [
    para("abukawser.xyz", 17, CALM, bold=True, align="c", sa=3),
    para("no login · no install · works on a phone", 10.5, MUTED, align="c"),
])
text(s, ML, 6.28, CW, 0.62, [
    {"runs": [("On the site:  ", dict(size=12, color=MUTED)),
              ("Play the story", dict(size=12, color=TEXT, bold=True)),
              ("  runs the whole intervention in under a minute;  ", dict(size=12, color=MUTED)),
              *runs_of("নিজে যাচাই takes a scam line you were actually sent.", 12, MUTED)], "line": 1.25, "sa": 4},
    para("Reputations and radar records are demo data, and the page says so on every screen.", 11, AMBER),
])
add_note(s, 10)

# ── appendix ────────────────────────────────────────────────

# A1 ───────────────────────────────────────────────────────── Sources
s = slide_shell(prs, "APPENDIX · SOURCES", "A1", total="A3")
title(s, [("Every number, and where it came from.", dict(size=26, color=TEXT, bold=True))])
rows_table(s, ML, 2.3, CW, [
    ("Tk 2.17T · Tk 182.7B · 258.7M",
     "Bangladesh Bank, MFS statistics: transactions table 9, accounts table 8, July 2026 — "
     "bb.org.bd/econdata/fin_digitalfstat"),
    ("191.09M · 87.20M",
     "BTRC, mobile subscribers by operator, August 2026 — "
     "btrc.gov.bd/pages/static-pages/6922dda8933eb65569e15c3d"),
    ("122.71M on 4G · 69.18% internet",
     "BTRC, teledensity and penetration, August 2026 — "
     "btrc.gov.bd/pages/static-pages/teledensity-penetration-8ecc0e-6922e009933eb65569e2524c"),
    ("4M+ subscribers · 0.75% conversion",
     "Truecaller AB, 10 March 2026 — "
     "news.cision.com/truecaller-ab/r/truecaller-surpasses-4-million-premium-subscribers,c4318816"),
    ("USD 3.99 a month",
     "Verizon Call Filter Plus — verizon.com/support/call-filter-faqs"),
    ("USD 3.5B lost to imposter scams",
     "US Federal Trade Commission, 15 June 2026 — "
     "ftc.gov/news-events/news/press-releases/2026/06/ftc-data-show-people-reported-losing-3-point-5-billion-imposter-scams-2025"),
    ("Tk 45.9B · 20.9B · 209M",
     "calculated by us from the tables above; the Tk 20 price and 1% attach rate are our own assumptions"),
], 3.7, size=12.5, row_h=0.5, gap=0.07, size_r=9, col_r=MUTED)
band(s, 6.42, [("What we will not claim:  ", dict(size=14, color=AMBER, bold=True)),
               ("there is no published Bangladeshi national fraud-loss figure, and we did not invent one",
                dict(size=14, color=TEXT))], h=0.52)
add_note(s, "A1")

# A2 ───────────────────────────────────────────────────────── Unit economics
s = slide_shell(prs, "APPENDIX · UNIT ECONOMICS", "A2", total="A3")
title(s, [("Sensitivity, and what it costs to serve.", dict(size=26, color=TEXT, bold=True))])
kicker(s, ML, 2.28, "GP BASE OF 87.20M SUBSCRIBERS, AT Tk 20 A MONTH")
for i, (lab, val, frac, col, note) in enumerate([
    ("0.5%", "Tk 105M", 0.5 / 3, MUTED, ""),
    ("1%", "Tk 209M", 1 / 3, AMBER, "base case"),
    ("2%", "Tk 419M", 2 / 3, MUTED, ""),
    ("3%", "Tk 628M", 3 / 3, MUTED, ""),
]):
    hbar(s, ML, 2.62 + i * 0.56, 1.15, 7.6, 0.5, frac, col, lab, val + " / yr", note)
cy2 = 5.05
kicker(s, ML, cy2, "COST TO SERVE")
for j, line in enumerate([
    "the classifier runs on the handset — no inference per call",
    "the cloud is used only to write the complaint letter",
    "no app-store royalty: the product is a network service",
]):
    text(s, ML, cy2 + 0.32 + j * 0.34, 5.95, 0.32, [dash(line, 12, TEXT, mark_col=MUTED)])
rx2 = 6.9
kicker(s, rx2, cy2, "WHY GP WOULD BUY IT", MR - rx2)
for j, line in enumerate([
    "retention: safety is a reason to stay on the network",
    "Tk 182.7B of e-money float depends on trust",
    "fewer fraud tickets in the contact centre",
    "consumer-protection leadership with BTRC",
]):
    text(s, rx2, cy2 + 0.32 + j * 0.34, MR - rx2, 0.32, [dash(line, 12, TEXT, mark_col=CALM)])
add_note(s, "A2")

# A3 ───────────────────────────────────────────────────────── Q&A sheet
s = slide_shell(prs, "APPENDIX · Q&A PREPARATION", "A3", total="A3")
title(s, [("If the three minutes go to the market.", dict(size=26, color=TEXT, bold=True))])
rows_table(s, ML, 2.3, CW, [
    ("How big is it?", "Tk 45.9B TAM · Tk 20.9B on GP's base · calculated"),
    ("Who pays?", "the subscriber, billed by Grameenphone as a Tk 20 pack"),
    ("Will anyone pay?", "Truecaller converts 0.75%; we assume 1% of an opt-in base"),
    ("Why not just an app?", "the phone at risk is a Tk 800 button phone — it needs the network"),
    ("Why Grameenphone?", "warn before the ring, and reputation without a cold start"),
    ("Cost to serve?", "on-device inference: a warning costs no cloud call"),
    ("Past GP?", "a shared report standard, then operators, MFS and BTRC"),
    ("What would stop us?", "if four weeks of real Bangla speech cannot hold the false-positive rate"),
], 3.4, size=13.5, row_h=0.48, gap=0.06, size_r=12.5)
source(s, 6.72, "The full bank of twenty-three questions, with the criterion each one scores, is in "
                "pitch/deck-and-qa.md and in the notes pane of every slide.", h=0.22)
add_note(s, "A3")

prs.save(str(OUT))
print(f"wrote {OUT.relative_to(ROOT)} · {len(prs.slides._sldIdLst)} slides")
