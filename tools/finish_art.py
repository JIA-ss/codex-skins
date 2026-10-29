# Turns tools/raw/<id>-{bg,peek,badge}.png into skins/<id>/{background.jpg,peek.png,badge.png}.
# Background: soft radial darkening in the upper middle (where text sits), saved as JPEG.
# Stickers: trimmed to their alpha bounds and scaled down to 512 px.
import pathlib
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "tools" / "raw"
DARKEN = {"aurora": 0.7, "sakura": 0.72, "campfire": 0.75, "neon": 0.7}


def background(theme, strength):
    im = Image.open(RAW / f"{theme}-bg.png").convert("RGB")
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((w * 0.18, -h * 0.35, w * 0.82, h * 0.72), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(h * 0.12)).point(lambda v: int(v * (1 - strength)))
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    im = Image.composite(dark, im, mask)
    im.save(ROOT / "skins" / theme / "background.jpg", quality=84, optimize=True, progressive=True)


def sticker(theme, kind):
    im = Image.open(RAW / f"{theme}-{kind}.png").convert("RGBA")
    im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
    im.thumbnail((512, 512), Image.LANCZOS)
    im.save(ROOT / "skins" / theme / f"{kind}.png", optimize=True)


if __name__ == "__main__":
    for theme, s in DARKEN.items():
        (ROOT / "skins" / theme).mkdir(parents=True, exist_ok=True)
        background(theme, s)
        sticker(theme, "peek")
        sticker(theme, "badge")
        print("ok", theme)
