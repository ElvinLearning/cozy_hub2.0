# Motion QA log

Recorder: `tools/film.mjs`. Playwright fake clock installed and paused, one
1/60 s frame per video frame via `__app.step` (Playwright 1.56's paused clock
never fires rAF), every video seeked to the same virtual time, scroll fed as an
exact value only on frames where it moves. Scan: `tools/flowscan.py`, Farneback
mean magnitude at 320 px wide, flag when the ratio to a 15-frame centred median
is > 3x or < 1/3x (ignoring stretches below 0.25 px/frame).

## Pass 1: 640x360, round-02 code
2780 frames. 9 flags.
- f365, 375, 385, 395 (scroll starting): **real**. Pinned text jittered +-1 px.
  The content wrapper was rounded to device pixels and the pin's counter-offset
  wasn't, so they didn't cancel. Fixed: the pin offset is now computed from the
  same rounded values (`main.js`, pins).
- f2651-2688 (end of page): scroll coming to rest. Intended. The recorder's
  stop profile is now constant-deceleration (no kink).

## Pass 2: 640x360, jitter fix
2770 frames. 4 flags.
- f1896 (agent chat): **real**. Removing the typing dots with `display:none`
  shrank the vertically centred chat card, so everything jumped half a row.
  Fixed: the dots fade and keep their space.
- f2127-2128 (pricing): flow mean 12 px/frame. Phase correlation shows the
  true global shift alternating 4/5 px, which is whole-pixel text rounding at
  4.5 px/frame on a 1x render. The spike is the estimator on repeated text
  lines. Intended trade-off (crisp text). At 1080p the cadence is 13/14 px.
- f2604 (end): phase correlation shows zero shift. Scroll is at rest while the
  3D loop animates. Intended.

## Final film: 1920x1080, 60 fps, current code (after the smoothing pass)
`cozy-1080p60.mp4`: 1886 frames, 31.4 s, x264 crf 13, yuv420p, faststart, 29 MB.
`cozy-1080p60-web.mp4` is the same film at crf 24 for sharing. The crf-13 master
is kept out of git.

Rendered with the resumable recorder. The first attempt was lost to a
container restart at frame 1080/1886. The recorder now writes frames to disk and
fast-forwards on re-run (a test render killed mid-way and resumed scanned clean,
with identical motion statistics).

Scan at 480 px: motion mean 0.46, p95 1.80, max 2.60 px/frame. **1 flag**:
- f616 (s = 1.87, prints settling, ratio 3.01, just over the 3x threshold): an
  estimator artefact. Phase correlation shows smooth, steadily accelerating global
  motion through it (-1.72, -1.73, -1.80, -1.84, -1.86 px), the changed-pixel
  count rises evenly, and frames 615/616 look continuous.
