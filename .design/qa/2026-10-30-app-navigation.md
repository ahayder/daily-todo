# QA: App navigation (top pills, Plan menu, Today tabs, phone tab bar) — 2026-10-30
Tested: in browser (built-in browser pane, localhost:5006 local test DB, ?devWorkspace=1), widths 1280 / 768 / 640 / 375, dark + light, keyboard
Brief (given): single owner (ADHD) · get to the right area fast and always know where you are · the highlighted pill/tab matches the page
Stranger test: "This screen is for running my day, and it wants me to switch between Today, Notes, Memory and my plans." ✓ matches the brief
Verdict: fix needed (2 High, 4 Medium, 4 Low)

## Findings
- [High] Phone, /today: opening the Plan menu in the bottom bar pushes the whole app up 71px. The top bar goes off-screen, the Today tabs are half cut, and a blank strip appears under the tab bar. It stays that way after the menu closes. Cause: `.app-shell` (overflow hidden, position relative) can scroll 71px because the absolute `sr-only` label of the Shelf "Add to the Shelf…" input sits outside the `overflow-y-auto` scroller, which has no positioned ancestor. The menu's focus handling then scrolls the shell. Repro: 375px, load /today, tap Plan. scrollHeight is 883 vs 812. — src/components/workspace/workspace.tsx (main scroller) + Shelf composer label in today-view — broken layout — fix: make the page scroller (or `.main-panel`) `relative` so absolute children stay inside it, and/or give `.app-shell` `overflow: clip`. — shot: shots/2026-10-30-nav-1-mobile-shift.jpg
- [High] Widths 640 to about 740px on /content-planner (and /planner): the "Plan · Content Planner" pill is wide enough to push the header past the screen. Force sync, A− and A+ end up off-screen (header scrollWidth 735 at 640). On /today at 640, "Last saved 1s ago" wraps to 3 lines and the Today pill touches the logo. — src/components/workspace/top-navbar.tsx:265-309 — broken layout — fix: show only "Plan" (plus the highlight) below lg, or move pills to the bottom bar until md, or hide the sync label text below md. — shot: shots/2026-10-30-nav-2-640-header-overflow.jpg
- [Medium] Undo toasts on phones sit `bottom-4`, right on top of the new 57px bottom tab bar, so they cover Today/Notes/Memory/Plan while shown (judged from code). — src/components/ui/toast.tsx:42 — nothing covered by the bottom bar — fix: below sm, offset the toast viewport by the tab bar height + safe area.
- [Medium] Phone tab bar shows the current tab by color only (lilac icon and label, no pill or bar). This breaks "meaning not by color alone" and is weak for "always know where you are". — src/components/workspace/mobile-tab-bar.tsx:485-486 — accessibility — fix: add a shape cue (a pill behind the icon or a top bar), like the desktop pill.
- [Medium] Today tabs row is left-aligned to the window edge (x≈16px) while Now/Standup/History/Memory content is a centered column (max-w). At 1280 the tabs float far from the page title and read like a second app bar, not a part of this page. The active tab (bg-card on muted) is also darker than its track in dark mode, so it's quite faint next to the filled Today pill. — src/components/workspace/workspace.tsx:151-156, src/components/blocks/area-tabs.tsx:584 — hierarchy/alignment — fix: put the tabs in the same max-width container as the page (Journal can stay full width), and make the active tab stronger (e.g. `bg-background` + ring, or a primary underline). **needs user** if moving the row changes layout. — shot: shots/2026-10-30-nav-3-desktop-today.jpg
- [Medium] Phone Journal (/todos): top bar 52px + tabs row 70px + stacked sidebar ~230px + bottom bar 57px leaves under half the screen for the page. The new tabs row makes it worse. — workspace.tsx:151 + legacy stacked sidebar — fix: collapse the Journal sidebar by default on phones, or shrink the tabs row to h-11 with less padding (py-2 + p-1 track = 70px now).
- [Low] Tab "Now" opens a page whose title is "Today". Two names for one place. — src/components/today/today-tabs.tsx:619 vs today-view title — fix: keep one word (e.g. tab "Now" + title "Now", or tab "Today"). **needs user** (naming).
- [Low] Plan menu items are buttons with router.push, not links: no cmd-click / middle-click to open in a new tab, and no href on hover. — top-navbar.tsx:294-303, mobile-tab-bar.tsx:540-550 — fix: use `DropdownMenuItem render={<Link href=…/>}`.
- [Low] Keyboard-highlighted Plan menu item is hard to see in dark mode (accent 0.215 on popover 0.2). Shared shadcn item, pre-existing. — src/components/ui/dropdown-menu.tsx — fix: stronger focus bg for menu items.
- [Low] Choosing a Plan item drops focus to <body> after navigation. Same for all Next links, so tabbing restarts at the top. Minor.

## What works
- Active state is right on every route at 1280: /today, /todos, /standup, /history → Today pill + matching tab. /notes → Notes. /memory and /memory/project → Memory. /planner → "Plan · Daily Planner". /content-planner → "Plan · Content Planner" (all with aria-current="page").
- Keyboard: Tab order is logical (Today, Notes, Memory, Plan, actions, then Now/Journal/Standup/History). Focus rings are visible. Enter opens Plan with focus on the first item, arrows move, Enter navigates, and Esc closes and returns focus to the trigger.
- Sidebar toggle hidden on all full-width pages, shown on Journal and Notes. "Today's page" label is clear. Standup uses PageHeader. Content Planner title is fixed.
- 375px: no horizontal scroll on any route. The bottom bar is in normal layout flow (not fixed over content), so page content is never under it. Tap targets are 56px. The phone Plan menu opens upward with the current plan checked. Notes active state is correct.
- Light mode: pills, tabs and the bottom bar all read well.

## Couldn't test
- Weekend hiding of the Standup tab (today is Friday). The code path looks right.
- Browser text zoom (⌘ +). Checked narrow widths instead.
- Real toast overlap on the phone (judged from code).
- Next.js dev "N" badge covers the Today tab at 375 in dev only. Not a product issue.
