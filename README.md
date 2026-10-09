# Cozy Hub 2.0

The Cozy Digital AI-video product: a photographic landing page with a CSS letter
ring and a shared scroll clock, an admin panel that talks straight to the
Higgsfield API, and the **Cozy Agent**, our branded creative agent on top of
Higgsfield's Agent API.

## Run locally with WSL and SSH

The finished landing page is on `codex/cozy-cinematic-landing-20261009`, branched
from `claude/zen-dirac-16uhgf`. Run these commands **inside Ubuntu / WSL**, with
GitHub SSH access and [nvm](https://github.com/nvm-sh/nvm) already configured:

```bash
mkdir -p ~/projects
cd ~/projects
git clone --depth 1 --single-branch \
  --branch codex/cozy-cinematic-landing-20261009 \
  git@github.com:ElvinLearning/cozy_hub2.0.git cozy-digital
cd cozy-digital
nvm install
nvm use
npm test
npm start
```

Open **http://localhost:8080** in your Windows browser. The admin panel is at
**http://localhost:8080/admin/**. If `ADMIN_PASSWORD` is unset, the server prints
a one-time admin password at startup. Stop the server with **Ctrl+C**.

**[Full WSL, SSH, and local development guide](docs/LOCAL_DEVELOPMENT.md)** —
includes first-time setup, restarting, updating, and troubleshooting.

`.nvmrc` selects Node 24; the app supports Node 20+. There are zero runtime
dependencies and no build step. **You do not need `npm install` or a Higgsfield
API key to preview the site or run its tests.** The finished video loops,
posters, portraits, fonts, and logos are included in the repository. Local
leads and uploads stay in the Git-ignored `data/` directory.

## What's here

| Path | What it is |
| --- | --- |
| `public/index.html`, `public/css/site.css` | Landing page: six chapters, native page flow, responsive layouts. |
| `public/js/main.js`, `landing-motion.js`, `media.js` | Plain ES modules for the shared motion clock, navigation, and visible-only video playback. No WebGL or animation library is loaded. |
| `public/js/dom.js` | Existing pricing, lead form, uploads, and reel contracts. |
| `public/media/cozy/` | Higgsfield scene options, current posters, historical tribute portraits, and asset provenance. |
| `public/admin/` | Admin panel: generate, jobs, Cozy Agent chat, customers + credits, leads, pricing. |
| `server/` | `node:http` server: static files with byte ranges, the admin API, Higgsfield client, JSON store. |
| `config/plans.json` | **Pricing.** The landing page loads the current plans through `GET /api/plans`. |
| `config/models.json` | Higgsfield model ids, starting arguments and credit cost per model. |
| `tools/` | Mock Higgsfield, tests, screenshot / film / optical-flow / timeline tools, logo builder. |
| `workbench/` | Builder/critic rounds, scores, reference crops, art bible, motion QA. Open `workbench/index.html`. |

## Environment

Supply secrets through your host's environment settings or the process
environment. Keep API keys out of files and source control. `.env.example`
documents the variable names without live credentials.

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

### Cozy customer credits

In the customer ledger, 1 credit means 1 finished video. These are separate
from the Higgsfield billing credits recorded for landing-page asset creation.
Rules:

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
npm run dev                    # restart the Node server when watched modules change
npm run mock:hf                # mock API on :8787 -> HF_KEY=mock:mock HF_BASE_URL=http://127.0.0.1:8787 npm start
npm run logo                                 # rebuild the SVG marks from Quicksand outlines
```

Refresh your browser after editing frontend files; `npm run dev` does not add
browser hot reload. Logo and vendor maintenance tools need the optional
development packages (`npm ci`). The historical `node tools/smoke-admin.mjs`
browser check additionally requires Playwright and its browser binaries; it
is not part of the dependency-free local start or `npm test`.

### How the landing page works

- **One clock.** `landing-motion.js` has one animation-frame chain. It reads
  native scroll position, computes chapter progress, and updates the letter
  ring, hero zoom and crossfade, content reveals, and optional portrait drift.
  Desktop wheel input is eased only for a fine pointer with hover support.
  Touch and keyboard scrolling use the browser's native page flow.
- **CSS ring.** The accessible heading keeps its name while decorative glyphs
  are hidden from assistive technology. Glyph widths are measured after local
  fonts load and converted into angles. A ResizeObserver refreshes geometry.
  The radius, perspective, tilt, intro and revolution settings follow the
  supplied design study and brief.
- **Chapters.** Hello, How it works, Reel, Cozy Agent, Pricing, and Start.
  Scrolling out of the sticky hero zooms toward the cocoa; How it works fades
  over the scene. The bottom chapter disclosure supports keyboard navigation,
  Escape, and destination-heading focus.
- **Media.** `media.js` uses IntersectionObserver to load and play visible
  muted, inline videos. MP4 has a WebM fallback. The hero has separate phone
  sources. The shared scroll clock combines chapter crossfades and every
  containing card's reveal opacity, so invisible media cannot keep playing.
  Posters remain visible while a source is pending or unavailable.
- **Reduced motion.** The ring holds still, all video sources unload to their
  posters, wheel easing stops, reveals are readable, and the chapter transition
  is a crossfade. The on-page motion control can also pause animation.
- **Our inspirations.** The footer button or typing `cozy` outside a form opens
  an accessible dialog with six AI-created historical tribute portraits.
  Portrait links point to institutional biographies. Hovering or focusing a
  portrait pauses the drift; phone and reduced-motion layouts stay still.
- **Existing contracts.** `dom.js` still loads `/api/plans`, fills pricing and
  the plan selector, and posts the original lead fields before uploading files.
  The backend, admin panel, plan values, shared tokens, logos and reel files
  are preserved.

The older WebGL study modules, vendored resources, and `tools/shoot.mjs`,
`tools/film.mjs`, and `tools/check-timeline.mjs` are retained as historical
workbench material. Their old `window.__app` capture hooks are not the current
landing-page interface.

### Landing media

The user approved option B for all five scenes. Their Higgsfield Kling 3.0 Pro
loops are integrated as `hero`, `send`, `make`, `agent`, and `closing`, with a
separate `hero-mobile` 4:5 crop. Each has H.264 MP4, VP9 WebM, and a JPG poster
extracted from its first decoded frame. Landscape files measure 1920×1080;
the phone crop measures 1080×1350. Every video contains 120 frames at 24 fps
for exactly five seconds, with no audio stream. Each web file is below 3 MB.
Matching source images and a short local endpoint crossfade smooth the repeat
boundary, including the moving steam in the café shots.

Both original A/B still options and their two hero phone crops remain in
`public/media/cozy/options/`. `asset-ledger.json` records generation prompts,
model settings, source job IDs, public portrait references, measured file
sizes and hashes, and the exact total generation debit: 71.5 credits
(34 for stills including portraits, plus 37.5 for the five video jobs).
No paid retries were used. The existing reel files remain unchanged.

Video plays H.264 MP4 where the browser has it, with VP9 WebM next to every clip
for browsers that don't (open-source Chromium).

## Deploying

This needs a Node host (Render, Fly, Railway, a VPS). It can't go on GitHub
Pages, because the API and the Higgsfield keys must stay server-side. Set the
env vars, point `PUBLIC_URL` at the domain, and persist `DATA_DIR` on a volume.
