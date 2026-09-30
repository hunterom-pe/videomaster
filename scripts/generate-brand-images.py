#!/usr/bin/env python3
"""Regenerates the link-preview image, app icon and favicon in the VideoMaster retro style.

Usage:  python3 scripts/generate-brand-images.py      (needs Pillow and a monospace font; uses macOS Menlo)
Writes: src/app/opengraph-image.png, twitter-image.png, apple-icon.png, favicon.ico
"""
from PIL import Image, ImageDraw, ImageFont

BLUE, WHITE, GRAY, DARK, CYAN, YELLOW, BLACK, DIM = "#0000a8", "#e8e8e8", "#c0c0c0", "#404040", "#55ffff", "#ffff55", "#000000", "#b8b8d8"
FONT = "/System/Library/Fonts/Menlo.ttc"  # index 1 = Bold

def font(size, bold=True):
    return ImageFont.truetype(FONT, size, index=1 if bold else 0)

def spaced(d, xy, text, f, fill, spacing=0, anchor="l"):
    """Draw text with letter spacing. anchor 'l' (left) or 'm' (centered on x)."""
    widths = [d.textlength(ch, font=f) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x, y = xy
    if anchor == "m":
        x -= total / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fill)
        x += w + spacing

def bevel_button(d, box, label, f):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=GRAY)
    d.rectangle((x0, y0, x1, y0 + 3), fill="#ffffff"); d.rectangle((x0, y0, x0 + 3, y1), fill="#ffffff")
    d.rectangle((x0, y1 - 3, x1, y1), fill=DARK); d.rectangle((x1 - 3, y0, x1, y1), fill=DARK)
    tw = d.textlength(label, font=f)
    d.text((x0 + 18, (y0 + y1) / 2 - f.size * 0.62), label, font=f, fill=BLACK)

def og_image():
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), BLUE); d = ImageDraw.Draw(im)
    # double-line frame
    d.rectangle((14, 14, W - 15, H - 15), outline=WHITE, width=4)
    d.rectangle((26, 26, W - 27, H - 27), outline=WHITE, width=2)
    # title bar
    d.rectangle((26, 26, W - 27, 82), fill=GRAY)
    spaced(d, (48, 40), "VIDEOMASTER V1.0 — MAIN MENU", font(27), BLACK, 2)
    # heading
    spaced(d, (W / 2, 104), "VIDEOMASTER", font(104), WHITE, 14, "m")
    spaced(d, (W / 2, 232), "VIDEO RENTAL MANAGEMENT SYSTEM", font(33), CYAN, 3, "m")
    spaced(d, (W / 2, 278), "VERSION 1.0  ·  STORE: VIDEO WORLD #0147", font(24, False), DIM, 2, "m")
    d.line((60, 330, W - 60, 330), fill=WHITE, width=3)
    # menu buttons (3 x 3)
    labels = ["[F1] RENT VIDEO", "[F2] RETURN VIDEO", "[F3] CUSTOMERS", "[F4] MOVIE INVENTORY", "[F5] CONCESSIONS",
              "[F7] OVERDUE RENTALS", "[F8] TRANSACTIONS", "[F6] REPORTS", "[F9] STORE SETTINGS"]
    bf = font(25)
    bw, bh, gx, gy, x0, y0 = 340, 52, 30, 14, 60, 350
    for i, lab in enumerate(labels):
        r, c = divmod(i, 3)
        bevel_button(d, (x0 + c * (bw + gx), y0 + r * (bh + gy), x0 + c * (bw + gx) + bw, y0 + r * (bh + gy) + bh), lab, bf)
    # status bar
    d.line((26, 556, W - 27, 556), fill=WHITE, width=2)
    spaced(d, (48, 568), "SYSTEM READY · DATABASE ONLINE", font(22, False), CYAN, 1)
    txt = "VIDEOS OUT: 28   OVERDUE: 5"
    f = font(22, False); tw = d.textlength(txt, font=f) + 1 * (len(txt) - 1)
    spaced(d, (W - 48 - tw, 568), txt, f, YELLOW, 1)
    return im

def icon(size):
    im = Image.new("RGB", (size, size), BLUE); d = ImageDraw.Draw(im)
    b = max(1, size // 24)
    d.rectangle((0, 0, size - 1, size - 1), outline=WHITE, width=b)
    if size >= 48:
        d.rectangle((b * 3, b * 3, size - 1 - b * 3, size - 1 - b * 3), outline=WHITE, width=max(1, b // 2))
    bar = max(3, size // 7)
    d.rectangle((b * 2, b * 2, size - 1 - b * 2, b * 2 + bar), fill=GRAY)
    f = font(int(size * 0.46))
    tw = d.textlength("VM", font=f)
    d.text(((size - tw) / 2, size * 0.36), "VM", font=f, fill=WHITE)
    return im

if __name__ == "__main__":
    og = og_image()
    og.save("src/app/opengraph-image.png", optimize=True)
    og.save("src/app/twitter-image.png", optimize=True)
    # Icons must be RGBA (with an alpha channel): Next.js's image decoder rejects RGB .ico frames.
    icon(180).convert("RGBA").save("src/app/apple-icon.png", optimize=True)
    icon(256).convert("RGBA").save("src/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("ok")
