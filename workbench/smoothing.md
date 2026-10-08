# Smoothing pass: seams between sections

I made one consistency pass over the whole page at 1440x900 and 390x844. I started from the before sheets (`smoothing-before-*.jpg`) and full-size frames of every state (`shots/smooth/before-*`). I also shot in-between scroll positions with Playwright at each seam. Scroll positions below are in vh.

Section tops on desktop: reel 6.80, agent 9.15, pricing 11.45, start 12.70, end of page 12.86. On phones: agent 8.66, pricing 10.96, start 13.35, end of page 14.61.

After sheets: `smoothing-after-desktop.jpg` and `smoothing-after-mobile.jpg`. Frames are in `shots/smooth/after-*`.

## Seam issues found

1. **Eyebrows differ between sections (all states, both sizes).** The "01 · You send" eyebrow (assets) and the "03 · The Cozy Agent" eyebrow (agent) were 17.6px, light grey and sat right on the heading. The hero, 02, 04 and 05 eyebrows are 12px, muted, with a 22px gap. The cause: `.side-copy p` is more specific than `.eyebrow`, so it overrode it. On phones the same rule hid the 03 eyebrow completely (`.agent-grid .side-copy p {display:none}`), so the sections read 01, 02, 04, 05.
2. **assets → dissolve-start (desktop, about 2.9–3.2).** The studio ring started fading in at 2.85, behind the assets copy, which was still on screen. At 3.10 its glowing arc ran straight through "Send us what you already have."
3. **assets → dissolve-start (both sizes, about 3.15–3.45).** "We turn it into film." faded in while it was still scrolling up to where it stops. At 3.30 it was half-visible on top of the main print (desktop) and cut through the ring (phone).
4. **film → film-full (desktop, about 5.4–5.7).** "One photo in. One film out." stayed fully visible after the dissolve section stopped holding it in place. It scrolled up into the film, which was growing at the same time, and at 5.50 it sat on the picture.
5. **film-full → reel (both sizes, about 6.4–6.85).** The film stayed at full brightness until the reel reached the top of the screen. At 6.80 the bottom strip of the film and its rounded card edge showed through the reel's see-through top edge, right under the "02 · Made in our studio" eyebrow.
6. **agent → pricing (desktop about 10.7–11.3, phone about 10.0–10.5).** The agent orb stays fixed on screen. It stayed bright after its section had scrolled away, so the pricing header slid over the orb and its ring (orb at 0.46 brightness under "Video every month," at 11.10). On phones, the agent header crossed the orb as it left (0.81 brightness at 10.10).
7. **pricing → start (desktop about 11.8–12.7; phone about 12.5–13.3).** The closing loop started fading in at 11.80. It showed first behind the pricing cards, then behind "Let's make your first one." (0.75 at 12.40). It only reaches its own clear spot under the copy in the last ~0.15 vh. On phones the same thing happened behind the start header and paragraph, but dimmer.

## What I changed

