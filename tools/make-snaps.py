"""Turn reel frames into casual 'customer phone snaps' for the side prints.
Phone look: auto-exposure lift on a night scene, warm white balance, a little
sensor noise, soft vignette, phone aspect, a hair of tilt."""
import subprocess, tempfile, os
import numpy as np
from PIL import Image, ImageFilter

def frame(src, n):
    t = tempfile.mktemp(suffix='.png')
    subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', src, '-vf', f'select=eq(n\\,{n})', '-frames:v', '1', t], check=True)
    im = Image.open(t).convert('RGB'); os.remove(t); return im

def phone(im, box, out, size, tilt=0.0, seed=1):
    im = im.crop(box).resize(size, Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    a = np.power(a, 0.72)                          # auto-exposure lift
    a = a * np.array([1.06, 1.0, 0.9])             # warm phone white balance
    a = (a - 0.5) * 0.92 + 0.5 + 0.02              # flatter phone contrast
    rng = np.random.default_rng(seed)
    a += rng.normal(0, 0.022, a.shape[:2])[..., None]  # luma noise
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
    a *= (1 - 0.18 * np.clip(r - 0.5, 0, 1))[..., None]
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    if tilt:
        im = im.rotate(tilt, resample=Image.BICUBIC, expand=False).crop((12, 12, w - 12, h - 12)).resize(size, Image.LANCZOS)
    im.save(out, quality=90)
    print(out, im.size)

R = 'public/media/reel/'
phone(frame(R + 'hf-c.mp4', 200), (560, 0, 920, 480), 'public/media/snaps/shopfront.jpg', (600, 800), tilt=1.2, seed=3)
phone(frame(R + 'shot-06.mp4', 0), (520, 0, 960, 330), 'public/media/snaps/shelf.jpg', (800, 600), tilt=-0.8, seed=7)
