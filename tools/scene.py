import sys
sys.path.insert(0, '/tmp/claude-0/-home-user-leagcypitch/a296ac58-67ba-580e-a1ad-52d13f3833b1/scratchpad/build')
from stage import *
from PIL import Image, ImageFilter, ImageEnhance, ImageChops

# ============================================================= 1. the room
room = Image.open(A + 'hero-study.webp').convert('RGBA')
room = room.resize((W, int(W * room.height / room.width)), Image.LANCZOS)
room = room.crop((0, 0, W, 560)).filter(ImageFilter.GaussianBlur(7))
room = ImageEnhance.Brightness(room).enhance(0.52)
canvas = Image.new('RGBA', (W, H), (6, 6, 8, 255))
canvas.paste(room, (0, 0))

# ============================================================= 2. the table
# black marble, laid into perspective from the horizon down to the frame edge
marble = Image.open(A + 'marble-bg.webp').convert('RGBA')
HORIZON = 470
table = warp(marble, [(-520, HORIZON), (W + 520, HORIZON), (W + 1500, H), (-1500, H)])
table = ImageEnhance.Brightness(table).enhance(0.78)
canvas = over(canvas, table)

# the room does not end on a line: blend the seam into the stone
seam = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(seam).rectangle([0, HORIZON - 120, W, HORIZON + 90], fill=(4, 4, 6, 230))
canvas = over(canvas, seam.filter(ImageFilter.GaussianBlur(70)))

# a soft warm pool of light where the set will sit
pool = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(pool)
d.ellipse([W * 0.12, HORIZON - 40, W * 0.88, H * 0.96], fill=(120, 92, 44, 58))
canvas = over(canvas, pool.filter(ImageFilter.GaussianBlur(120)))

# ============================================================= 3. the board
board = Image.open(A + 'board-mat.webp')
BOARD = [(486, 596), (1114, 596), (1470, 916), (130, 916)]      # tl tr br bl
b_lay = warp(board, BOARD)
canvas = over(canvas,
              shadow(b_lay, 26, 0.80, 0, 16),
              ImageEnhance.Contrast(ImageEnhance.Color(ImageEnhance.Brightness(b_lay).enhance(0.86)).enhance(1.22)).enhance(1.10))

# ============================================================= 4. the box
box = Image.open(A + 'box-cover.webp')
BX, BY, BW = 540, 96, 520
BH = int(BW * box.height / box.width)

# right-hand spine, built from a slice of the cover's own edge
edge = box.crop((box.width - 14, 0, box.width, box.height))
spine = warp(edge, [(BX + BW - 2, BY + 6), (BX + BW + 30, BY + 22),
                    (BX + BW + 30, BY + BH - 14), (BX + BW - 2, BY + BH)])
spine = ImageEnhance.Brightness(spine).enhance(0.30)

face = place(box, (BX, BY, BW, BH))
box_all = over(Image.new('RGBA', (W, H), (0, 0, 0, 0)), spine, face)

# contact shadow on the table, thrown back and to the left by the key light
foot = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(foot).ellipse([BX - 70, BY + BH - 40, BX + BW + 120, BY + BH + 52],
                             fill=(0, 0, 0, 220))
refl = box_all.transpose(Image.FLIP_TOP_BOTTOM)
refl = ImageChops.offset(refl, 0, 2 * (BY + BH) - H + 6)
refl = refl.filter(ImageFilter.GaussianBlur(7))
ra = refl.split()[3].point(lambda v: int(v * 0.20))
ra = ImageChops.multiply(ra, vgrad((W, H), 255, 0).point(lambda v: 255 - v))
refl.putalpha(ra)

canvas = over(canvas, refl, foot.filter(ImageFilter.GaussianBlur(34)),
              shadow(box_all, 30, 0.72, -34, 26), box_all)

# ============================================================= 5. the cards
CARDS = ['cards/career-doctor.webp', 'cards/asset-bitcoin.webp',
         'cards/habit-rich-generational.webp', 'cards/iq-compound-interest.webp',
         'cards/habit-poor-gave-up.webp']
cw, gap = 206, 18
total = len(CARDS) * cw + (len(CARDS) - 1) * gap
x0 = (W - total) // 2
for i, f in enumerate(CARDS):
    c = Image.open(A + f)
    x = x0 + i * (cw + gap)
    ch = int(cw * c.height / c.width * 0.72)          # foreshortened, lying down
    y = 866
    lean = (i - 2) * 7                                 # a shallow arc
    q = [(x + lean * 0.5, y), (x + cw + lean * 0.5, y),
         (x + cw + lean, y + ch), (x + lean, y + ch)]
    cl = warp(c, q)
    contact = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(contact).ellipse([x + lean - 12, y + ch - 18, x + cw + lean + 12, y + ch + 16],
                                    fill=(0, 0, 0, 205))
    cl = ImageEnhance.Contrast(ImageEnhance.Brightness(cl).enhance(1.02)).enhance(1.20)
    canvas = over(canvas, contact.filter(ImageFilter.GaussianBlur(14)),
                  shadow(cl, 12, 0.80, -5, 9), cl)

# ============================================================= 6. the pieces
PIECES = [('tokens/token-businessman.webp', 132), ('tokens/token-bonsai.webp', 104),
          ('tokens/token-torch.webp', 144)]
px = 1258
for f, ph in PIECES:
    t = Image.open(A + f)
    pw = int(ph * t.width / t.height)
    py = 858 - ph
    tl = place(t, (px, py, pw, ph))
    ImageDraw.Draw(tl)  # no-op, keeps intent clear
    contact = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(contact).ellipse([px - 6, py + ph - 14, px + pw + 6, py + ph + 14],
                                    fill=(0, 0, 0, 200))
    canvas = over(canvas, contact.filter(ImageFilter.GaussianBlur(11)),
                  shadow(tl, 10, 0.7, -10, 6), tl)
    px += pw + 20

# ============================================================= 7. grade
canvas = ImageEnhance.Color(canvas).enhance(1.06)
canvas = ImageEnhance.Contrast(canvas).enhance(1.05)

vig = Image.new('L', (W, H), 0)
ImageDraw.Draw(vig).ellipse([-W * 0.30, -H * 0.42, W * 1.30, H * 1.30], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(190))
dark = Image.new('RGBA', (W, H), (0, 0, 0, 255))
dark.putalpha(ImageChops.invert(vig).point(lambda v: int(v * 0.72)))
canvas = over(canvas, dark)

# let the frame edges fall away so the shot sits inside the page
fade = Image.new('RGBA', (W, H), (5, 5, 6, 255))
fade.putalpha(vgrad((W, H), 0, 235).point(lambda v: v if v > 120 else 0))
canvas = over(canvas, fade)

# two framings. Wide for desktop; a tighter one for a phone, where the wide
# crop shrinks the box to nothing.
canvas.crop((44, 30, W - 30, 1104)).convert('RGB').save(OUT + 'hero-set.png')
canvas.crop((300, 84, 1300, 1000)).convert('RGB').save(OUT + 'hero-set-tall.png')
print('rendered', canvas.size)
