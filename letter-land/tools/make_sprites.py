#!/usr/bin/env python3
"""
Turn a green-screen video of the two characters running side by side into runcycle.js.

  python3 letter-land/tools/make_sprites.py VIDEO.mp4 [--start 80] [--frames 20] [--height 280]

Needs ffmpeg, Pillow and numpy. The boy is the left character, the girl the right one.
Without --start/--frames the loop is found automatically (the stretch whose last frame
looks most like its first).
"""
import argparse, base64, glob, io, json, os, subprocess, tempfile
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('video')
ap.add_argument('--start', type=int)
ap.add_argument('--frames', type=int)
ap.add_argument('--height', type=int, default=280)
ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'runcycle.js'))
args = ap.parse_args()

tmp = tempfile.mkdtemp()
subprocess.check_call(['ffmpeg', '-v', 'error', '-i', args.video, '-vsync', '0', os.path.join(tmp, 'f%04d.png')])
files = sorted(glob.glob(os.path.join(tmp, 'f*.png')))
fps = float(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', args.video]).decode().split('/')[0] or 24)
first = np.array(Image.open(files[0]).convert('RGB')).astype(np.float32)
BG = np.median(first[:60, :60].reshape(-1, 3), axis=0)
BG_EXC = BG[1] - max(BG[0], BG[2])
print('background', BG, 'frames', len(files))

def key(path):
    a = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    exc = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    f = np.clip(exc / BG_EXC, 0, 1)                    # how much of this pixel is background
    alpha = np.clip((1 - f - 0.2) / 0.7, 0, 1)         # soft edge, background noise becomes 0
    fg = (a - f[..., None] * BG) / np.maximum(1 - f[..., None], 0.05)
    fg[..., 1] = np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]) + 6)   # despill
    al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))
    return np.clip(fg, 0, 255), np.array(al).astype(np.float32) / 255, exc < 40

# loop: pick the stretch whose end matches its start
if args.start is None or args.frames is None:
    small = np.array([np.array(Image.open(f).convert('RGB').resize((160, 90))).astype(np.float32) for f in files])
    best = None
    for P in range(8, 48):
        for s in range(0, len(small) - P):
            d = np.abs(small[s] - small[s + P]).mean() + 0.02 * P
            if best is None or d < best[0]:
                best = (d, s, P)
    args.start, args.frames = best[1], best[2]
    print('loop: start', args.start, 'frames', args.frames)

frames = []
for i in range(args.frames):
    fg, al, m = key(files[args.start + i])
    cols = m.sum(0)
    occupied = np.where(cols > 3)[0]
    mid = int((occupied.min() + occupied.max()) // 2)          # the gap between the two characters
    split = min(range(mid - 80, mid + 80), key=lambda x: (cols[x], abs(x - mid)))
    frames.append((fg, al, split))

def side_alpha(al, sp, side):
    a = al.copy()
    if side == 'boy': a[:, sp:] = 0
    else: a[:, :sp] = 0
    return a

H, N = args.height, args.frames
meta = {}
for side in ('boy', 'girl'):
    bx0 = by0 = 10**9; bx1 = by1 = -1; widths = []
    for fg, al, sp in frames:
        ys, xs = np.where(side_alpha(al, sp, side) > 0.3)
        bx0 = min(bx0, xs.min()); by0 = min(by0, ys.min()); bx1 = max(bx1, xs.max()); by1 = max(by1, ys.max()); widths.append(xs.max() - xs.min())
    x0, y0, x1, y1 = bx0 - 4, by0 - 4, bx1 + 4, by1 + 4
    k = H / (y1 - y0); fw = round((x1 - x0) * k)
    sheet = Image.new('RGBA', (fw * N, H), (0, 0, 0, 0))
    for i, (fg, al, sp) in enumerate(frames):
        a = side_alpha(al, sp, side)
        pm = (fg * a[..., None])[y0:y1, x0:x1]
        aa = a[y0:y1, x0:x1] * 255
        ch = [np.array(Image.fromarray(pm[..., c].clip(0, 255).astype(np.uint8)).resize((fw, H), Image.LANCZOS)).astype(np.float32) for c in range(3)]
        ar = np.array(Image.fromarray(aa.clip(0, 255).astype(np.uint8)).resize((fw, H), Image.LANCZOS)).astype(np.float32)
        rgb = np.dstack(ch) * 255 / np.maximum(ar[..., None], 1)
        rgb = np.where(ar[..., None] > 20, rgb, 0).clip(0, 255)
        ar = np.where(ar > 20, ar, 0)
        sheet.paste(Image.fromarray(np.dstack([rgb, ar]).astype(np.uint8), 'RGBA'), (i * fw, 0))
    q = np.array(sheet.quantize(colors=112, method=Image.FASTOCTREE, dither=Image.NONE).convert('RGBA'))
    q[np.array(sheet)[..., 3] == 0] = 0
    final = Image.fromarray(q, 'RGBA').quantize(colors=112, method=Image.FASTOCTREE, dither=Image.NONE)
    buf = io.BytesIO(); final.save(buf, 'PNG', optimize=True)
    w = np.array(widths)
    meta[side] = {'src': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), 'n': N, 'fw': int(fw), 'fh': H,
                  'air': int(w.argmax()), 'idle': int(w.argmin())}
    print(side, 'frame', fw, 'x', H, '%d KB' % (len(buf.getvalue()) // 1024))
meta['fps'] = round(fps)
with open(args.out, 'w') as f:
    f.write("/* Run cycle (%d frames @ %d fps, facing right) cut from the supplied green-screen video. Made by tools/make_sprites.py */\nwindow.LetterRun = " % (N, round(fps)) + json.dumps(meta) + ";\n")
print('wrote', os.path.abspath(args.out))
