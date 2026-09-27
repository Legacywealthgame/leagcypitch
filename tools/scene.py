"""
Legacy Wealth hero. One staged shot, built from the real components.

Composed mobile first: everything that matters sits inside a centre band
about 1100px wide, so the phone crop is a complete picture on its own and
the desktop crop just shows more of the table around it.

Layers, back to front:
    room (blurred study)  ->  marble table  ->  money stack and dice, set
    back beside the box   ->  box, standing  ->  board, laid into the table
    ->  three cards along the near edge  ->  one player piece at the right

Run:  python3 tools/props.py && python3 tools/scene.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops
from stage import warp, place, shadow, vgrad, over, A, W as _W

W, H = 1600, 1050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'images')
PREV = '/tmp/claude-0/-home-user-leagcypitch/a296ac58-67ba-580e-a1ad-52d13f3833b1/scratchpad/build/'
SZ = (W, H)


def blank():
    return Image.new('RGBA', SZ, (0, 0, 0, 0))


def ground(x0, y0, x1, y1, alpha, blur):
    """A contact shadow: the dark smudge where an object meets the stone."""
    g = blank()
    ImageDraw.Draw(g).ellipse([x0, y0, x1, y1], fill=(0, 0, 0, alpha))
    return g.filter(ImageFilter.GaussianBlur(blur))


# ------------------------------------------------------------------ 1. room
room = Image.open(A + 'hero-study.webp').convert('RGBA')
room = room.resize((W, int(W * room.height / room.width)), Image.LANCZOS)
room = room.crop((0, 0, W, 520)).filter(ImageFilter.GaussianBlur(8))
canvas = Image.new('RGBA', SZ, (6, 6, 8, 255))
canvas.paste(ImageEnhance.Brightness(room).enhance(0.46), (0, 0))

# ------------------------------------------------------------------ 2. table
HORIZON = 430
marble = Image.open(A + 'marble-bg.webp').convert('RGBA')
table = warp(marble, [(-560, HORIZON), (W + 560, HORIZON), (W + 1600, H), (-1600, H)], SZ)
canvas = over(canvas, ImageEnhance.Brightness(table).enhance(0.74))

seam = blank()
ImageDraw.Draw(seam).rectangle([0, HORIZON - 110, W, HORIZON + 70], fill=(4, 4, 6, 235))
canvas = over(canvas, seam.filter(ImageFilter.GaussianBlur(64)))

pool = blank()
ImageDraw.Draw(pool).ellipse([W * .16, HORIZON - 30, W * .84, H * .94], fill=(122, 94, 46, 54))
canvas = over(canvas, pool.filter(ImageFilter.GaussianBlur(120)))

# ------------------------------------------------------------------- 4. box
box = Image.open(A + 'box-cover.webp')
BW = 452
BH = int(BW * box.height / box.width)
BX, BY = (W - BW) // 2, 86

edge = box.crop((box.width - 13, 0, box.width, box.height))
spine = warp(edge, [(BX + BW - 2, BY + 5), (BX + BW + 27, BY + 20),
                    (BX + BW + 27, BY + BH - 13), (BX + BW - 2, BY + BH)], SZ)
box_all = over(blank(), ImageEnhance.Brightness(spine).enhance(0.30), place(box, (BX, BY, BW, BH), SZ))

refl = box_all.transpose(Image.FLIP_TOP_BOTTOM)
refl = ImageChops.offset(refl, 0, 2 * (BY + BH) - H + 4).filter(ImageFilter.GaussianBlur(7))
ra = refl.split()[3].point(lambda v: int(v * .18))
refl.putalpha(ImageChops.multiply(ra, vgrad(SZ, 255, 0).point(lambda v: 255 - v)))

canvas = over(canvas, refl,
              ground(BX - 58, BY + BH - 34, BX + BW + 96, BY + BH + 44, 215, 30),
              shadow(box_all, 28, .70, -30, 22), box_all)

# ----------------------------------------------------------------- 5. board
board = Image.open(A + 'board-mat.webp')
BOARD = [(556, 508), (1044, 508), (1338, 806), (262, 806)]
b_lay = warp(board, BOARD, SZ)
# partial reveal: the far half dissolves, so the board supports the box
# instead of competing with it
fade = Image.new('L', SZ, 255)
ImageDraw.Draw(fade).rectangle([0, 0, W, 470], fill=0)
for i in range(120):
    ImageDraw.Draw(fade).rectangle([0, 470 + i, W, 470 + i + 1], fill=int(255 * i / 120))
b_lay.putalpha(ImageChops.multiply(b_lay.split()[3], fade))
b_lay = ImageEnhance.Contrast(ImageEnhance.Color(
    ImageEnhance.Brightness(b_lay).enhance(0.86)).enhance(1.22)).enhance(1.10)
canvas = over(canvas, shadow(b_lay, 24, .78, 0, 14), b_lay)

# ----------------------------------------------- 6. one card from each deck
CARDS = ['cards/career-doctor.webp', 'cards/asset-bitcoin.webp',
         'cards/asset-penthouse.webp']
cw = 164
overlap = 26
x0 = (W - (len(CARDS) * cw - (len(CARDS) - 1) * overlap)) // 2
for i, f in enumerate(CARDS):
    c = Image.open(A + f)
    x = x0 + i * (cw - overlap)
    ch = int(cw * c.height / c.width * 0.74)
    y = 636 + (0 if i == 1 else 13)          # centre card stands a little proud
    lean = (i - 1) * 11
    cl = warp(c, [(x + lean * .5, y), (x + cw + lean * .5, y),
                  (x + cw + lean, y + ch), (x + lean, y + ch)], SZ)
    cl = ImageEnhance.Contrast(ImageEnhance.Brightness(cl).enhance(1.02)).enhance(1.16)
    canvas = over(canvas,
                  ground(x + lean - 14, y + ch - 18, x + cw + lean + 14, y + ch + 16, 205, 14),
                  shadow(cl, 12, .80, -6, 9), cl)

# --------------------------------------------------------- 7. player pieces
for f, ph, px in (('tokens/token-businessman.webp', 112, 1146),):
    t = Image.open(A + f)
    pw = int(ph * t.width / t.height)
    py = 700 - ph
    t_lay = place(t, (px, py, pw, ph), SZ)
    canvas = over(canvas,
                  ground(px - 5, py + ph - 13, px + pw + 5, py + ph + 13, 200, 10),
                  shadow(t_lay, 9, .64, -9, 6), t_lay)

# ------------------------------------------------------------------ 8. grade
canvas = ImageEnhance.Contrast(ImageEnhance.Color(canvas).enhance(1.06)).enhance(1.05)
vig = Image.new('L', SZ, 0)
ImageDraw.Draw(vig).ellipse([-W * .28, -H * .40, W * 1.28, H * 1.30], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(180))
dark = Image.new('RGBA', SZ, (0, 0, 0, 255))
dark.putalpha(ImageChops.invert(vig).point(lambda v: int(v * .70)))
canvas = over(canvas, dark)

# ------------------------------------------------------------------ 9. crops
# phone first: the tight frame is the one the composition was built for
tall = canvas.crop((334, 38, 1300, 828))
wide = canvas.crop((76, 30, W - 76, 844))
for im, name in ((tall, 'hero-set-tall'), (wide, 'hero-set')):
    im.convert('RGB').save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=86, method=6)
    im.convert('RGB').save(PREV + name + '.png')
    print('%-16s %s' % (name, im.size))
