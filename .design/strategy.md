# Brand strategy — DailyTodo

<!-- Written by the brand-strategist agent (directions mode, scaffold context), 2026-10-01.
     Inputs: .design/brief.md (Answers section is authoritative), .design/research/{repo,patterns,ecosystem}.md.
     Previews: .design/directions/index.html (A, B, C). The rejected "Ember Journal" is deliberately avoided. -->

## Positioning
For **one person with ADHD who builds software and makes content** and needs to start the day without friction, DailyTodo is a **personal desk notebook for today** that already knows what carried over, what matters, and what this minute is for. Unlike Things or Notion (calm but neutral, or busy), and unlike Tiimo (friendly but a planner, not a notebook), it keeps **the list, the page and the clock on one sheet** — and speaks both English and Bengali as a first language.

## Customer
- Primary: the owner (Ali) — developer + content creator in Bangladesh; Mac at a desk, phone while out; writes notes in Bengali and Banglish often. (confident — brief)
- Job to be done: *When I sit down with a full head, I want to see only today — the few tasks that matter, a place to dump thoughts, and what I should do right now — so I can start without friction and not lose anything to forgetting.*
- Fears: busy dashboards, too many decisions, guilt when a plan slips, losing a thought, setup before value.
- Aspirations: calm control of today; ideas that actually become published content; a tool that feels personal and crafted, not SaaS.
- Products they love: Tiimo (reference feel), Bear, bullet journal, Apple Reminders inline add, Trello boards.

## Personality
- Archetype: **Caregiver** (+ **Sage**) — protects attention, explains gently, never judges.
- Feel: **calm · friendly · focused · encouraging** · Never: **busy · judgy · childish**
- Sliders: Serious 3/5 Playful · Classic 3/5 Modern · Calm 2/5 Energetic · Premium 3/5 Accessible · Dense 3/5 Airy
  - Each direction moves one or two sliders on purpose (see table below); none goes past 4 on Playful or Energetic.

## Market
| Alternative | Look | Lesson |
|---|---|---|
| Tiimo | Soft pastel blocks on dark, rounded type, ring timers | Color can sort a day before words do; keep it soft |
| Things 3 | White/gray, blue accent, very refined | Restraint reads as calm |
| Bear | Warm paper, red accent, typographic | Editor-first, text as hero |
| Sunsama / Amie | Pastel accents, rounded, "mindful" | The ritual matters more than features |
| Notion | Gray, dense, neutral | What to avoid: busy, generic |
| Paper bullet journal | Dot grid, ink, highlighters, stickers, washi tape | The soul to keep |

- Strategy: **stand out gently.** No market to win — "standing out" means *feels like mine*. Borrow Tiimo's friendliness, keep the notebook's physical details, avoid the generic blue/purple SaaS look.

## Design implications (all directions)
- **Color:** dark is designed first; backgrounds are deep and *tinted* (never pure black, never cold slate), L 0.18–0.20. One action accent used only for primary actions, focus and the Now card (isolation effect → "what do I do next" is always obvious). Priorities get **three soft hues with fixed roles**, always paired with a signifier and word (`!! Must do`, `! Should do`, `~ Could do`) — never color alone. Carryover age is **never red**.
  *Because* the user reads the app for hours, often at night, and needs one unmistakable next action without alarm colors.
- **Type:** a Latin face + a Bengali face chosen **as a pair**, both loaded through `next/font` (`subsets: ["latin"]` / `["bengali"]`), Bengali lines at line-height ≥ 1.7, and a `size-adjust` on the Bengali face so mixed lines look even. Text never below 13px. Mono only for times, estimates and small annotations.
  *Because* Bengali is written often and today falls back to a random system font.
- **Shape / depth / motion:** rounded but not bubbly; depth by lighter surfaces in dark, not heavy shadows. Motion 160–220ms ease-out, opacity/transform only, no springs, all off under reduced motion. Motion clarifies state (task checked, card moved, Now updated), never decorates.
  *Because* ADHD attention is pulled by movement — only meaningful change should move.
- **Voice:** plain, kind, a little coach-like; sentence case; no guilt ("3 days waiting", not "overdue"); errors say what is safe first ("saved on this device").
- **Patterns:** low-stakes delete = instant + **Undo toast**; big deletes (workspace, folder, column) keep a confirm dialog. Cache-first: no spinner over a notebook page.
- **Signature details (shared, styled per direction):**
  1. **Now card** — one component for the Planner NOW block and the Focus timer (`task` and `block` variants): label, title, time left, progress, next up.
  2. **Carryover margin note** — "From yesterday" / "N days waiting" in the row's margin; grows in weight, never in color.
  3. **Content stage track** — `Inbox › Develop › Shoot next › Published` with the current stage stamped, `N/5` soft cap on Shoot next.

## Not doing (the rejected Ember Journal)
No cream + espresso, no terracotta, no Fraunces or any serif headings, no ink-dark Now card on a light page. All three directions below differ from it in background hue, accent, type and signature.

