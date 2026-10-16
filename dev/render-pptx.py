#!/usr/bin/env python3
"""
Render pitch/Shotorko-GP-FutureMakers-2026.pptx to PNGs with PIL and report layout faults.

There is no PowerPoint or LibreOffice on this machine, so the deck cannot be shown the
pixels PowerPoint would actually paint. This is the next best thing: it reads the real
file — shape geometry, run sizes, fills, line spacing, pictures — and redraws it at
128 px/inch with metrically close substitutes (Inter for Segoe UI, Noto Sans Bengali for
Nirmala UI). Text shaping and autofit stay PowerPoint's business, so a clean report is
not proof the deck is finished; a dirty report is proof that it is not.

    python3 dev/render-pptx.py [path.pptx]

Writes .deckcheck/pptx-<n>.png and reports off-slide shapes, text that will not fit its
box, and words too long to break.
"""

import io
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from pptx import Presentation
from pptx.enum.dml import MSO_FILL_TYPE

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "pitch" / "Shotorko-GP-FutureMakers-2026.pptx"
OUT = ROOT / ".deckcheck"
OUT.mkdir(exist_ok=True)

DPI = 128.0
LT_F = {
    (False, False): "/usr/share/fonts/opentype/inter/Inter-Regular.otf",
    (True, False): "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
    (False, True): "/usr/share/fonts/opentype/inter/Inter-Italic.otf",
    (True, True): "/usr/share/fonts/opentype/inter/Inter-BoldItalic.otf",
}
BN_F = {
    False: "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
    True: "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf",
}
_cache = {}

LT_COVER = set(TTFont(LT_F[(False, False)]).getBestCmap()) | set(range(0x80))


def split_script(txt):
    """PowerPoint picks a face per glyph and falls back when the first face has no
    coverage, so one Bengali character inside an English sentence does not retype the
    whole run. A single-font PIL pass has to be told, or it paints every letter the
    fallback font is missing as a dotted box."""
    out = []
    for c in txt:
        bn = not (ord(c) in LT_COVER)
        if out and out[-1][0] == bn:
            out[-1][1] += c
        else:
            out.append([bn, c])
    return out


def font_for(bn, size_pt, bold, italic):
    px_ = max(1, int(round(size_pt * DPI / 72.0)))
    key = ("bn" if bn else "lt", px_, bool(bold) if bn else (bool(bold), bool(italic)))
    if key not in _cache:
        path = BN_F[bool(bold)] if bn else LT_F[(bool(bold), bool(italic))]
        _cache[key] = ImageFont.truetype(path, px_)
    return _cache[key]


def emu_in(v):
    return (v or 0) / 914400.0


def px(v_in):
    return int(round(v_in * DPI))


def rgb(c):
    return (c[0], c[1], c[2]) if c is not None else None


def run_color(run):
    try:
        if run.font.color is not None and run.font.color.type is not None:
            return rgb(run.font.color.rgb)
    except Exception:
        pass
    return (238, 243, 248)


def wrap(runs, width_px):
    """runs [(font, text, colour)] → wrapped lines, plus the longest single word."""
    lines = [[]]
    widest = 0.0
    for fnt, txt, col in runs:
        for piece in re.split(r"(\s+)", txt):
            if not piece:
                continue
            if piece.isspace():
                if lines[-1]:
                    lines[-1].append((fnt, piece, col))
                continue
            w = fnt.getlength(piece)
            widest = max(widest, w)
            used = sum(f.getlength(t) for f, t, _ in lines[-1])
            if used + w > width_px and lines[-1]:
                lines.append([])
            lines[-1].append((fnt, piece, col))
    return [ln for ln in lines if ln], widest


prs = Presentation(str(SRC))
SW, SH = emu_in(prs.slide_width), emu_in(prs.slide_height)
problems = []
checked = 0

