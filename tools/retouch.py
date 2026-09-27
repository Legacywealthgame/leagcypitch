"""
Touch-up pass on the generated hero shot.

The render is good but has one tell: the box spine carries garbled
pseudo-lettering where the model guessed at text wrapping round the edge.
That gets smeared into plain shadow. Everything else is a light grade.

Run: python3 tools/retouch.py
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops
import os

SRC = '/root/.claude/uploads/a296ac58-67ba-580e-a1ad-52d13f3833b1/c1c41d98-image.jpg'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'images')
PREV = '/tmp/claude-0/-home-user-leagcypitch/a296ac58-67ba-580e-a1ad-52d13f3833b1/scratchpad/'

im = Image.open(SRC).convert('RGB')

# ---------------------------------------------------------------- 1. the spine
# Smear the fake lettering along the spine until it reads as a worn emboss.
BOX = (276, 96, 316, 600)
strip = im.crop(BOX)
# a long vertical blur first, so letterforms run together rather than stay as
# separate blobs, then a round blur to take the edge off
strip = strip.resize((strip.width, max(1, strip.height // 26)), Image.LANCZOS)
strip = strip.resize((BOX[2] - BOX[0], BOX[3] - BOX[1]), Image.LANCZOS)
strip = strip.filter(ImageFilter.GaussianBlur(3))
strip = ImageEnhance.Brightness(strip).enhance(0.94)

# feather the patch so it does not show as a rectangle
mask = Image.new('L', strip.size, 0)
ImageDraw.Draw(mask).rectangle([3, 8, strip.width - 4, strip.height - 9], fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(4))
im.paste(strip, BOX[:2], mask)

# ---------------------------------------------------------------- 2. the grade
im = ImageEnhance.Color(im).enhance(1.07)          # a little more gold
im = ImageEnhance.Contrast(im).enhance(1.07)       # deeper blacks
im = ImageEnhance.Brightness(im).enhance(1.02)

# lift the box out of the frame with a gentle vignette
W, H = im.size
vig = Image.new('L', (W, H), 0)
ImageDraw.Draw(vig).ellipse([-W * .18, -H * .26, W * 1.18, H * 1.22], fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(150))
dark = Image.new('RGB', (W, H), (0, 0, 0))
im = Image.composite(im, dark, vig.point(lambda v: int(60 + v * .76)))

# a touch of local sharpening on the product, not the room
im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=42, threshold=4))

im.save(os.path.join(OUT, 'hero-shot.webp'), 'WEBP', quality=90, method=6)
im.crop((150, 18, 1380, 1004)).save(os.path.join(OUT, 'hero-shot-tall.webp'),
                                    'WEBP', quality=90, method=6)
im.save(PREV + 'retouched.png')
im.crop((250, 20, 920, 640)).resize((1005, 930), Image.LANCZOS).save(PREV + 'retouched-box.png')
print('retouched', im.size)
