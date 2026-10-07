"""Optical-flow jump scan.

python3 tools/flowscan.py <film.mp4> [--width 480] [--k 3.0] [--win 15]

For every frame pair, compute dense Farneback flow and take the mean
magnitude (pixels at --width). Flag any frame whose motion differs from the
local median (a centred window of --win frames) by more than --k times, in
either direction, ignoring near-static stretches. Each flag gets a strip
(previous / flagged / next frame + flow magnitude) to look at.
Writes <film>.flow.csv, <film>.flags.json and <film>.flags.jpg.
"""
import sys, json, argparse
import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('film')
ap.add_argument('--width', type=int, default=480)
ap.add_argument('--k', type=float, default=3.0)
ap.add_argument('--win', type=int, default=15)
ap.add_argument('--floor', type=float, default=0.25, help='px/frame below which motion counts as still')
a = ap.parse_args()

cap = cv2.VideoCapture(a.film)
fps = cap.get(cv2.CAP_PROP_FPS) or 60
prev = None
mags, thumbs = [], []
while True:
    ok, frame = cap.read()
    if not ok:
        break
    h = int(frame.shape[0] * a.width / frame.shape[1])
    small = cv2.resize(frame, (a.width, h), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    if prev is None:
        mags.append(0.0)
    else:
        flow = cv2.calcOpticalFlowFarneback(prev, gray, None, 0.5, 4, 21, 3, 5, 1.1, 0)
        m = np.linalg.norm(flow, axis=2)
        mags.append(float(np.mean(m)))
    thumbs.append(small)
    prev = gray
cap.release()
mags = np.array(mags)
n = len(mags)
half = a.win // 2
flags = []
for i in range(1, n):
    lo, hi = max(1, i - half), min(n, i + half + 1)
    med = float(np.median(mags[lo:hi]))
    m = mags[i]
    if max(m, med) < a.floor:
        continue
    ratio = (m + 0.05) / (med + 0.05)
    if ratio > a.k or ratio < 1 / a.k:
        flags.append({'frame': i, 'time': round(i / fps, 3), 'motion': round(m, 3), 'local_median': round(med, 3), 'ratio': round(ratio, 2)})

base = a.film.rsplit('.', 1)[0]
with open(base + '.flow.csv', 'w') as f:
    f.write('frame,time,motion\n')
    for i, m in enumerate(mags):
        f.write(f'{i},{i / fps:.3f},{m:.4f}\n')
json.dump({'film': a.film, 'frames': n, 'fps': fps, 'k': a.k, 'flags': flags,
           'stats': {'mean': float(mags.mean()), 'p95': float(np.percentile(mags, 95)), 'max': float(mags.max())}},
          open(base + '.flags.json', 'w'), indent=1)
# merge flags that sit next to each other into events
events = []
for fl in flags:
    if events and fl['frame'] - events[-1][-1]['frame'] <= 3:
        events[-1].append(fl)
    else:
        events.append([fl])
rows = []
for ev in events[:24]:
    i = max(ev, key=lambda x: abs(np.log(x['ratio'])))['frame']
    strip = np.hstack([thumbs[max(0, i - 1)], thumbs[i], thumbs[min(n - 1, i + 1)]])
    cv2.putText(strip, f"f{i} t={i / fps:.2f}s motion {mags[i]:.2f} vs median x{ev[0]['ratio']}", (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    rows.append(strip)
if rows:
    cv2.imwrite(base + '.flags.jpg', np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])
print(f'{n} frames, motion mean {mags.mean():.2f} p95 {np.percentile(mags, 95):.2f} max {mags.max():.2f} px/frame @ {a.width}px; '
      f'{len(flags)} flagged frames in {len(events)} events')
for ev in events:
    print('  event', ev[0]['frame'], '-', ev[-1]['frame'], f"t={ev[0]['time']}s", 'ratios', [x['ratio'] for x in ev][:6])