for si, slide in enumerate(prs.slides, 1):
    base = (13, 17, 23)
    try:
        fill = slide.background.fill
        if fill is not None and fill.type == MSO_FILL_TYPE.SOLID:
            base = rgb(fill.fore_color.rgb)
    except Exception:
        pass
    img = Image.new("RGB", (px(SW), px(SH)), base)
    d = ImageDraw.Draw(img)
    ink = []          # painted text rectangles, so overlapping copy can be reported

    for sh in slide.shapes:
        x, y = emu_in(sh.left), emu_in(sh.top)
        w, h = emu_in(sh.width), emu_in(sh.height)
        if x < -0.02 or y < -0.02 or x + w > SW + 0.02 or y + h > SH + 0.02:
            problems.append(f"slide {si}: {(sh.name or '')[:20]} off-slide at {x:.2f},{y:.2f} size {w:.2f}×{h:.2f}")

        kind = str(sh.shape_type or "")
        if "PICTURE" in kind:
            try:
                p = Image.open(io.BytesIO(sh.image.blob)).convert("RGBA")
            except Exception:
                p = None
            if p:
                p = p.resize((max(1, px(w)), max(1, px(h))), Image.LANCZOS)
                img.paste(p, (px(x), px(y)), p)
                d = ImageDraw.Draw(img)
            continue

        if "AUTO_SHAPE" in kind:
            fill_c = line_c = None
            line_w = 0
            try:
                if sh.fill.type == MSO_FILL_TYPE.SOLID:
                    fill_c = rgb(sh.fill.fore_color.rgb)
            except Exception:
                pass
            try:
                if sh.line.color is not None and sh.line.color.rgb is not None:
                    line_c = rgb(sh.line.color.rgb)
                    line_w = max(1, int(round(emu_in(sh.line.width) * DPI)))
            except Exception:
                pass
            radius = 0
            try:
                if len(sh.adjustments):
                    radius = int(sh.adjustments[0] * min(px(w), px(h)))
            except Exception:
                pass
            box = [px(x), px(y), px(x + w) - 1, px(y + h) - 1]
            if radius:
                d.rounded_rectangle(box, radius=radius, fill=fill_c, outline=line_c, width=line_w)
            else:
                d.rectangle(box, fill=fill_c, outline=line_c, width=line_w)

        if not sh.has_text_frame:
            continue
        tf = sh.text_frame
        if not tf.text.strip():
            continue
        pad_l = emu_in(tf.margin_left) * DPI
        pad_r = emu_in(tf.margin_right) * DPI
        pad_t = emu_in(tf.margin_top) * DPI
        pad_b = emu_in(tf.margin_bottom) * DPI
        avail = max(1.0, px(w) - pad_l - pad_r)

        laid = []
        for p in tf.paragraphs:
            runs = []
            for r in p.runs:
                if not r.text:
                    continue
                size = r.font.size.pt if r.font.size else 18
                col = run_color(r)
                for bn, chunk in split_script(r.text):
                    runs.append((font_for(bn, size, bool(r.font.bold), bool(r.font.italic)), chunk, col))
            if not runs:
                laid.append((None, 0.0, p))
                continue
            size = max(r[0].size for r in runs)
            mult = p.line_spacing if isinstance(p.line_spacing, float) else 1.0
            lines, widest = wrap(runs, avail)
            lh = size * 1.22 * (mult or 1.0)
            before = (p.space_before.pt if p.space_before else 0) * DPI / 72
            after = (p.space_after.pt if p.space_after else 0) * DPI / 72
            laid.append((lines, lh * max(1, len(lines)) + before + after, p))
            if widest > avail:
                problems.append(f"slide {si}: a word is wider than its box ({widest:.0f}px in {avail:.0f}px) — '{runs[0][1][:32]}'")

        total = sum(hh for _, hh, _ in laid)
        box_h = px(h) - pad_t - pad_b
        if total > box_h + 3:
            problems.append(f"slide {si}: text overruns its box by {(total - box_h) * 72 / DPI:.0f}pt "
                            f"(box {w:.2f}×{h:.2f}in) — '{tf.text[:42].strip()}'")
        max_lw = 0.0
        cy = px(y) + pad_t
        anchor = str(tf.vertical_anchor or "")
        if "MIDDLE" in anchor:
            cy += max(0, (box_h - total) / 2)
        elif "BOTTOM" in anchor:
            cy += max(0, box_h - total)
        start = cy
        for lines, hh, p in laid:
            if lines is None:
                continue
            size = max(f.size for f, _, _ in lines[0])
            mult = p.line_spacing if isinstance(p.line_spacing, float) else 1.0
            lh = size * 1.22 * (mult or 1.0)
            cy += (p.space_before.pt if p.space_before else 0) * DPI / 72
            for line in lines:
                lw = sum(f.getlength(t) for f, t, _ in line)
                max_lw = max(max_lw, lw)
                align = str(p.alignment or "")
                cx = px(x) + pad_l
                if "CENTER" in align:
                    cx += max(0, (avail - lw) / 2)
                elif "RIGHT" in align:
                    cx += max(0, avail - lw)
                for fnt, txt, col in line:
                    d.text((cx, cy), txt, font=fnt, fill=col)
                    cx += fnt.getlength(txt)
                cy += lh
            cy += (p.space_after.pt if p.space_after else 0) * DPI / 72
        ink.append((px(x) + pad_l, start, px(x) + pad_l + max_lw, cy, tf.text[:38].strip()))
        checked += 1

    for i in range(len(ink)):
        for j in range(i + 1, len(ink)):
            ax0, ay0, ax1, ay1, at = ink[i]
            bx0, by0, bx1, by1, bt = ink[j]
            ow = min(ax1, bx1) - max(ax0, bx0)
            oh = min(ay1, by1) - max(ay0, by0)
            if ow > 6 and oh > 6:
                problems.append(f"slide {si}: two text blocks collide by {ow / DPI * 72:.0f}×{oh / DPI * 72:.0f}pt "
                                f"— '{at}' / '{bt}'")

    d.rectangle([0, 0, img.width - 1, img.height - 1], outline=(43, 58, 77), width=2)
    dest = OUT / f"pptx-{si}.png"
    img.save(dest)
    words = sum(len(s.text.split()) for s in slide.shapes if s.has_text_frame)
    print(f"  pptx-{si}.png  {img.width}×{img.height}  {words} words on slide")

print()
if problems:
    print(f"{len(problems)} layout faults")
    for p in problems:
        print("  !", p)
else:
    print(f"clean over {checked} text blocks: nothing off-slide, no box overruns, "
          "no unbreakable words, no colliding copy")
