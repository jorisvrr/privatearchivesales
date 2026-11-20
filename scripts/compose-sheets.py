"""Compose verification/pairs.json into side-by-side sheets: reference (left) | Orvel (right).
Usage: python3 scripts/compose-sheets.py"""
import json
from collections import OrderedDict
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
out = root / 'verification'
pairs = json.loads((out / 'pairs.json').read_text())
groups = OrderedDict()
for p in pairs:
    groups.setdefault(p['group'], []).append(p)

try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
except OSError:
    font = ImageFont.load_default()

H = 420  # cell height
for name, items in groups.items():
    rows = []
    for p in items:
        mine = Image.open(out / p['mine']).convert('RGB')
        ref = Image.open(root / p['ref']).convert('RGB') if p['ref'] and (root / p['ref']).exists() else None
        w = round(mine.width * H / mine.height)
        row = Image.new('RGB', (w * 2 + 12, H + 30), 'white')
        d = ImageDraw.Draw(row)
        if ref:
            row.paste(ref.resize((w, H)), (0, 30))
        else:
            d.text((10, 40 + H // 2), 'no reference capture', fill='red', font=font)
        row.paste(mine.resize((w, H)), (w + 12, 30))
        d.rectangle((w, 0, w + 11, H + 30), fill=(255, 0, 255))
        d.text((6, 5), f"Reference · {p['label']}", fill='black', font=font)
        d.text((w + 18, 5), f"Orvel · {p['label']}", fill='black', font=font)
        rows.append(row)
    per = 2 if rows[0].width > 1200 else 4
    cols = min(per, len(rows))
    rw = max(r.width for r in rows)
    rh = rows[0].height
    nrows = (len(rows) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * rw + (cols - 1) * 16, nrows * rh + (nrows - 1) * 16), (255, 0, 255))
    for i, r in enumerate(rows):
        sheet.paste(r, ((i % cols) * (rw + 16), (i // cols) * (rh + 16)))
    sheet.save(out / f'{name}.jpg', quality=82)
    print(name, sheet.size)
