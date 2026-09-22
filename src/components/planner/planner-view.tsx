"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AppAction } from "@/components/app/app-context";
import {
  getDefaultPlannerSliceRange,
  getPlannerArcPath,
  getPlannerPoint,
} from "@/components/planner/planner-radial-utils";
import {
  dayKeyForDate,
  getCurrentBlock,
  getNextBlock,
  minutesLeft,
  minutesOfDay,
  PLANNER_TEMPLATE_TABS,
  progressFraction,
  sortEventsByStart,
  type PlannerTemplateKey,
} from "@/lib/planner-now";
import type { AppState, PlannerDay, PlannerEvent } from "@/lib/types";
import { PieChart, Plus, Settings2, Trash2 } from "lucide-react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  fontScale?: number;
};

const WEEKDAY_LABELS: Record<PlannerTemplateKey, string> = {
  monday: "Weekday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const MINUTES_OF_DAY = 24 * 60;
// Selectable times every 15 minutes, 0:00 through 24:00 (midnight end).
const TIME_OPTIONS = Array.from({ length: MINUTES_OF_DAY / 15 + 1 }, (_, i) => i * 15);

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatClock(minutes: number): string {
  const safe = Math.min(24 * 60, Math.max(0, Math.round(minutes)));
  const h24 = Math.floor(safe / 60) % 24;
  const m = safe % 60;
  const h12 = h24 % 12 || 12;
  const suffix = h24 >= 12 ? "p" : "a";
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

function formatRange(event: PlannerEvent): string {
  return `${formatClock(event.startMinutes)}–${formatClock(event.endMinutes)}`;
}

function formatLeft(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m left`;
  if (h) return `${h}h left`;
  return `${m} min left`;
}

type DaySegment =
  | { kind: "block"; event: PlannerEvent }
  | { kind: "free"; startMinutes: number; endMinutes: number };

/** Ordered blocks with the gaps between them surfaced as "free" segments. */
function buildDaySegments(events: PlannerEvent[]): DaySegment[] {
  const ordered = sortEventsByStart(events);
  const segments: DaySegment[] = [];
  ordered.forEach((event, index) => {
    segments.push({ kind: "block", event });
    const next = ordered[index + 1];
    if (next && next.startMinutes - event.endMinutes >= 15) {
      segments.push({
        kind: "free",
        startMinutes: event.endMinutes,
        endMinutes: next.startMinutes,
      });
    }
  });
  return segments;
}

// ── Read-only 24h clock (bird's-eye) ─────────────────────────────────────────

function DayClock({
  events,
  minutesNow,
  size = 176,
}: {
  events: PlannerEvent[];
  minutesNow: number | null;
  size?: number;
}) {
  const inner = 205;
  const outer = 258;
  const marker = minutesNow == null ? null : getPlannerPoint(minutesNow, (inner + outer) / 2);
  return (
    <svg
      viewBox="0 0 600 600"
      width={size}
      height={size}
      role="img"
      aria-label="Your whole day as a 24-hour clock"
    >
      <circle
        cx={300}
        cy={300}
        r={(inner + outer) / 2}
        fill="none"
        stroke="var(--planner-track)"
        strokeWidth={outer - inner}
      />
      {sortEventsByStart(events).map((event) => (
        <path
          key={event.id}
          d={getPlannerArcPath(event.startMinutes, event.endMinutes, inner, outer)}
          fill="var(--brand)"
          opacity={0.9}
        />
      ))}
      {marker ? (
        <circle cx={marker.x} cy={marker.y} r={16} fill="var(--ink-900)" stroke="var(--paper-strong)" strokeWidth={5} />
      ) : null}
    </svg>
  );
}

// ── NOW screen ───────────────────────────────────────────────────────────────

function NowView({ day, now }: { day: PlannerDay; now: Date }) {
  const [showClock, setShowClock] = useState(false);
  const minutesNow = minutesOfDay(now);
  const events = day.events;
  const current = getCurrentBlock(events, minutesNow);
  const next = getNextBlock(events, minutesNow);
  const segments = buildDaySegments(events);
  const dayName = DAY_NAMES[now.getDay()];

  const nowCard = (
    <div className="rounded-2xl border border-[var(--brand)] bg-[var(--paper-strong)] p-4">
      <p className="text-[0.6875em] font-semibold uppercase tracking-wider text-[var(--ink-700)]">
        Now{current ? ` · ${formatRange(current)}` : ""}
      </p>
      {current ? (
        <>
          <p className="mt-1 text-[1.25em] font-semibold text-[var(--ink-900)]">{current.title}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--paper)]">
            <div
              className="h-full rounded-full bg-[var(--brand)]"
              style={{ width: `${Math.round(progressFraction(current, minutesNow) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[0.875em] text-[var(--ink-700)]">{formatLeft(minutesLeft(current, minutesNow))}</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-[1.25em] font-semibold text-[var(--ink-900)]">Free — your call</p>
          <p className="mt-2 text-[0.875em] text-[var(--ink-700)]">
            {next ? `Until ${formatClock(next.startMinutes)}` : "Nothing scheduled"}
          </p>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative mb-5 flex items-center justify-center">
        <p className="text-[0.875em] text-[var(--ink-700)]">
          {dayName} · {formatClock(minutesNow)}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShowClock((value) => !value)}
              aria-label="Show whole-day clock"
              aria-pressed={showClock}
              className="absolute right-0 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors hover:bg-[var(--paper-strong)]"
            >
              <PieChart className="h-[18px] w-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Whole day</TooltipContent>
        </Tooltip>
      </div>

      {showClock ? (
        <div className="mb-5 flex justify-center">
          <DayClock events={events} minutesNow={minutesNow} />
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-6 text-center">
          <p className="text-[0.875em] text-[var(--ink-700)]">
            Nothing set for {WEEKDAY_LABELS[dayKeyForDate(now)].toLowerCase()}s yet. Open Set up to shape your day.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {segments.map((segment) => {
            if (segment.kind === "free") {
              const isNowGap = current == null && minutesNow >= segment.startMinutes && minutesNow < segment.endMinutes;
              if (isNowGap) return <div key={`free-${segment.startMinutes}`}>{nowCard}</div>;
              return (
                <p key={`free-${segment.startMinutes}`} className="px-1 text-[0.8125em] italic text-[var(--ink-700)] opacity-70">
                  {formatClock(segment.startMinutes)}–{formatClock(segment.endMinutes)} · Free — your call
                </p>
              );
            }
            const event = segment.event;
            if (current && event.id === current.id) {
              return <div key={event.id}>{nowCard}</div>;
            }
            const isNext = next != null && event.id === next.id;
            return (
              <p
                key={event.id}
                className={`px-1 text-[0.8125em] ${isNext ? "text-[var(--ink-900)]" : "text-[var(--ink-700)]"}`}
              >
                <span className="tabular-nums">{formatRange(event)}</span> · {event.title}
                {isNext ? <span className="text-[var(--ink-700)]"> · next</span> : null}
              </p>
            );
          })}
          {current == null && minutesNow < (sortEventsByStart(events)[0]?.startMinutes ?? 0) ? (
            <div>{nowCard}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── SETUP screen ─────────────────────────────────────────────────────────────

function EventRow({
  event,
  onUpdate,
  onDelete,
}: {
  event: PlannerEvent;
  onUpdate: (updates: Partial<{ title: string; startMinutes: number; endMinutes: number }>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(event.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current && event.title !== title) {
      setTitle(event.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.title]);

  const scheduleSave = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (value.trim()) onUpdate({ title: value });
    }, 400);
  };

  const selectClass =
    "h-9 rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-2 text-[0.8125em] text-[var(--ink-900)] tabular-nums";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--line)] p-2 sm:flex-row sm:items-center sm:gap-2 sm:border-0 sm:p-0">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave(e.target.value);
        }}
        onBlur={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          if (title.trim()) onUpdate({ title });
          else setTitle(event.title);
        }}
        aria-label="Block name"
        placeholder="Block name"
        className="order-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--paper-strong)] px-3 text-[0.8125em] text-[var(--ink-900)] sm:order-2 sm:min-w-0 sm:flex-1"
      />
      <div className="order-2 flex items-center gap-2 sm:order-1 sm:shrink-0">
        <select
          value={event.startMinutes}
          onChange={(e) => {
            const start = Number(e.target.value);
            const end = event.endMinutes < start + 30 ? Math.min(start + 30, MINUTES_OF_DAY) : event.endMinutes;
            onUpdate({ startMinutes: start, endMinutes: end });
          }}
          aria-label="Start time"
          className={selectClass}
        >
          {TIME_OPTIONS.filter((m) => m <= MINUTES_OF_DAY - 30).map((m) => (
            <option key={m} value={m}>
              {formatClock(m)}
            </option>
          ))}
        </select>
        <span className="text-[var(--ink-700)]">–</span>
        <select
          value={event.endMinutes}
          onChange={(e) => onUpdate({ endMinutes: Number(e.target.value) })}
          aria-label="End time"
          className={selectClass}
        >
          {TIME_OPTIONS.filter((m) => m >= event.startMinutes + 30).map((m) => (
            <option key={m} value={m}>
              {formatClock(m)}
            </option>
          ))}
        </select>
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger
                aria-label="Remove block"
                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors hover:bg-[var(--paper-strong)] hover:text-[var(--warn)] sm:ml-0"
              >
                <Trash2 className="h-[15px] w-[15px]" />
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Remove block</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--ink-900)]">Remove this block?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--ink-700)]">
              “{event.title}” ({formatRange(event)}) will be removed from this day.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function SetupView({
  presetId,
  days,
  dispatch,
}: {
  presetId: string;
  days: Record<string, PlannerDay>;
  dispatch: Dispatch<AppAction>;
}) {
  const [tab, setTab] = useState<PlannerTemplateKey>("monday");
  const day = days[tab];
  // Show blocks in the order the user created them — no auto-sort, so a row
  // never jumps while its time is being edited.
  const events = day.events;
  const totalMinutes = events.reduce((sum, e) => sum + Math.max(0, e.endMinutes - e.startMinutes), 0);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-[1em] font-semibold text-[var(--ink-900)]">Your ideal days</p>
        <span className="text-[0.75em] text-[var(--ink-700)]">edit once, rarely</span>
      </div>

      <div className="mb-4 flex gap-1.5">
        {PLANNER_TEMPLATE_TABS.map((entry) => {
          const active = entry.key === tab;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              aria-pressed={active}
              className={`flex-1 rounded-lg border px-[0.75em] py-[0.5em] text-[0.8125em] font-medium transition-colors ${
                active
                  ? "border-transparent bg-[var(--brand)] text-[var(--paper-strong)]"
                  : "border-[var(--line)] text-[var(--ink-700)] hover:bg-[var(--paper-strong)]"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-4">
        <div className="mb-4 flex items-center gap-4 border-b border-[var(--line)] pb-4">
          <DayClock events={events} minutesNow={null} size={88} />
          <div className="flex-1">
            <p className="text-[0.8125em] text-[var(--ink-900)]">
              {events.length} block{events.length === 1 ? "" : "s"} · {Math.round(totalMinutes / 60)}h planned
            </p>
            <p className="mt-1 text-[0.75em] leading-relaxed text-[var(--ink-700)]">
              Gaps are free time — just leave them empty.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onUpdate={(updates) =>
                dispatch({ type: "update-planner-event", presetId, dayKey: tab, eventId: event.id, updates })
              }
              onDelete={() =>
                dispatch({ type: "delete-planner-event", presetId, dayKey: tab, eventId: event.id })
              }
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            const range = getDefaultPlannerSliceRange(events);
            dispatch({
              type: "create-planner-event",
              presetId,
              dayKey: tab,
              purposeId: null,
              startMinutes: range.startMinutes,
              endMinutes: range.endMinutes,
            });
          }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] py-2 text-[0.8125em] text-[var(--ink-700)] transition-colors hover:bg-[var(--paper)]"
        >
          <Plus className="h-[15px] w-[15px]" /> Add block
        </button>
      </div>

      <p className="mt-3 px-1 text-center text-[0.75em] text-[var(--ink-700)]">Changes save on their own.</p>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function PlannerView({ state, dispatch, fontScale = 1 }: Props) {
  const [mode, setMode] = useState<"now" | "setup">("now");
  const [now, setNow] = useState(() => new Date());

  // Scales all planner text with the top-nav A-/A+ control. Text sizes below use
  // `em`, so setting the base font-size here resizes the whole planner face. The
  // clamp also grows the base with viewport width, so the page reads larger on
  // bigger monitors, while the A-/A+ scale multiplies on top.
  const rootStyle = {
    fontSize: `calc(clamp(1rem, 0.75rem + 0.5vw, 1.4rem) * ${Math.max(0.5, Math.min(2, fontScale))})`,
  } as CSSProperties;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const presetId = state.uiState.selectedPlannerPresetId;
  const preset = presetId ? state.plannerPresets[presetId] : null;

  if (!preset || !presetId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[0.875em] text-[var(--ink-700)]">
        Loading your planner…
      </div>
    );
  }

  const todayKey = dayKeyForDate(now);

  return (
    <div className="h-full overflow-y-auto bg-[var(--paper)]" style={rootStyle}>
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-lg border border-[var(--line)] p-0.5">
            <button
              type="button"
              onClick={() => setMode("now")}
              aria-pressed={mode === "now"}
              className={`rounded-md px-[1em] py-[0.375em] text-[0.8125em] font-medium transition-colors ${
                mode === "now" ? "bg-[var(--brand)] text-[var(--paper-strong)]" : "text-[var(--ink-700)]"
              }`}
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => setMode("setup")}
              aria-pressed={mode === "setup"}
              className={`flex items-center gap-1.5 rounded-md px-[1em] py-[0.375em] text-[0.8125em] font-medium transition-colors ${
                mode === "setup" ? "bg-[var(--brand)] text-[var(--paper-strong)]" : "text-[var(--ink-700)]"
              }`}
            >
              <Settings2 className="h-[14px] w-[14px]" /> Set up
            </button>
          </div>
        </div>

        {mode === "now" ? (
          <NowView day={preset.days[todayKey]} now={now} />
        ) : (
          <SetupView presetId={presetId} days={preset.days} dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}
