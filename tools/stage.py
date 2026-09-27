"""
Legacy Wealth hero: the real components staged on the black marble table.
Pure Pillow, no numpy, so the 8x8 perspective solve is written out by hand.
"""
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageChops

A = '/home/user/leagcypitch/assets/images/'
OUT = '/tmp/claude-0/-home-user-leagcypitch/a296ac58-67ba-580e-a1ad-52d13f3833b1/scratchpad/build/'
W, H = 1600, 1150


# ---------------------------------------------------------------- perspective
def solve8(M, B):
    n = len(B)
    M = [row[:] + [B[i]] for i, row in enumerate(M)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        M[c], M[p] = M[p], M[c]
        pv = M[c][c]
        if abs(pv) < 1e-12:
            raise ValueError('singular matrix')
        M[c] = [v / pv for v in M[c]]
        for r in range(n):
            if r != c:
                f = M[r][c]
                if f:
                    M[r] = [a - f * b for a, b in zip(M[r], M[c])]
    return [M[i][n] for i in range(n)]


def coeffs(dst, src):
    """PIL maps output pixel -> input pixel, so solve dst -> src."""
    M, B = [], []
    for (dx, dy), (sx, sy) in zip(dst, src):
        M.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]); B.append(sx)
        M.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]); B.append(sy)
    return solve8(M, B)


def warp(im, quad, size=(W, H)):
    """Put im's corners on quad (tl, tr, br, bl) over a transparent canvas."""
    im = im.convert('RGBA')
    w, h = im.size
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    return im.transform(size, Image.PERSPECTIVE, coeffs(quad, src),
                        Image.BICUBIC, fillcolor=(0, 0, 0, 0))


def place(im, box, size=(W, H)):
    """Paste im, resized to box=(x, y, w, h), onto a transparent canvas."""
    x, y, w, h = box
    lay = Image.new('RGBA', size, (0, 0, 0, 0))
    lay.paste(im.convert('RGBA').resize((int(w), int(h)), Image.LANCZOS),
              (int(x), int(y)))
    return lay


# ---------------------------------------------------------------- light
def shadow(layer, blur, opacity, dx=0, dy=0, gain=1.0):
    a = layer.split()[3]
    if gain != 1.0:
        a = a.point(lambda v: min(255, int(v * gain)))
    a = a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * opacity))
    sh = Image.new('RGBA', layer.size, (0, 0, 0, 255))
    sh.putalpha(a)
    return ImageChops.offset(sh, dx, dy)


def vgrad(size, top, bottom):
    """A vertical alpha ramp as an L mask."""
    g = Image.new('L', (1, size[1]))
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        g.putpixel((0, y), int(top + (bottom - top) * t))
    return g.resize(size, Image.BILINEAR)


def over(base, *layers):
    for l in layers:
        base = Image.alpha_composite(base, l)
    return base
