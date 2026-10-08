# Cozy Hub 2.0: closing note

Everything below was measured in this build environment. Estimates are marked.

## What was built

- **Landing page:** raw three.js, one scroll clock, timeline in vh, HDR chapters, bloom, filmic tonemap. Runs with `npm start`.
- **Admin panel:** works straight on the Higgsfield API. Generate with any model id or raw JSON, track jobs with polling and signed webhooks, upload assets, manage customers on a credits ledger with automatic refunds, see leads with their uploaded assets, and view pricing.
- **Cozy Agent:** a Higgsfield Agent API session that opens with our house brief and the customer's brand file. It is charged per delivered video.
- **Draft pricing in `config/plans.json`:** Starter $40/mo (5 videos), Growth $120/mo (20), Cozy Agent $300/mo (40), plus credit packs. All numbers are placeholders to change in that one file.
- **Logo:** the original ring, colours and Quicksand wordmark, redrawn flat. The ring now opens and breaks into the pixels. See `art-bible/`.

## Critic rounds (fresh agent each round, frozen snapshot, 10 elements, 1440x900 + 390x844)

| round | mean | hero | iris | assets | dissolve | handoff | reel | agent | pricing | start | chrome |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | 5.3 | 6 | 4 | 5 | 6 | 5 | 5 | 6 | 6 | 5 | 5 |
| 02 | 6.3 | 6 | 6 | 7 | 7 | 5 | 6 | 6 | 7 | 6 | 7 |
| 03 | 6.2 | 6 | 5 | 6 | 7 | 6 | 6 | 6 | 7 | 6 | 7 |
| 04 | 6.1 | 6 | 5 | 6 | 7 | 6 | 6 | 6 | 6 | 6 | 7 |

The loop stopped by its own rule after two rounds in a row gained less than half a point.

Each round's critic was new and named different gaps, so the plateau is partly critic variance (an estimate, about ±0.5). The fixes are real, though:

- every gap a critic named was addressed in the next build,
- the round-4 bug-level gaps were fixed after the last scoring (additive ring light, phone dissolve framing, pricing halo, form alignment, nav zone),
- a fresh smoothing agent then fixed seven seam problems (`smoothing.md`).

**Those last two passes have not been re-scored.**

## What now beats the bar (the bar is cozydigital.org's current hero art and logo)

- **The hero is live, not a still.** It shows the brand's chrome figure-eight threaded through the open logo ring, with the pixel scatter breaking off the ring and HDR bloom. It reads as the logo and as the hero art at once.
- **The signature moment.** A customer print breaks cell by cell into brand-coloured pixels, they fly through the ring, and they land as the same shot playing. The print is the clip's first frame, so photo and film are literally the same image. The critic's best scores were here (7).
- **The story is told in one scroll.** You fly through the ring into the studio, see your photos turn into film, the film becomes the page, then the agent assembles and the loop closes the page.
- **Phones have their own camera paths in every chapter**, not a squeezed desktop.

## Still below the bar, and who should fix it

| gap | what fixes it | who |
|---|---|---|
| Film at full frame looks soft and blocky. The reel files are 960x540 at about 170 kbps. Masked with grain and a capped push-in, but not solved. | Re-export the reel from Higgsfield at 1080p with a high bitrate (or upscale with Higgsfield's video upscaler). Drop the files in `public/media/reel/` and re-run the VP9 encode. | Content (you), then the studio builder |
| Iris reads as a mask wipe more than a fly-through (5-6). | Angle the ring and let its chrome tube sweep past the lens with motion streaks, and put the prints on 2-3 parallax layers in a lit studio. This is an architecture change to the transition, not a tweak. | A new transition builder |
| The prints are cinematic stills, not real customer photos (6). | Use 3-4 real phone photos from an actual client (shopfront by day, product on a counter). | Content (you), then the studio builder |
| Hero chrome: critics disagree between "too dark" and "too lavender" (6). | A material/lighting builder with an HDRI-style environment and a measured target (the reference crop). | Hero builder |
| Reel grid reads as a generic bento (6). | Editorial captions (no. · title · format), stronger scale contrast. | DOM builder |
| On phones, the agent header crosses the fading orb as it leaves. | Anchor the orb to its section (camera offset that follows the scroll). | Agent builder |

## Motion QA (see `film/QA.md`)

- **Recorder:** Playwright fake clock, paused, with one 1/60 s frame per video frame stepped through `__app.step`. (Playwright 1.56's paused clock never fires rAF, so the page hands its loop to the recorder.) Every video is seeked to the same virtual time. Scroll is fed as exact values.
- **Low-res passes and optical-flow scan:**
  - Pass 1 found pinned text jittering ±1 px. Fixed.
  - Pass 2 found a layout jump in the agent chat. Fixed.
  - The remaining flags were explained by phase correlation (scroll at rest; whole-pixel cadence at 1x).
- **Final film:** `film/cozy-1080p60.mp4`, 1920x1080, 60 fps, x264 crf 13, yuv420p, faststart. Its scan is in `film/cozy-1080p60.flags.json`.
- **Frame rate on real hardware was NOT measured.** The build environment has no GPU; WebGL ran on SwiftShader (CPU) at about 0.2-1.3 s per frame. The page has adaptive resolution, quality tiers and lazy chapter builds, but 60 fps on a given laptop or phone still has to be checked on that device.

## Spend

- **Images and video generation: $0.** No Replicate key was available, and no Higgsfield credits were spent without your OK. The 3D is procedural, footage is your existing reel, and the logo is built by code.
- **Agent compute (measured, subagents only):** the four critic rounds used 133k, 153k, 155k and 141k tokens. The smoothing pass used 278k, plus a first attempt that hit a usage limit. The lead session's own tokens weren't metered here.

## Not done (needs your decision or access)

- **Higgsfield model ids:** only the Seedream image id is confirmed. The video ids in `config/models.json` came from public catalogs and are marked unverified. Confirm them on cloud.higgsfield.ai.
- **Billing:** Stripe is not wired up. Credits are granted by plan or by hand in the admin panel.
- **Side-by-side comparison film:** none was made. No reference site recording was requested, and cozydigital.org was blocked by this environment's network policy (the brand came from the `kaysongt/cozydigital-site` repo).
