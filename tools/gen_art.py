# Regenerates the bundled theme art with gpt-image-2 (no reference images: everything is original).
# Usage: python tools/gen_art.py [--only id ...] [--kind bg|peek|badge]
# Needs TEXT_2_IMAGE_BASE_URL / TEXT_2_IMAGE_API_KEY (any OpenAI-compatible Images endpoint).
# Raw outputs go to tools/raw/; tools/finish_art.py turns them into skins/<id>/*.
import argparse, base64, concurrent.futures as cf, os, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
RAW = ROOT / "raw"

BG_STYLE = (
    "Ultra-wide 21:9 desktop wallpaper, painterly digital illustration, soft volumetric light, rich but calm colors. "
    "The CENTER and UPPER-CENTER of the image must be a large, mostly empty, DARK area (it sits behind text), "
    "with the interesting details pushed to the far left, far right and along the bottom horizon. "
    "No text, no logos, no people, no UI."
)
STICKER_STYLE = (
    "Cute chibi die-cut sticker, thick clean white outline around the whole silhouette, flat cel shading with soft highlights, "
    "big expressive eyes, friendly, transparent background, centered, no text, original character design."
)
PEEK = "The character is peeking over a ledge: only head and shoulders visible, both little paws resting on the flat bottom edge of the sticker, the bottom of the sticker is cut perfectly straight. "
BADGE = "Full body, small playful pose, slightly tilted. "

ART = {
    "aurora": {
        "bg": "A frozen lake at night under a sweeping green-teal and violet aurora, snowy pine forests on the far left and right edges, a few tiny glowing cabins on the bottom horizon, stars.",
        "peek": "A small fluffy arctic fox spirit with mint-teal glowing ear tips and a tiny star on its forehead.",
        "badge": "A small fluffy arctic fox spirit with mint-teal glowing ear tips, curled tail, holding a tiny lantern.",
    },
    "sakura": {
        "bg": "A quiet Japanese-inspired night garden, huge cherry blossom trees framing the far left and right edges, petals drifting, a small wooden bridge and lanterns on the bottom horizon, deep indigo sky with a pale moon low on one side.",
        "peek": "A round chubby calico cat with pink cheeks and a single cherry blossom on its ear.",
        "badge": "A round chubby calico cat with pink cheeks hugging a big cherry blossom petal.",
    },
    "campfire": {
        "bg": "A cozy camp at dusk on a hilltop, a glowing campfire and a small tent at the bottom left, rolling hills and distant mountains on the right, warm amber and orange sunset fading into a deep dark sky in the middle, a few early stars.",
        "peek": "A tiny raccoon camper wearing an orange beanie, warm firelight on its face.",
        "badge": "A tiny raccoon camper wearing an orange beanie, roasting a marshmallow on a stick.",
    },
    "neon": {
        "bg": "A rainy cyberpunk-inspired city street at night seen from far away, neon signs without readable text glowing cyan and magenta on buildings at the far left and right, wet reflective road along the bottom, dark rainy sky in the center.",
        "peek": "A small round robot with a screen face showing happy pixel eyes, a little antenna with a cyan light, wearing a tiny yellow raincoat hood.",
        "badge": "A small round robot with a screen face showing happy pixel eyes, holding a tiny transparent umbrella.",
    },
}


def client():
    from openai import OpenAI
    return OpenAI(base_url=os.environ["TEXT_2_IMAGE_BASE_URL"], api_key=os.environ["TEXT_2_IMAGE_API_KEY"])


def job(theme, kind):
    out = RAW / f"{theme}-{kind}.png"
    if kind == "bg":
        prompt, kw = f"{BG_STYLE} Scene: {ART[theme]['bg']}", dict(size="3840x1632", output_format="png")
    else:
        prompt = f"{STICKER_STYLE} {PEEK if kind == 'peek' else BADGE}{ART[theme][kind]}"
        kw = dict(size="1024x1024", background="transparent", output_format="png")
    r = client().images.generate(model="gpt-image-2", prompt=prompt, **kw)
    out.write_bytes(base64.b64decode(r.data[0].b64_json))
    (RAW / f"{theme}-{kind}.prompt.txt").write_text(prompt, encoding="utf8")
    return str(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", default=list(ART))
    ap.add_argument("--kind", nargs="*", default=["bg", "peek", "badge"])
    a = ap.parse_args()
    RAW.mkdir(exist_ok=True)
    jobs = [(t, k) for t in a.only for k in a.kind]
    with cf.ThreadPoolExecutor(len(jobs)) as ex:
        futs = {ex.submit(job, t, k): (t, k) for t, k in jobs}
        for f in cf.as_completed(futs):
            t, k = futs[f]
            try:
                print("ok", f.result(), flush=True)
            except Exception as e:
                print("FAIL", t, k, e, flush=True)
                sys.exitcode = 1
