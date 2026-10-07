"""Contact sheet of named-state screenshots: python3 tools/sheet.py <dir> <out.jpg> [cols] [names...]"""
import sys, os
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
names = sys.argv[4:] or sorted(f[:-4] for f in os.listdir(src) if f.endswith(('.png', '.jpg')))
tw = 480
ims = []
for n in names:
    p = next((os.path.join(src, n + e) for e in ('.png', '.jpg') if os.path.exists(os.path.join(src, n + e))), None)
    if p:
        im = Image.open(p).convert('RGB')
        ims.append((n, im.resize((tw, round(im.height * tw / im.width)))))
th = max(im.height for _, im in ims)
rows = (len(ims) + cols - 1) // cols
W = Image.new('RGB', (tw * cols, (th + 20) * rows), (18, 18, 20))
d = ImageDraw.Draw(W)
for i, (n, im) in enumerate(ims):
    x, y = (i % cols) * tw, (i // cols) * (th + 20)
    W.paste(im, (x, y))
    d.text((x + 6, y + th + 4), n, fill=(210, 210, 210))
W.save(out, quality=88)