| # | File:line | Change | Effect (checked by re-shooting) |
|---|---|---|---|
| 1 | `public/css/site.css:70` | `.side-copy p` → `.side-copy p:not(.eyebrow)` | 01 and 03 eyebrows now match 02/04/05 in size, colour and gap |
| 1 | `public/css/site.css:209` | phone hide rule → `.agent-grid .side-copy p:not(.eyebrow)` | 03 eyebrow is back on phones. It sits about 35px below the orb, with no overlap |
| 2 | `public/js/chapters/studio.js:391` | ring starts fading in at `progress[0] - 0.1` (was `- 0.4`) | The ring now starts at 3.15, as the assets copy finishes fading (2.95–3.2). It is at 0.35 when the pixels leave and full at 3.40. At 3.10 there is no ring behind the copy |
| 3 | `public/js/main.js:237-238` | title fades in over `pin[0] - 0.14 … pin[0] + 0.04` (was `-0.35 … -0.05`) | The title fades in as it comes to rest. From about 3.43 it is clear of the print and the ring. At 3.30 it is no longer visible over them |
| 4 | `public/js/main.js:245` | caption fades in over 4.90–5.10 and out over 5.22–5.42 (was 5.00–5.25 and 5.50–5.75) | It appears after the step cards have faded (4.6–4.9), is fully on at the `film` state (5.20), and is gone before it can scroll into the film |
| 5 | `public/js/timeline.js:75` | `reel.dim` `[reel-0.45, reel+0.2]` (was `+0.05, +0.6`) | Film is still full at `film-full` (6.15), down to 0.23 at 6.80, gone at 7.0. The reel header now sits on dark ground |
| 6 | `public/js/timeline.js:90` | `agent.exit` `[pricing-1.1, pricing-0.55]` (was `-0.75, 0`) | Desktop: orb at 0.92 when the agent section starts scrolling away, 0.03 when the pricing header reaches it (10.85), gone by 11.10. Phone: 0.60 / 0.32 at 10.10 / 10.20 (was 0.81 / 0.53) |
| 7 | `public/js/timeline.js:95` | `start.enter` `[start-0.25, start+0.15]` (was `-0.9, -0.1`) | No longer behind the pricing cards. Desktop: 0.13 behind the start header at 12.50, fully on at the `start`/`end` states. Phone: fades in mostly while the form covers it |

Checks: `npm test` 16/16 pass; `node tools/check-timeline.mjs` passes (exit 0). I did not change any camera keys or pin numbers.

Visible differences in the named states: smaller eyebrows in `assets` and `agent`; 03 eyebrow shown in phone `agent`. The `dissolve-start` title is at 0.87 opacity (it reaches full at 3.54). In `reel` the WebGL layer is empty, because the film has already faded out.

## What I deliberately left alone

- **The closing loop still overlaps the start paragraph a little** (desktop about 12.55–12.70 at roughly 0.4–0.6 strength; phone about 13.2, dim). This is geometry: to reach its final place, the copy has to scroll through the loop's spot. Removing it completely would take a fast fade (which reads as a pop) or a loop that moves with the page (new motion). Also, one `start.enter` setting serves both sizes, but the page ends 0.16 vh past the start top on desktop and 1.26 vh past it on phones.
- **Phones: the agent header still crosses the dimming orb (about 10.0–10.3).** The orb is fixed while its section scrolls away. Fading it any sooner would dim it on desktop while the conversation is still on screen. A real fix is anchoring the orb to its section (a camera offset that follows the scroll), which is new motion, so I didn't do it.
- **Desktop end of page: "Let's make your first one." is partly under the nav at the bottom of the page.** The form plus footer is taller than the screen minus the header, so it is normal page scrolling. Fixing it means changing the layout of the start section or the form.
- **At film-full, the reel header rises over the bottom of the full-frame film** (both sizes). It sits on the reel's own dark fade and reads as a deliberate curtain into the reel. As a result, the `film-full` state always includes the reel header.
- **reel → agent-enter (desktop about 8.4–8.9):** the last reel row plus scattered pixels before the agent copy appears. That is the designed swarm arrival, and the agent copy appears on the same schedule as the assets copy.
- **iris → assets (about 1.55–1.95):** the prints are on screen without copy, and the lower half is empty on phones. It is an establishing beat, and the copy timing matches the other sections.
- **The agent heading wraps to 4 lines on desktop** (460px column) where other section headings take 2. The font size is the same; the column can't fit "Your own creative" at 80px.
- **The dissolve title is held a little shorter** (3.54–3.82, was 3.45–3.82). I didn't move `titleOut`, so the title still clears before the ring rises into its band.
- **`pricing` and `start` states show their headings clipped by the nav.** That comes from where the states sit, not the page; on desktop `start` is almost the same as `end`. I didn't touch the state list or tools/.
- **`T.film.handoff` in timeline.js isn't used anywhere.** I left it in place.
- **Stale comment at timeline.js `start.frame`:** it says the phone loop sits at the "top of the screen (dimmed)", but `portraitNdcY: -0.36` puts it in the lower part. Left as is.
