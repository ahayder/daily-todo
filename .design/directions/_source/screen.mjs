// Shared, faithful mock of DailyTodo's /todos day screen + signature details.
const ic = (d, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const I = {
  panel: ic('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'),
  target: ic('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  list: ic('<path d="M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13"/>'),
  plus: ic('<path d="M5 12h14M12 5v14"/>'),
  chev: ic('<path d="m6 9 6 6 6-6"/>'),
  check: ic('<path d="M20 6 9 17l-5-5"/>'),
  undo: ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  pause: ic('<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>'),
  carry: ic('<path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>'),
  moon: ic('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  arrow: ic('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};

const task = ({ text, est, status, age, done, now, bn, subs }) => `
  <li class="dt-task${done ? " done" : ""}${now ? " is-now" : ""}">
    <span class="dt-check" role="checkbox" aria-checked="${done ? "true" : "false"}" aria-label="Mark done">${done ? I.check : ""}</span>
    <div class="dt-task-main">
      <p class="dt-task-text"${bn ? ' lang="bn"' : ""}>${text}</p>
      <p class="dt-meta">${est ? `<span class="dt-est mono">${est}</span>` : ""}${status ? `<span class="dt-status">${status}</span>` : ""}${now ? '<span class="dt-nowtag">Now</span>' : ""}</p>
    </div>
    ${age ? `<span class="dt-age" data-days="${age}">${I.carry}${age === 1 ? "From yesterday" : `${age} days waiting`}</span>` : '<span class="dt-age-empty"></span>'}
    ${subs ? `<ul class="dt-sub-list">${subs.map(task).join("")}</ul>` : ""}
  </li>`;

const group = (n, sig, label, placeholder, tasks) => `
  <section class="dt-group g${n}">
    <header class="dt-group-h"><span class="dt-tab"><span class="dt-sig" aria-hidden="true">${sig}</span><h3>${label}</h3></span><span class="dt-count">${tasks.filter((t) => !t.done).length} left</span></header>
    <ul>${tasks.map(task).join("")}</ul>
    <div class="dt-add">${I.plus}<span>${placeholder}</span></div>
  </section>`;

export function screen(css) {
  return `
<style>
${css}
</style>
<div class="dt">
  <header class="dt-top">
    <span class="dt-iconbtn" aria-label="Collapse sidebar">${I.panel}</span>
    <div class="dt-pills" role="navigation" aria-label="Main navigation">
      <a class="on" aria-current="page">Todos</a><a>Notes</a><a><span class="lg">Daily </span>Planner</a><a>Content<span class="lg"> Planner</span></a>
    </div>
    <span class="dt-sync" role="status"><i></i><span>Saved · 2 min ago</span></span>
    <span class="dt-iconbtn" aria-label="Switch to light mode">${I.moon}</span>
  </header>
  <div class="dt-body app-shell" style="display:grid; grid-template-columns: 228px minmax(0, 1fr);">
    <aside class="app-sidebar dt-side">
      <div data-wordmark="0" style="font-size: 20px"></div>
      <span class="dt-wsbtn"><span class="dt-ws-dot"></span>Main${I.chev}</span>
      <p class="dt-side-label">Today</p>
      <span class="dt-day on"><span>Thu, Oct 1</span><small>4 left</small></span>
      <p class="dt-side-label">Earlier</p>
      <span class="dt-day"><span>Wed, Sep 30</span></span>
      <span class="dt-day"><span>Tue, Sep 29</span></span>
      <span class="dt-day"><span>Mon, Sep 28</span></span>
      <span class="dt-day"><span>Sun, Sep 27</span></span>
      <div class="dt-profile"><span class="avatar">A</span><span><b>Ali</b><small>Open account menu</small></span></div>
    </aside>
    <main class="dt-main">
      <div class="dt-switch" role="tablist" aria-label="Todos page sections"><span class="on" role="tab" aria-selected="true">Todos</span><span role="tab" aria-selected="false">Daily note</span></div>
      <section class="dt-note" aria-label="Daily note">
        <header class="dt-note-h">
          <h2 class="dt-date"><span class="dt-date-day">Thursday</span> <span class="dt-date-d">Oct 1</span></h2>
          <span class="dt-wschip">Main</span>
        </header>
        <div class="dt-page">
          <h4>Morning brain dump</h4>
          <p lang="bn">আজকে মাথাটা একটু ভারী, তাই ছোট কাজ দিয়ে শুরু করবো।</p>
          <ul>
            <li>Video idea: film the real messy desk, not the pretty one.</li>
            <li>Lunch at 1:30 — no screens.</li>
          </ul>
          <h4>Shoot notes</h4>
          <ul>
            <li>B-roll: <span lang="bn">হাতে লেখা প্ল্যানার, কফি, জানালার আলো</span></li>
            <li>Hook: “I forget things, so my notebook remembers for me.”</li>
          </ul>
          <p lang="bn">কালকের জন্য: স্ক্রিপ্টের শেষ অংশটা আবার পড়তে হবে।</p>
        </div>
      </section>
      <section class="dt-todos" aria-label="Todos">
        <header class="dt-todos-h">
          <div><h2>Todos</h2><p class="dt-sub">Plan the day from here.</p></div>
          <div class="dt-actions"><span class="dt-iconbtn" aria-label="Enter focus mode">${I.target}</span><span class="dt-iconbtn" aria-label="Labels: Must, Should, Could">${I.list}</span></div>
        </header>
        <div class="dt-now" role="region" aria-label="Now">
          <div class="dt-now-tide" aria-hidden="true"></div>
          <svg class="dt-now-ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="23" class="trk"/><circle cx="28" cy="28" r="23" class="val" pathLength="100" stroke-dasharray="40 100"/><text x="28" y="33" text-anchor="middle">18m</text></svg>
          <div class="dt-now-body">
            <p class="dt-now-label"><span class="dt-now-dot"></span>Now</p>
            <p class="dt-now-title">Fix sync bug on content cards</p>
            <p class="dt-now-meta"><span class="mono">18 min</span> left of 45 · Next: <span lang="bn">আম্মুকে ফোন করা</span></p>
          </div>
          <div class="dt-now-actions"><span class="dt-now-btn">${I.pause}Pause</span><span class="dt-now-btn solid">${I.check}Done</span></div>
          <div class="dt-now-bar" aria-hidden="true"><i></i></div>
        </div>
        <div class="dt-attn"><span>${I.carry}2 tasks worth a look</span><span class="dt-link">Review</span></div>
        ${group(1, "!!", "Must do", "Add a must-do task…", [
          { text: "Fix sync bug on content cards", est: "45m", status: "Ongoing", now: true, subs: [
            { text: "Reproduce on localhost", est: "10m", done: true },
            { text: "Write a failing test", est: "15m" },
          ] },
          { text: "Record the intro for the planner video", est: "30m", age: 1 },
          { text: "আম্মুকে ফোন করা", est: "10m", bn: true },
        ])}
        ${group(2, "!", "Should do", "Add a should-do task…", [
          { text: "Draft shoot card: why I plan in Bangla", est: "20m", age: 3 },
          { text: "বাজারের লিস্ট বানানো", est: "5m", bn: true },
          { text: "Reply to Rafi about the thumbnail", est: "10m", done: true },
        ])}
        ${group(3, "~", "Could do", "Add a task for later…", [
          { text: "Clean up the Downloads folder", est: "10m" },
        ])}
        <div class="dt-toast" role="status"><span>Task deleted</span><span class="dt-toast-btn">${I.undo}Undo</span></div>
      </section>
    </main>
  </div>
</div>
<div class="dt-extras">
  <p class="dt-x-label">Signature details</p>
  <div class="dt-x-grid">
    <div class="dt-x">
      <p class="dt-x-t">1 · Now card, Daily Planner variant</p>
      <div class="dt-now dt-now--plan" role="region" aria-label="Now">
        <div class="dt-now-tide" aria-hidden="true" style="width: 62%"></div>
        <svg class="dt-now-ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="23" class="trk"/><circle cx="28" cy="28" r="23" class="val" pathLength="100" stroke-dasharray="38 100"/><text x="28" y="33" text-anchor="middle">48m</text></svg>
        <div class="dt-now-body">
          <p class="dt-now-label"><span class="dt-now-dot"></span>Now · 10:00–12:30</p>
          <p class="dt-now-title">Deep work</p>
          <p class="dt-now-meta"><span class="mono">48 min</span> left</p>
        </div>
        <div class="dt-now-bar" aria-hidden="true"><i style="width: 62%"></i></div>
      </div>
      <ol class="dt-strip">
        <li><span class="mono">12:30–13:30</span><span>Lunch, no screens <em>Next</em></span></li>
        <li class="free"><span class="mono">13:30–14:00</span><span>Free — your call</span></li>
        <li><span class="mono">14:00–16:00</span><span lang="bn">ভিডিও এডিট</span></li>
      </ol>
    </div>
    <div class="dt-x">
      <p class="dt-x-t">2 · Carryover margin note</p>
      <ul class="dt-mini">
        ${task({ text: "Renew the domain", est: "5m", age: 1 })}
        ${task({ text: "Draft shoot card: why I plan in Bangla", est: "20m", age: 3 })}
        ${task({ text: "ব্যাংকে ফোন করা", est: "10m", age: 6, bn: true })}
      </ul>
      <p class="dt-x-n">The note grows in weight, never in color. No red, no guilt — it just says how long a task has been riding along.</p>
    </div>
    <div class="dt-x">
      <p class="dt-x-t">3 · Content stage track</p>
      <ol class="dt-stage" aria-label="Stage: Develop">
        <li><span class="st past">Inbox</span></li><li><span class="st cur" aria-current="step">Develop</span></li><li><span class="st">Shoot next <span class="dt-cap mono">4/5</span></span></li><li><span class="st">Published</span></li>
      </ol>
      <div class="dt-card-mini">
        <b>Why I plan in Bangla</b>
        <p class="dt-x-n">Problem: English planners feel like homework. Method: show my real page.</p>
        <p lang="bn">নিজের ভাষায় প্ল্যান করলে মাথাটা হালকা লাগে।</p>
        <span class="dt-next">Ready to shoot ${I.arrow}</span>
      </div>
    </div>
  </div>
</div>`;
}

export const BASE_CSS = `
.dt, .dt-extras { font-size: 15px; line-height: 1.5; color: var(--foreground); }
.dt { background: var(--background); display: flex; flex-direction: column; min-height: 700px; }
.dt p, .dt h2, .dt h3, .dt h4, .dt-extras p { margin: 0; }
.dt ul, .dt ol, .dt-extras ul, .dt-extras ol { list-style: none; margin: 0; padding: 0; }
.dt .i, .dt-extras .i { width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.dt [lang="bn"], .dt-extras [lang="bn"] { line-height: 1.75; }
.dt .mono, .dt-extras .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.dt-top { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--background); }
.dt-iconbtn { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: var(--radius); color: var(--muted-foreground); cursor: pointer; flex: none; transition: background var(--dur) var(--ease), color var(--dur) var(--ease); }
.dt-iconbtn:hover { background: var(--accent); color: var(--foreground); }
.dt-pills { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: var(--muted); overflow-x: auto; scrollbar-width: none; min-width: 0; }
.dt-pills a { padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 500; color: var(--muted-foreground); white-space: nowrap; cursor: pointer; text-decoration: none; transition: background var(--dur) var(--ease), color var(--dur) var(--ease); }
.dt-pills a:hover { color: var(--foreground); }
.dt-pills a.on { background: var(--card); color: var(--foreground); }
.dt-sync { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted-foreground); white-space: nowrap; }
.dt-sync i { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
.dt-side { border-right: 1px solid var(--border); padding: 16px 12px; display: flex; flex-direction: column; gap: 2px; background: var(--card); }
.dt-side [data-wordmark] { padding: 2px 10px 16px; }
.dt-wsbtn { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius); border: 1px solid var(--border); font-size: 14px; font-weight: 500; margin-bottom: 12px; cursor: pointer; }
.dt-wsbtn .i { margin-left: auto; color: var(--muted-foreground); }
.dt-ws-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
.dt-side-label { font-size: 13px; font-weight: 600; color: var(--muted-foreground); padding: 10px 10px 4px; }
.dt-day { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border-radius: var(--radius); font-size: 14px; color: var(--muted-foreground); cursor: pointer; transition: background var(--dur) var(--ease); }
.dt-day:hover { background: var(--accent); color: var(--foreground); }
.dt-day.on { background: var(--brand-subtle); color: var(--brand-subtle-foreground); font-weight: 600; }
.dt-day small { font-size: 13px; font-weight: 500; }
.dt-profile { margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 18px 8px 4px; font-size: 14px; }
.dt-profile small { display: block; font-size: 13px; color: var(--muted-foreground); }
.dt-main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(360px, 452px); min-width: 0; }
.dt-switch { display: none; }
.dt-note { padding: 28px 36px 40px; border-right: 1px solid var(--border); min-width: 0; }
.dt-note-h { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.dt-date { font-size: 30px; line-height: 1.15; }
.dt-wschip { font-size: 13px; font-weight: 600; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted-foreground); }
.dt-page { font-size: 16px; line-height: 1.75; max-width: 62ch; }
.dt-page h4 { font-size: 16px; font-weight: 600; line-height: 1.75; margin-top: 1.75em; }
.dt-page h4:first-child { margin-top: 0; }
.dt-page ul { list-style: disc; padding-left: 1.2em; }
.dt-page li::marker { color: var(--muted-foreground); }
.dt-todos { padding: 22px 22px 28px; display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.dt-todos-h { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.dt-todos-h h2 { font-size: 22px; }
.dt-sub { font-size: 13px; color: var(--muted-foreground); margin-top: 2px; }
.dt-actions { display: flex; gap: 2px; }
.dt-now { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px 14px; align-items: center; padding: 16px 18px; border-radius: calc(var(--radius) * 1.4); background: var(--now-bg); color: var(--now-fg); }
.dt-now-tide, .dt-now-ring, .dt-now-bar { display: none; }
.dt-now-body { position: relative; min-width: 0; }
.dt-now-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--now-muted); }
.dt-now-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--now-bar); }
.dt-now-title { font-family: var(--font-heading); font-size: 19px; font-weight: var(--heading-weight); letter-spacing: var(--heading-tracking); line-height: 1.3; margin-top: 4px; }
.dt-now-meta { font-size: 13px; color: var(--now-muted); margin-top: 6px; }
.dt-now-actions { position: relative; display: flex; gap: 6px; }
.dt-now-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: var(--radius); font-size: 13px; font-weight: 600; border: 1px solid color-mix(in oklch, var(--now-fg) 30%, transparent); cursor: pointer; transition: background var(--dur) var(--ease); }
.dt-now-btn:hover { background: color-mix(in oklch, var(--now-fg) 10%, transparent); }
.dt-now-btn .i { width: 14px; height: 14px; }
.dt-now-btn.solid { background: var(--now-fg); color: var(--now-bg); border-color: transparent; }
.dt-now-bar { grid-column: 1 / -1; height: 6px; border-radius: 999px; background: color-mix(in oklch, var(--now-fg) 16%, transparent); position: relative; }
.dt-now-bar i { position: absolute; inset: 0 auto 0 0; width: 60%; border-radius: inherit; background: var(--now-bar); }
.dt-now-ring .trk { fill: none; stroke: color-mix(in oklch, var(--now-fg) 18%, transparent); stroke-width: 5; }
.dt-now-ring .val { fill: none; stroke: var(--now-bar); stroke-width: 5; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 28px 28px; }
.dt-now-ring text { font-family: var(--font-mono); font-size: 13px; font-weight: 600; fill: currentColor; }
.dt-attn { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; color: var(--muted-foreground); padding: 0 4px; }
.dt-attn > span:first-child { display: inline-flex; align-items: center; gap: 8px; }
.dt-link { font-weight: 600; color: var(--foreground); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--ring); cursor: pointer; }
.dt-group { --pc: var(--p1); --pc-on: var(--p1-on); --pc-soft: var(--p1-soft); --pc-ink: var(--p1-ink); }
.dt-group.g2 { --pc: var(--p2); --pc-on: var(--p2-on); --pc-soft: var(--p2-soft); --pc-ink: var(--p2-ink); }
.dt-group.g3 { --pc: var(--p3); --pc-on: var(--p3-on); --pc-soft: var(--p3-soft); --pc-ink: var(--p3-ink); }
.dt-group-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 4px 6px; }
.dt-tab { display: inline-flex; align-items: center; gap: 6px; }
.dt-sig { font-family: var(--font-mono); font-weight: 600; font-size: 13px; color: var(--pc-ink); }
.dt-group-h h3 { font-family: var(--font-body); font-size: 14px; font-weight: 600; letter-spacing: 0; }
.dt-count { font-size: 13px; color: var(--muted-foreground); }
.dt-task { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 0 12px; align-items: start; padding: 9px 8px; border-radius: var(--radius); transition: background var(--dur) var(--ease); }
.dt-task:hover { background: var(--accent); }
.dt-check { width: 20px; height: 20px; margin-top: 2px; border-radius: 50%; border: 1.5px solid var(--input); display: grid; place-items: center; cursor: pointer; color: var(--primary-foreground); transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease); }
.dt-check:hover { border-color: var(--ring); }
.dt-task.done .dt-check { background: var(--primary); border-color: var(--primary); }
.dt-check .i { width: 13px; height: 13px; stroke-width: 3; }
.dt-task-text { font-size: 15px; line-height: 1.45; }
.dt-task-text[lang="bn"] { line-height: 1.6; }
.dt-task.done > .dt-task-main .dt-task-text { color: var(--muted-foreground); text-decoration: line-through; text-decoration-thickness: 1.5px; }
.dt-meta { display: flex; align-items: center; gap: 8px; margin-top: 3px; font-size: 13px; color: var(--muted-foreground); }
.dt-meta:empty { display: none; }
.dt-est { font-size: 13px; }
.dt-status { font-size: 13px; font-weight: 600; color: var(--brand-subtle-foreground); background: var(--brand-subtle); padding: 0 8px; border-radius: 999px; line-height: 22px; }
.dt-nowtag { display: none; }
.dt-age { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--margin-ink); white-space: nowrap; margin-top: 2px; }
.dt-age .i { width: 14px; height: 14px; }
.dt-sub-list { grid-column: 2 / -1; margin-top: 6px; display: flex; flex-direction: column; }
.dt-sub-list .dt-task { padding: 5px 6px; margin-left: -6px; }
.dt-add { display: flex; align-items: center; gap: 12px; padding: 8px; font-size: 14px; color: var(--muted-foreground); border-radius: var(--radius); cursor: text; transition: background var(--dur) var(--ease); }
.dt-add .i { width: 20px; }
.dt-add:hover { background: var(--accent); color: var(--foreground); }
.dt-toast { align-self: center; display: inline-flex; align-items: center; gap: 14px; padding: 6px 6px 6px 16px; border-radius: 999px; background: var(--foreground); color: var(--background); font-size: 14px; box-shadow: 0 12px 32px -12px oklch(0 0 0 / 0.45); }
.dt-toast-btn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-weight: 600; background: color-mix(in oklch, var(--background) 18%, var(--foreground)); cursor: pointer; }
.dt-toast-btn .i { width: 14px; height: 14px; }
.dt-extras { padding: 28px; border-top: 1px solid var(--border); background: var(--background); }
.hero-visual .dt-extras { display: none; }
.dt-x-label { font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-foreground); margin-bottom: 16px !important; }
.dt-x-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 16px; }
.dt-x { border: 1px solid var(--border); border-radius: calc(var(--radius) * 1.4); padding: 18px; background: var(--card); display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.dt-x-t { font-weight: 600; font-size: 14px; }
.dt-x-n { font-size: 13px; color: var(--muted-foreground); }
.dt-x .dt-now { grid-template-columns: minmax(0, 1fr); }
.dt-strip li { display: grid; grid-template-columns: 100px 1fr; gap: 10px; font-size: 14px; padding: 8px 0; border-top: 1px dashed var(--border); }
.dt-strip .mono { font-size: 13px; color: var(--muted-foreground); }
.dt-strip em { font-style: normal; font-size: 13px; font-weight: 600; color: var(--brand-subtle-foreground); background: var(--brand-subtle); border-radius: 999px; padding: 0 8px; margin-left: 6px; }
.dt-strip .free { color: var(--muted-foreground); }
.dt-mini { display: flex; flex-direction: column; }
.dt-stage { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 4px; font-size: 13px; font-weight: 600; }
.dt-stage li { display: inline-flex; align-items: center; gap: 4px; }
.dt-stage li:not(:last-child)::after { content: "›"; color: var(--muted-foreground); margin-left: 2px; }
.dt-stage .st { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; color: var(--muted-foreground); border: 1px dashed var(--input); }
.dt-stage .st.past { color: var(--foreground); border-style: solid; border-color: var(--border); }
.dt-stage .st.cur { background: var(--primary); color: var(--primary-foreground); border: 1px solid transparent; }
.dt-cap { font-size: 13px; padding: 0 6px; border-radius: 999px; background: var(--muted); color: var(--foreground); }
.dt-card-mini { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; background: var(--background); }
.dt-card-mini b { font-weight: 600; font-family: var(--font-heading); }
.dt-next { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: var(--radius); background: var(--primary); color: var(--primary-foreground); font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 4px; }
@container (max-width: 900px) {
  .dt-main { grid-template-columns: minmax(0, 1fr); }
  .dt-note { display: none; }
  .dt-switch { display: flex; gap: 4px; margin: 14px 16px 0; padding: 3px; border-radius: 999px; background: var(--muted); }
  .dt-switch span { flex: 1; text-align: center; padding: 7px; border-radius: 999px; font-size: 14px; font-weight: 500; color: var(--muted-foreground); }
  .dt-switch span.on { background: var(--card); color: var(--foreground); }
  .dt-todos { padding: 16px; }
}
@container (max-width: 640px) {
  .dt-top { gap: 4px; padding: 8px; }
  .dt-sync span, .dt-pills .lg { display: none; }
  .dt-pills a { padding: 6px 11px; }
  .dt-now { grid-template-columns: minmax(0, 1fr); }
  .dt-extras { padding: 16px; }
  .dt-task { grid-template-columns: 22px minmax(0, 1fr); }
  .dt-task > .dt-age { grid-column: 2; justify-self: start; margin-top: 4px; }
  .dt-task > .dt-age-empty { display: none; }
}
@media (prefers-reduced-motion: reduce) { .dt *, .dt-extras * { transition: none !important; animation: none !important; } }
`;
