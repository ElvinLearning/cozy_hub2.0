Rebuild the landing page for Cozy Digital in the GitHub repo `elvinlearning/cozy_hub2.0`. Make a new branch from `claude/zen-dirac-16uhgf`, which holds all of the finished work. Use Higgsfield to make the photos and video loops. I've attached a PDF, "Shopify Spring 2026 Design Engineering Study". Use it as the layout and motion reference. Ignore the branch `claude/cozy-warm-theme`. It is a rejected illustrated attempt.

## What the business is
Cozy Digital makes short AI videos for small businesses. A customer sends a few photos of their shop. We turn them into 5-10 s clips for their socials using the Higgsfield API, and people check every clip. Plans start at $40/mo. There is also a premium "Cozy Agent" plan.

## What already exists (keep it, don't rebuild it)
- `server/`: a Node server with no dependencies, the Higgsfield API client, the Cozy Agent, leads and uploads.
- `public/admin/`: the admin panel.
- `config/plans.json`: pricing. The page reads it from `GET /api/plans`. Don't change the numbers.
- `public/js/dom.js`: pricing cards, the lead form and lazy videos. Keep these element ids so it still works: `plans`, `packs`, `lead-plan`, `hero-price`, `lead-form`, `lead-files`, `dropzone`, `picked`, `lead-msg`, `lead-submit`. The `POST /api/leads` fields are `name`, `email`, `business`, `website`, `plan`, `message`, plus the honeypot `company_site`.
- `public/brand/`: the logo (`cozy-logo-horizontal.svg`, `cozy-mark.svg`, `cozy-icon.svg`, favicon). Use these logo files. Do not use the `*-warm.svg` variants.
- `public/media/reel/`: the existing reel clips (mp4 and webm, with jpg posters). Use them in the reel section.
- `npm test` has to keep passing (16 tests).

## Colours: use the existing Cozy Digital scheme exactly (`public/css/tokens.css`)
- Background `#08090b`, second background `#0c0d11`, panels `#141619` / `#1a1d21`
- Text `#edf0ed`, muted text `#a0a6a2`, dim text `#6b716d`, lines `#ffffff1f`
- Brand: violet `#c084fc`, indigo `#818cf8`, cyan `#67e8f9` (the main accent), deep cyan `#22d3ee`
- Brand gradient: `linear-gradient(90deg, #c084fc, #818cf8 50%, #67e8f9)`
- Fonts (already in `public/fonts/`): Inter Tight for headings, Inter for body text, Instrument Serif italic for accent words, Quicksand for the brand.
- Don't introduce new brand colours. The warmth comes from the photos, not the UI.

## The look: cozy, but real
- No illustrations, cartoons, flat vector art, or stylised or "artsy" rendering. Everything visual is photoreal and cinematic, generated with Higgsfield.
- Cozy subjects: cute animals (a cat asleep on a knitted blanket, a puppy curled up), cozy people (friends under a blanket, a café owner handing over a hot chocolate), steaming hot chocolate with marshmallows, chunky knit blankets, fairy lights, snow outside a window.
- Lighting rule, so the photos sit on the dark page: warm lamp, candle and fireplace light inside, cool blue night and snow outside. The cool outside light ties the photos to the cyan and indigo UI. Use deep shadows and dark backgrounds in every shot. No bright white or pastel scenes.

## Higgsfield assets (budget first)
1. Check my credit balance. Pick a photoreal image model and an image-to-video model with `models_explore`, then show me a cost estimate for the whole list below. Wait for my OK before you generate anything. Stop and ask if credits run low.
2. Generate stills first, 2 options per shot. Show them to me, then animate only the ones I pick into seamless 5 s loops.
   - Hero, 16:9 plus a 4:5 crop for phones: a ginger cat asleep on a cream chunky-knit blanket in an armchair by a frosted window at night. Snow is falling outside in blue moonlight, a mug of hot chocolate steams on a side table, and a lamp glows warm. Shot as a slow push-in.
   - "You send": a phone on a café counter showing a photo of the shop, warm bokeh behind it.
   - "We make": the same café, now a moving shot. Steam rises off cocoa and fairy lights twinkle.
   - Cozy Agent: a cosy desk at night, with a laptop, a sleeping kitten next to it, a candle and a knit throw.
   - Closing: two friends and a dog under one blanket on a couch, fairy lights behind them, snow at the window.
3. Save the files to `public/media/cozy/`. Make web encodes: mp4 (H.264) and webm (VP9), 1080p, plus a jpg poster for each. Keep each file under about 3 MB.

## Layout and motion (from the PDF)
- **Hero:** the hero video fills the screen behind everything, with a dark gradient over it for legibility. A real CSS 3D ring of letters, "Cozy Digital · " ×3, orbits in front of it:
  - split the words into spans, measure the glyph widths after `document.fonts.ready`, and turn the widths into angles around the circle;
  - radius 37vmin, perspective 5400px, tilt 18°, one turn every 150 s, a 4.5 s intro, and recompute on resize with a ResizeObserver;
  - colour the letters with the brand gradient or `#edf0ed`;
  - the h1 holds the accessible name and the letter spans are `aria-hidden`.

  Beside the ring: a big left-aligned headline, one short paragraph, "Start with 5 videos" and "Watch the reel" buttons, and "Plans from $40 a month" (filled in by `dom.js`).
- **Chapters:** 01 Hello, 02 How it works (send, we make, you post), 03 Reel, 04 Cozy Agent, 05 Pricing, 06 Start (the form), then the footer. Each chapter has a large left-aligned heading with a narrower copy column next to it.
- **Navigation:** a floating pill at the bottom shows the current chapter and expands into the chapter list. It must work with the keyboard, close on Esc, and move focus to the section you jump to.
- **One scroll clock:** a single rAF loop reads the scroll position, works out each chapter's progress, and drives every animation from it. Add wheel smoothing on desktop only (a small Lenis-style module, no library). Leave touch scrolling native.
- **One signature transition:** scrolling out of the hero pushes the camera into the steaming mug, and the next chapter fades up out of the steam. Do it with a CSS transform and a crossfade on the hero video, with no WebGL.
- **Videos:** play only when on screen (IntersectionObserver), always `muted playsinline`, with a poster frame.
- **`prefers-reduced-motion`:** the ring holds still and its letters fade in, the videos show their posters, and the transitions become plain crossfades. All the content must still read with animation off.
- No three.js and no heavy libraries. Use plain HTML, CSS and ES modules in `public/`.

## Rules
- API keys stay in environment variables. Never put a key in a file or print it.
- Only state numbers you actually measured (frame rate, timings, file sizes, credits spent).

## Check it before you finish
- Run `npm start` and open http://localhost:8080. Take Playwright screenshots of every chapter at 1440×900 and 390×844. Look at them yourself and fix anything ugly, cramped or unreadable. Do a second pass.
- The browser console must be clean. `npm test` must still pass. Check the page again with reduced motion turned on.
- Commit and push to your branch. Then tell me:
  - the branch name,
  - the screenshots,
  - the exact Higgsfield credits spent,
  - anything that is still rough.
