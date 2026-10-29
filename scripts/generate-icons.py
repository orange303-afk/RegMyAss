"""Generate the pixel-art RegMyAss extension icons."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"
SIZE = 32

icon = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

# Upright middle finger, folded surrounding fingers, palm and thumb.
hand = Image.new("L", (SIZE, SIZE), 0)
h = ImageDraw.Draw(hand)
h.rectangle((14, 2, 18, 18), fill=255)
h.rectangle((15, 1, 17, 2), fill=255)
h.rectangle((8, 13, 13, 21), fill=255)
h.rectangle((19, 13, 23, 21), fill=255)
h.rectangle((24, 16, 26, 22), fill=255)
h.rectangle((7, 18, 25, 26), fill=255)
h.rectangle((4, 19, 9, 24), fill=255)
h.rectangle((3, 20, 5, 22), fill=255)
h.rectangle((11, 25, 22, 30), fill=255)

outline = hand.filter(ImageFilter.MaxFilter(3))
icon.paste("#1e1b4b", (0, 0, SIZE, SIZE), outline)
icon.paste("#f6bd8c", (0, 0, SIZE, SIZE), hand)
draw = ImageDraw.Draw(icon)
draw.rectangle((17, 4, 18, 15), fill="#e59b74")
draw.rectangle((21, 16, 23, 19), fill="#e59b74")
draw.rectangle((22, 23, 24, 25), fill="#e59b74")
draw.rectangle((12, 27, 21, 28), fill="#df926c")
draw.rectangle((15, 4, 15, 12), fill="#ffe0ae")
draw.rectangle((8, 20, 8, 23), fill="#ffe0ae")

OUT.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 128):
    icon.resize((size, size), Image.Resampling.NEAREST).save(OUT / f"icon{size}.png")
