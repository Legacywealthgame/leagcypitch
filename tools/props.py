"""
Two props the repo has no artwork for: a charcoal-and-gold die, and a banded
stack of notes. Drawn, not photographed, and deliberately generic so neither
pretends to be a component that ships in the box.
"""
from PIL import Image, ImageDraw, ImageFilter

CHARCOAL = (30, 30, 33)
CHAR_LIT = (52, 52, 57)
CHAR_DIM = (17, 17, 19)
GOLD = (201, 162, 76)
GOLD_LIT = (232, 212, 154)
GOLD_DIM = (139, 111, 46)


def _shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def die(size=420, top=(2, 5), left=3, right=1, ss=4):
    """
    An isometric die: top face plus two sides, charcoal body, gold pips.
    `top` is a pair so the top face can read as a 5 without looking flat.
    """
    S = size * ss
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    cx, w, h = S / 2, S * 0.40, S * 0.23      # half-width, half-height of the top rhombus
    ty = S * 0.17                              # top vertex
    side = S * 0.40                            # vertical drop of the side faces

    T = [(cx, ty), (cx + w, ty + h), (cx, ty + 2 * h), (cx - w, ty + h)]
    L = [(cx - w, ty + h), (cx, ty + 2 * h), (cx, ty + 2 * h + side), (cx - w, ty + h + side)]
    R = [(cx + w, ty + h), (cx, ty + 2 * h), (cx, ty + 2 * h + side), (cx + w, ty + h + side)]

    d.polygon(T, fill=CHAR_LIT)
    d.polygon(L, fill=CHAR_DIM)
    d.polygon(R, fill=CHARCOAL)
    for face in (T, L, R):
        d.line(face + [face[0]], fill=_shade(GOLD_DIM, 0.85), width=max(2, ss))

    def pip(px, py, r, lit):
        d.ellipse([px - r, py - r, px + r, py + r], fill=GOLD_LIT if lit else GOLD)
        d.ellipse([px - r * .42, py - r * .42, px + r * .18, py + r * .18],
                  fill=_shade(GOLD_LIT, 1.12))

    r = S * 0.031
    # top face: pips laid out on the rhombus, so they sit in the plane
    def on_top(u, v):
        return (cx + (u - .5) * 2 * w * .62 + (v - .5) * 0 * w,
                ty + h + (v - .5) * 2 * h * .62 + (u - .5) * 0 * h)

    def plane(u, v):
        """u,v in 0..1 across the top rhombus."""
        return (cx + (u - .5) * w + (v - .5) * w,
                ty + h + (u - .5) * h - (v - .5) * h)

    tops = {1: [(.5, .5)],
            2: [(.25, .25), (.75, .75)],
            5: [(.22, .22), (.78, .22), (.5, .5), (.22, .78), (.78, .78)]}
    for u, v in tops.get(top[1], tops[5]):
        pip(*plane(u, v), r, True)

    # left face
    def pl(u, v):
        return (cx - w + u * w, ty + h + u * h + v * side)
    lefts = {3: [(.22, .22), (.5, .5), (.78, .78)], 2: [(.28, .28), (.72, .72)]}
    for u, v in lefts.get(left, lefts[3]):
        pip(*pl(u, v), r * .92, False)

    # right face
    def pr(u, v):
        return (cx + w - u * w, ty + h + u * h + v * side)
    rights = {1: [(.5, .5)], 4: [(.26, .26), (.74, .26), (.26, .74), (.74, .74)]}
    for u, v in rights.get(right, rights[1]):
        pip(*pr(u, v), r * .92, False)

    return im.resize((size, size), Image.LANCZOS)


def money_stack(w=460, notes=22, ss=3):
    """A banded brick of notes: front face striated with note edges, a top
    face going back in perspective, one gold band wrapping both. Generic
    scenery, deliberately not a Legacy Wealth note."""
    S = w * ss
    depth = int(S * 0.26)
    front_h = int(S * 0.46)
    H = front_h + depth + ss * 2
    im = Image.new('RGBA', (S, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    top_y = depth
    # top face, receding to the upper right
    d.polygon([(0, top_y), (S - depth, top_y), (S, top_y - depth * .70), (depth, top_y - depth * .70)],
              fill=(178, 172, 150))
    # front face
    d.rectangle([0, top_y, S - depth, top_y + front_h], fill=(158, 152, 130))
    # right face
    d.polygon([(S - depth, top_y), (S, top_y - depth * .70),
               (S, top_y - depth * .70 + front_h), (S - depth, top_y + front_h)],
              fill=(104, 100, 84))

    # note edges: solid alternating bands, so they survive being shrunk to
    # thumb size. Hairlines vanish and the stack reads as a plain carton.
    band = front_h / notes
    for i in range(notes):
        y = top_y + i * band
        f = 1.18 if i % 2 else 0.74
        d.rectangle([0, y, S - depth, y + band * .58],
                    fill=_shade((158, 152, 130), f))
        d.polygon([(S - depth, y), (S, y - depth * .70),
                   (S, y - depth * .70 + band * .58), (S - depth, y + band * .58)],
                  fill=_shade((104, 100, 84), f))

    # the band, wrapping the front and over the top
    bx0, bx1 = S * 0.30, S * 0.30 + S * 0.20
    d.rectangle([bx0, top_y, bx1, top_y + front_h], fill=GOLD_DIM)
    d.rectangle([bx0, top_y, bx1, top_y + front_h * .62], fill=GOLD)
    d.polygon([(bx0, top_y), (bx1, top_y),
               (bx1 + depth, top_y - depth * .70), (bx0 + depth, top_y - depth * .70)],
              fill=GOLD_LIT)
    d.line([(bx0, top_y), (bx1, top_y)], fill=_shade(GOLD_LIT, 1.05), width=max(1, ss))

    return im.resize((w, H // ss), Image.LANCZOS)


if __name__ == '__main__':
    O = '/tmp/claude-0/-home-user-leagcypitch/a296ac58-67ba-580e-a1ad-52d13f3833b1/scratchpad/build/'
    sheet = Image.new('RGBA', (1000, 480), (16, 16, 18, 255))
    sheet.alpha_composite(die(300, top=(2, 5), left=3, right=1), (40, 60))
    sheet.alpha_composite(die(240, top=(2, 2), left=2, right=4), (360, 140))
    ms = money_stack(340)
    sheet.alpha_composite(ms, (620, 460 - ms.height))
    sheet.convert('RGB').save(O + 'props.png')
    print('props sheet written', sheet.size)
