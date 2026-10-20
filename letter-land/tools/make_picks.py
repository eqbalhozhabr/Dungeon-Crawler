#!/usr/bin/env python3
"""
Cut the two standing characters out of a green-screen picture into picks.js (used on the character-selection screen).

  python3 letter-land/tools/make_picks.py letter-land/tools/pick-source.png [--height 380]
"""
import argparse, base64, io, json, os
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('image')
ap.add_argument('--height', type=int, default=380)
ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'picks.js'))
args = ap.parse_args()

a = np.array(Image.open(args.image).convert('RGB')).astype(np.float32)
BG = np.median(a[:40, :40].reshape(-1, 3), axis=0)
BG_EXC = BG[1] - max(BG[0], BG[2])
exc = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
f = np.clip(exc / BG_EXC, 0, 1)
alpha = np.clip((1 - f - 0.2) / 0.7, 0, 1)
fg = (a - f[..., None] * BG) / np.maximum(1 - f[..., None], 0.05)
fg[..., 1] = np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]) + 6)
fg = np.clip(fg, 0, 255)
alpha = np.array(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))).astype(np.float32) / 255

cols = (exc < 40).sum(0)
occupied = np.where(cols > 3)[0]
mid = int((occupied.min() + occupied.max()) // 2)
split = min(range(mid - 60, mid + 60), key=lambda x: (cols[x], abs(x - mid)))
print('split at', split)

out = {}
for side in ('boy', 'girl'):
    al = alpha.copy()
    if side == 'boy': al[:, split:] = 0
    else: al[:, :split] = 0
    ys, xs = np.where(al > 0.3)
    x0, y0, x1, y1 = xs.min() - 6, ys.min() - 6, xs.max() + 6, ys.max() + 6
    k = args.height / (y1 - y0); w = round((x1 - x0) * k)
    pm = (fg * al[..., None])[y0:y1, x0:x1]; aa = al[y0:y1, x0:x1] * 255
    ch = [np.array(Image.fromarray(pm[..., c].clip(0, 255).astype(np.uint8)).resize((w, args.height), Image.LANCZOS)).astype(np.float32) for c in range(3)]
    ar = np.array(Image.fromarray(aa.clip(0, 255).astype(np.uint8)).resize((w, args.height), Image.LANCZOS)).astype(np.float32)
    rgb = np.dstack(ch) * 255 / np.maximum(ar[..., None], 1)
    rgb = np.where(ar[..., None] > 20, rgb, 0).clip(0, 255); ar = np.where(ar > 20, ar, 0)
    img = Image.fromarray(np.dstack([rgb, ar]).astype(np.uint8), 'RGBA')
    q = np.array(img.quantize(colors=128, method=Image.FASTOCTREE, dither=Image.NONE).convert('RGBA'))
    q[np.array(img)[..., 3] == 0] = 0
    final = Image.fromarray(q, 'RGBA').quantize(colors=128, method=Image.FASTOCTREE, dither=Image.NONE)
    buf = io.BytesIO(); final.save(buf, 'PNG', optimize=True)
    out[side] = {'src': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), 'w': int(w), 'h': int(args.height)}
    print(side, w, 'x', args.height, '%d KB' % (len(buf.getvalue()) // 1024))
    final.convert('RGBA').save(os.path.join(os.path.dirname(args.out), 'tools', 'pick-%s-preview.png' % side) if False else '/tmp/pick-%s.png' % side)
with open(args.out, 'w') as fh:
    fh.write("/* Standing pictures for the character-selection screen. Made by tools/make_picks.py */\nwindow.LetterPicks = " + json.dumps(out) + ";\n")
print('wrote', os.path.abspath(args.out))