## The three directions

| | A · Night Lagoon | B · Pocket Stickers | C · Highlighter |
|---|---|---|---|
| Feel | calm, clear, quietly kind | friendly, colorful, light | focused, crisp, notebook-bold |
| Sliders moved | Calm 1/5, Playful 2/5 | Playful 4/5, Airy 4/5 | Energetic 3/5, Dense 2/5 |
| Dark background | ink-teal `oklch(0.185 0.026 222)` | plum night `oklch(0.195 0.03 300)` | graphite `oklch(0.18 0.008 105)` |
| Accent (dark / light) | mint `oklch(0.80 0.12 170)` / jade `oklch(0.53 0.10 172)` | lilac `oklch(0.80 0.10 295)` / violet `oklch(0.52 0.15 295)` | highlighter lime `oklch(0.90 0.19 125)` both, ink-outlined |
| Priorities | coral / honey / sky dots | peach / butter / mint stickers | pink / tangerine / sky highlights |
| Heading · body · Bengali | Figtree · Figtree · Hind Siliguri | Baloo Da 2 · Nunito · Baloo Da 2 | Bricolage Grotesque · Anek Latin · Anek Bangla |
| Mono | JetBrains Mono | DM Mono | IBM Plex Mono (+ italic) |
| Radius · density | 12px · comfortable | 16–24px · airy | 6px · compact |
| Now card | "tide" fill across the card | pastel block + ring timer | lime block, ink outline, ink bar |
| Carryover note | mint text + ↳ in the margin | washi-tape tag | pencil-mono italic annotation |
| Note page | faint ruled lines | rounded white page card | dot grid |

### Direction A: "Night Lagoon"
- **One-liner:** deep ink-teal water at night with one mint light — the calmest page to start from, grown out of today's teal and app icon.
- **Language:** soft modern (restrained) + ruled notebook page + the "tide" Now card.
- **Palette:** primary mint `oklch(0.80 0.12 170)` with dark ink text (dark), jade `oklch(0.53 0.10 172)` with white text (light); neutrals tinted hue 222; priorities coral 25 / honey 80 / sky 235; Now card deep lagoon `oklch(0.285 0.05 195)` with a mint waterline.
- **Type:** Figtree 600 headings / 400 body, Hind Siliguri for Bengali (size-adjust ≈ 1.06), JetBrains Mono for times; UI ratio 1.2, marketing 1.25.
- **Shape:** radius 12px, 1px low-contrast borders, depth by lighter surfaces, one soft shadow level.
- **Motion:** 200ms ease-out; the tide fill moves linearly with time; checked tasks settle.
- **Imagery & icons:** lucide at 2px stroke, no illustration.
- **Voice:** calm, clear, kind. Button "Start focus". Empty "Nothing here yet. Add one small thing to start."
- **Wordmark:** Figtree 700 lowercase `dailytodo`, −0.035em; mark = rounded page + check + one wave.
- **Why it works:** restful for long night sessions; one accent answers "what next"; continuity with the existing teal lowers change cost.
- **Risks:** closest to a "normal" dark app → the ruled page and tide carry identity. Hind Siliguri runs small → size-adjust.

### Direction B: "Pocket Stickers"
- **One-liner:** a plum night notebook with pastel sticker tabs — Tiimo-friendly color that makes today look light and doable.
- **Language:** soft modern / playful (toned down) + sticker tabs, washi-tape carryover, ring-timer Now block.
- **Palette:** primary lilac `oklch(0.80 0.10 295)` with dark ink (dark), violet `oklch(0.52 0.15 295)` with white (light); neutrals hue 300; priority stickers peach 45 / butter 95 / mint 165 with dark ink text; group blocks are plum tinted 16% toward their sticker hue (dark) or pastel washes (light).
- **Type:** Baloo Da 2 600–700 headings (Bengali + Latin in one family), Nunito 400 body with Baloo Da 2 as Bengali fallback, DM Mono for times; ratio 1.25.
- **Shape:** radius 16px controls, 22–26px panes, pill buttons, soft plum-tinted shadow on the Now block.
- **Motion:** 200ms ease-out, 0.97 press on stickers/buttons, ring drains smoothly, "stamp" fade on done. No springs.
- **Imagery & icons:** lucide 2px, rounded caps; optional tiny sticker shapes, no mascot.
- **Voice:** friendly, encouraging, light. Button "Start this one". Empty "A fresh page. What's one thing for today?"
- **Wordmark:** Baloo Da 2 700 lowercase; mark = stacked sticker circle with a check.
- **Why it works:** color sorts the day before reading; pastels on plum stay soft at night; one family covers both scripts evenly.
- **Risks:** can feel childish on heavy days → color only on tabs, tape, Now; task text stays plain. More tokens → exactly three hues, fixed roles.

