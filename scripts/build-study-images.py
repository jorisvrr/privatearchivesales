"""Builds the web images for Mino Study 001 from the original PNGs.
Usage: python3 scripts/build-study-images.py
Input:  assets/study-001/originals/<slug>.png   (1086×1448, 3:4; not served, not in git)
Output: public/media/study-001/<slug>-{s,m,l}.webp
  s  300×400   sphere + intro textures (one texture shared by both)
  m  640×853   fallback grid and detail-page thumbnails
  l  1086×1448 expanded plane and detail page (loaded on demand)
A focal point (fx, fy in 0–1) is applied only if a source isn't 3:4; all 18 supplied images are exactly 3:4."""
import os, json
from PIL import Image

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = os.path.join(root, 'assets/study-001/originals')
out = os.path.join(root, 'public/media/study-001')
os.makedirs(out, exist_ok=True)
SIZES = {'s': (300, 400, 80), 'm': (640, 853, 80), 'l': (1086, 1448, 84)}
FOCUS = {}  # slug -> (fx, fy); none needed for the supplied set

def crop34(im, fx=0.5, fy=0.5):
    w, h = im.size
    if abs(w / h - 0.75) < 0.002: return im
    if w / h > 0.75:
        nw = round(h * 0.75); x = min(max(0, round(fx * w - nw / 2)), w - nw); return im.crop((x, 0, x + nw, h))
    nh = round(w / 0.75); y = min(max(0, round(fy * h - nh / 2)), h - nh); return im.crop((0, y, w, y + nh))

report = {}
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    slug = f[:-4]
    im = crop34(Image.open(os.path.join(src, f)).convert('RGB'), *FOCUS.get(slug, (0.5, 0.5)))
    sizes = {}
    for key, (w, h, q) in SIZES.items():
        p = os.path.join(out, f'{slug}-{key}.webp')
        im.resize((w, h), Image.LANCZOS).save(p, 'WEBP', quality=q, method=6)
        sizes[key] = os.path.getsize(p)
    report[slug] = sizes
tot = {k: sum(v[k] for v in report.values()) for k in SIZES}
print(json.dumps({k: f'{v/1024:.0f} KB' for k, v in tot.items()}), len(report), 'images')
