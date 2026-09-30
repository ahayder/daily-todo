# Brand strategy — DailyTodo

<!-- Written by brand-strategist (directions mode). Tags: (confident — source) or (guess). -->

## Positioning
For **ADHD adults and creators** who lose the thread between days and feel judged by long lists, **DailyTodo** is a **calm daily workspace** (todos + a daily note + a day plan + a content conveyor) that **carries today forward for you and always shows what matters now**. Unlike Things, Notion or Sunsama, it is built around one gentle day at a time: nothing is lost overnight, nothing shouts, and there is always one obvious next step.

## Customer
- **Primary:** ADHD adult / solo creator (video, writing, freelancing). Plans at a desk in the morning on a Mac, captures on a phone during the day, glances at "now" between tasks. Tech-comfortable but easily overwhelmed by options. (confident — brief answers: public product, ADHD adults/creators)
- **Job to be done:** When I sit down to start (or restart) my day, I want to see what's left, what I'm doing now, and dump new thoughts without friction, so I stay on track without feeling behind.
- **Fears:** losing tasks; overdue lists that feel like judgment; clutter and too many choices; tools that feel like work; losing typing. (confident — brief)
- **Aspirations:** start the day with clarity; feel calm and capable; ship the video / finish the thing; own a tool that feels *nice to open*.
- **Products they love:** Tiimo (named), Things 3, Bear, Apple Reminders, bullet journals. (confident — brief)
- **Languages:** English UI; owner (and likely some users) writes in **Bengali** → every direction pairs a Latin face with a matching Bengali face.

## Personality
- **Archetype:** Caregiver (+ Everyman). A kind, steady companion — not a coach with a whistle.
- **Feel:** calm · kind · crafted  ·  **Never:** childish · noisy · judgmental
- **Sliders:** Serious 3/5 Playful · Classic 3/5 Modern · Calm 1/5 Energetic · Premium 2/5 Accessible · Dense 4/5 Airy
  - Playful is capped at 3: warmth comes from shape, color and words, not mascots or confetti — adults with ADHD resent being talked down to.
  - Calm 1/5: every visual choice must reduce competing signals.

## Market
- **Things 3** — near-white, one blue, precise; the "premium todo" bar. **Bear** — paper + red accent, typographic. **Sunsama/Akiflow** — light neutral, lilac/blue, calm-dense. **Notion** — black/white, flat. **Tiimo / Structured** — pastel, rounded, colorful timeline blocks. (general knowledge — not web-verified this session)
- **Strategy: stand out gently.** Productivity is cool-grey + blue/purple; ADHD planners are pastel-cute. The open space is **warm, soft and grown-up**: Tiimo's kindness with Bear/Things-level craft, in *both* light and dark.

## ADHD design principles (apply in every direction)
1. **One "now".** The current task (or planner block) is the single loudest thing on screen. Everything else steps back.
2. **Fewer boxes.** Replace stacked bordered cards and colored header bands with space, one surface, and small color signals (dot, soft fill). Max one tinted area per pane.
3. **Color never alone.** Priority = label + color; carried-over age = words ("From yesterday").
4. **Gentle feedback.** Completion is acknowledged softly (strike + quiet count "3 done today"); nothing red for "late". Carryover is framed as continuity, not debt.
5. **Low reading load.** 15–16px minimum body, 13px minimum meta (no 10–11px text), sentence case, short labels.
6. **Calm motion.** 160–220ms, ease-out, no bounce; honour reduced motion.

## Design implications
- **Color:** warm neutrals in both themes (hue 55–85 light cream / espresso dark — never slate) because warmth reads as safe and "paper", and the current cool dark theme is the #1 audit problem. One confident accent carries action + "now"; priorities are desaturated earth tones (clay, honey, sage) so urgency never screams.
- **Type:** a friendly, open face at comfortable sizes, because legibility and low effort beat style for ADHD readers. Directions test humanist sans vs rounded sans vs soft serif headings (the no-serif rule is lifted by the owner). Each ships with a Bengali pair.
- **Shape/depth/motion:** larger radii (14–22px), soft warm shadows or none, filled surfaces over outlines — because round, soft shapes read as friendly and lower perceived pressure (Tiimo reference). Motion short and quiet.
- **Voice:** kind, plain, brief; never guilt ("overdue" → "From yesterday"; "No tasks" → "Nothing here. That's allowed."). Developer copy in auth ("wired to PocketBase") is replaced.
- **Brand assets:** a real mark built from the notebook page + check idea (existing equity), readable at 16px, used for favicon / app icon / Tauri icon.
- **Accessibility:** WCAG AA verified for every token pair in every direction (see `directions/` — all required pairs pass, light and dark), focus rings ≥3:1, checkbox borders ≥3:1, reduced motion.

## Optional note on the name (not required)
"DailyTodo" is clear but generic and hard to own as a public brand. If the owner ever wants a more ownable name, directions in the same spirit: **Daybook**, **Todayly**, **Softday**. (guess — purely optional; all previews keep "DailyTodo")

## Directions built
- **A · Quiet Desk** — safe-strong evolution: refined teal, cream paper, Figtree + Hind Siliguri, 14px radius. Signature: the "Now" card.
- **B · Soft Day** — warmest, most Tiimo: dusty lilac, pastel priority pebbles, Nunito + Baloo Da 2, 22px radius, pill buttons.
- **C · Ember Journal** — boldest: terracotta ember, soft serif (Fraunces SOFT) headings + Instrument Sans, big serif date, bullet-journal signifiers.