### Direction C: "Highlighter"
- **One-liner:** a graphite dot-grid journal and a pack of highlighters — the most notebook, the most focused; one lime stroke marks what matters now.
- **Language:** bullet-journal grotesque + highlighter swipes + ink-outlined controls.
- **Palette:** highlighter lime `oklch(0.90 0.19 125)` with dark ink text in both modes, always with a 1.5px ink outline in light (lime vs paper is only 1.2:1); near-neutral graphite neutrals (hue 105, chroma 0.008); priority highlights pink 355 / tangerine 65 / sky 225 behind ink text.
- **Type:** Bricolage Grotesque 600 for dates and titles (Bengali falls back to Anek Bangla 600), Anek Latin + Anek Bangla body (one superfamily, matched rhythm), IBM Plex Mono (+ italic) for times and pencil notes; ratio 1.2 UI, 1.333 marketing.
- **Shape:** radius 4–6px, square checkboxes, hand-cut highlighter shapes (uneven corner radii), no shadows.
- **Motion:** 160ms ease-out; a 220ms left-to-right highlighter swipe when a task becomes Now or a card changes stage; pen strike on done.
- **Imagery & icons:** lucide 2px; dot-grid texture on the page only.
- **Voice:** direct, focused, honest. Button "Highlight next". Empty "Blank page. Write the one thing that matters."
- **Wordmark:** Bricolage 700 lowercase, −0.045em; mark = slanted highlighter swipe with a check.
- **Why it works:** a highlighter is how ADHD brains already rescue focus on paper; compact density shows more of the day to a fast scanner; one superfamily makes Bangla and English feel native together.
- **Risks:** lime has no edge in light mode → ink outlines, lime never used as text. Grotesque + mono could feel techy → mono limited to numbers and notes, pastel highlights keep it friendly.

### B2 revision — "Pocket Stickers — Deep" (2026-10-01)
Feedback: liked A's depth most, chose **B, but much darker**. Preview: `.design/directions/B2-pocket-stickers-deep.html`.
- **Kept:** plum family, lilac accent, peach/butter/mint sticker tabs, washi-tape carryover, ring-timer Now block, Baloo Da 2 + Nunito + DM Mono, airy shapes, copy, and the whole light theme.
- **Dark changed:** page `oklch(0.195 0.03 300)` → near-black plum `oklch(0.145 0.024 300)` (darker than A's 0.185); surfaces step only ~0.03 (card 0.175, popover 0.20, muted 0.215, border 0.24). Primary lilac 0.80 → `oklch(0.78 0.10 295)`. Stickers dimmed ~0.05 L (peach `0.78 0.075 45`, butter `0.84 0.085 95`, mint `0.79 0.075 165`) so they read as paper, not neon. Group washes are dark and hue-leaning (rose 355 / taupe 75 / teal 205 at L ≈ 0.22) instead of bright plum mixes. The Now block is no longer a bright lilac slab: deep lilac `oklch(0.285 0.075 295)` with light text and a lilac ring/bar `oklch(0.80 0.10 295)` — the ring is now the glow.
- **Depth without light surfaces:** 1px hairline rims (foreground ~6%) on panes and the pill nav, a lilac rim + soft black shadow on the Now block (dark only).
- **Why:** night use for hours; near-black with quiet steps is the "depth" the user liked in A, while stickers keep B's friendliness. All pairs pass AA (`_source/build-tokens.mjs`, entry `B2`; dark seed `palette.mjs "oklch(0.78 0.1 295)" --keep-seed --tint 0.022 --json`).

## Token provenance
Accent, status and chart tokens come from `palette.mjs` (skill `brand-design/scripts`), run per direction and mode:
- A: `palette.mjs "oklch(0.80 0.12 170)" --keep-seed --tint 0.02 --json` (dark) · `palette.mjs "oklch(0.53 0.10 172)" --tint 0.02 --json` (light)
- B: `palette.mjs "oklch(0.8 0.1 295)" --keep-seed --tint 0.022 --json` (dark) · `palette.mjs "oklch(0.52 0.15 295)" --tint 0.022 --json` (light)
- C: `palette.mjs "oklch(0.9 0.19 125)" --keep-seed --tint 0.006 --json` (both modes)

Neutrals were re-tinted to each direction's own hue and lightness, and product tokens were added (`--p1..3`, `-on`, `-soft`, `-ink`, `--now-*`, `--margin-ink`, `--rule`). Every text/background pair — including priority text on tints, Now card text, margin notes, focus ring and input borders — passes WCAG AA in light and dark (checked with the skill's `color.mjs`). The only advisory is C's lime button edge in light mode, handled by the ink outline. Final tokens: `.design/directions/_source/tokens.json`.

## Open questions for the user
1. Which direction — or which mix (e.g. "B's colors with C's Now card")?
2. Keep the current teal/app icon equity (favours A), or is a new accent welcome?
3. Density: comfortable (A), airy (B) or compact (C) for the Todos list?
4. Rounded display type for headings (B) vs. a characterful grotesque (C) vs. one calm sans (A)?
