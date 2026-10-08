# Cozy Hub 2.0

The Cozy Digital AI-video product: a scroll-driven three.js landing page that
sells monthly AI video to businesses, an admin panel that talks straight to the
Higgsfield API, and the **Cozy Agent**, our branded creative agent on top of
Higgsfield's Agent API.

```bash
npm start            # http://localhost:8080 (landing) and /admin/
```

Node 20+. Zero runtime dependencies, no build step. If `ADMIN_PASSWORD` is not
set, a one-time password is printed when the server starts.

## What's here

| Path | What it is |
| --- | --- |
| `public/index.html`, `public/js/`, `public/css/` | Landing page. Raw three.js (vendored, ES modules + importmap). |
| `public/admin/` | Admin panel: generate, jobs, Cozy Agent chat, customers + credits, leads, pricing. |
| `server/` | `node:http` server: static files with byte ranges, the admin API, Higgsfield client, JSON store. |
| `config/plans.json` | **Pricing.** Every price on the landing page and every credit grant reads from here. Draft numbers. |
| `config/models.json` | Higgsfield model ids, starting arguments and credit cost per model. |
| `tools/` | Mock Higgsfield, tests, screenshot / film / optical-flow / timeline tools, logo builder. |
| `workbench/` | Builder/critic rounds, scores, reference crops, art bible, motion QA. Open `workbench/index.html`. |

## Environment

Copy `.env.example` to `.env` (never commit it). Keys live in env vars only.

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Admin sign-in. |
| `SESSION_SECRET` | Signs admin cookies. If unset, a random one is used and sessions reset on restart. |
| `HF_KEY` | `key_id:key_secret` from cloud.higgsfield.ai (or `HF_API_KEY` + `HF_API_SECRET`). |
| `HF_BASE_URL` | Defaults to `https://api.higgsfield.ai`. |
| `PUBLIC_URL` | Your https origin. Turns on Higgsfield completion webhooks; without it the server polls every 15 s. |
| `DATA_DIR` | Where the JSON store and uploaded client assets live (default `./data`). |

## Higgsfield

The client in `server/higgsfield.mjs` mirrors the official SDK (`higgsfield-client` 0.2.0):

- `POST /{model_id}` with the model's arguments returns `request_id`, `status_url` and `cancel_url`.
- `GET /requests/{id}/status` returns one of `queued`, `in_progress`, `completed`, `failed`, `nsfw` or `canceled`.
- `POST /files/generate-upload-url` returns presigned uploads for images and video.
- Agent API: `/v1/agent/sessions`, messages, interrupt, media.
- Auth is `Authorization: Key id:secret`.

Model **arguments differ per model**. Only `bytedance/seedream/v4/text-to-image`
was confirmed from the SDK docs. The video ids in `config/models.json` came from
public catalogs and are marked `verified: false`. To confirm one:

1. Open its page on cloud.higgsfield.ai.
2. Copy the exact id and request body into `config/models.json`.
3. Set `verified: true`.

The admin panel's **Raw JSON** mode sends any model id and body unchanged.

### Credits

1 credit means 1 finished video. Rules:

- Each plan grants its monthly credits when you assign it to a customer.
- A generation charges the model's `credits` from `config/models.json`.
- Failed, NSFW and cancelled jobs are refunded once.
- The Cozy Agent charges `agent.creditsPerAsset` per delivered video.

Every movement is recorded in the ledger. Billing (Stripe) is not wired up yet.
Renewals are a "± credits" click in Customers for now.

### Cozy Agent

A Higgsfield Agent API session that opens with our brief (`server/agent.mjs`).
The brief carries the house style, deliverable rules (9:16 + 16:9, hooks first,
no invented claims) and the customer's brand file. The admin runs the chat, the
agent plans and generates, and the URLs it returns play inline.

## Development

```bash
npm test                       # API tests against the mock Higgsfield (16 tests)
node tools/smoke-admin.mjs     # admin panel end to end in a real browser
npm run mock:hf                # mock API on :8787 -> HF_KEY=mock:mock HF_BASE_URL=http://127.0.0.1:8787 npm start
node tools/shoot.mjs <dir> 1440 900          # screenshot every named state
node tools/film.mjs --out film.mp4           # frame-perfect 60 fps film of the full scroll
python3 tools/flowscan.py film.mp4           # optical-flow jump scan (needs opencv-python-headless)
node tools/check-timeline.mjs                # numeric camera / pin checks
npm run logo                                 # rebuild the SVG marks from Quicksand outlines
```

### How the landing page works

- **One clock.** Native scroll sets a target, and a critically damped spring
  follows it (`public/js/scroll.js`). The DOM is translated by that value, and
  every WebGL chapter reads the same number in the same frame.
- **One timeline.** Every scroll-keyed number, in viewport heights, lives in
  `public/js/timeline.js`. Pins ease in and out (`pinOffset`).
- **Chapters.** Each chapter renders into its own half-float target: the loop
  (hero), the studio (the signature photo → pixels → film) and the agent. One
  composite pass mixes two chapters with a ring iris or a pixel mosaic, then
  runs a bloom pyramid, an ACES shoulder, sRGB and a static dither
  (`public/js/gfx/pipeline.js`).
- **Isolation.** A chapter that throws is switched off; the page keeps working.
  Without WebGL the page is a static gradient. `prefers-reduced-motion` gives
  instant scroll and still frames.
- **Capture hooks.** `window.__app` exposes the layout, named states, `goto`,
  `setScroll`, `step`, `seekMedia` and `skipIntro`. Debug output only appears
  with `?debug`.

Video plays H.264 MP4 where the browser has it, with VP9 WebM next to every clip
for browsers that don't (open-source Chromium).

## Deploying

This needs a Node host (Render, Fly, Railway, a VPS). It can't go on GitHub
Pages, because the API and the Higgsfield keys must stay server-side. Set the
env vars, point `PUBLIC_URL` at the domain, and persist `DATA_DIR` on a volume.
