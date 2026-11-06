#!/usr/bin/env python3
"""Hide the data-tile seams on games/windward/assets/chart/overview.png (stage 1c revision).
The overview was drawn from coast data fetched in rectangles; where a land polygon was cut by a tile edge, an ink line was
left along the cut: long, perfectly straight, with land on BOTH sides. A real coast has sea on one side. This repaints
those runs (>= MIN_RUN px) with the land colour. Run once on the extracted picture:
  python3 tools/clean-chart-seams.py [path]
"""
import sys
from PIL import Image
path = sys.argv[1] if len(sys.argv) > 1 else 'games/windward/assets/chart/overview.png'
im = Image.open(path).convert('RGB')
W, H = im.size
px = im.load()
LAND = (239, 227, 200)
MIN_RUN = 14

def is_ink(c): return c[0] < 140 and c[1] < 130 and c[2] < 120
def is_land(c): return abs(c[0] - 239) < 14 and abs(c[1] - 227) < 14 and abs(c[2] - 200) < 16

fix = set()
def land_at(x, y): return not (0 <= x < W and 0 <= y < H) or is_land(px[x, y])  # outside the picture counts as land
def scan(vertical):
    n_a, n_b = (W, H) if vertical else (H, W)
    for a in range(n_a):
        b = 0
        while b < n_b:
            if not is_ink(px[(a, b) if vertical else (b, a)]): b += 1; continue
            e = b
            while e < n_b and is_ink(px[(a, e) if vertical else (e, a)]): e += 1
            if e - b >= MIN_RUN:
                for k in range(b, e):  # judged pixel by pixel, so a seam that ends in a real coast keeps its coast end
                    x, y = (a, k) if vertical else (k, a)
                    dx, dy = (1, 0) if vertical else (0, 1)
                    # land (or the one-pixel pale halo, then land) on both sides
                    def side(sign):
                        for step in (3, 4):
                            if land_at(x + sign * dx * step, y + sign * dy * step): return True
                        return False
                    if side(-1) and side(1):
                        for off in (-1, 0, 1): fix.add((x + dx * off, y + dy * off))
            b = e
scan(True); scan(False)
for p in fix:
    if 0 <= p[0] < W and 0 <= p[1] < H and (is_ink(px[p]) or px[p] == (194, 218, 216)): px[p] = LAND
im.save(path)
print('repainted', len(fix), 'pixels in', path)
