"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
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
import { Clock, PieChart, Plus, Settings2, Trash2 } from "lucide-react";

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

const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]";

/** Segmented control styled like the top-nav pills (soft track, raised active pill). */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  fill = false,
}: {
  options: { key: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  fill?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`${fill ? "flex w-full" : "inline-flex"} gap-0.5 rounded-lg bg-[color-mix(in_srgb,var(--ink-700)_10%,transparent)] p-[3px]`}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            className={`${fill ? "flex-1" : ""} flex min-h-11 items-center justify-center gap-1.5 rounded-md px-[1em] py-[0.375em] text-[0.8125em] sm:min-h-0 font-medium transition-colors duration-150 ${FOCUS_RING} ${
              active
                ? "bg-[var(--paper)] text-[var(--ink-900)] shadow-[0_1px_3px_rgba(31,36,48,0.08)] dark:bg-[var(--planner-track)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                : "text-[var(--ink-700)] hover:bg-[color-mix(in_srgb,var(--ink-700)_10%,transparent)] hover:text-[var(--ink-900)]"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
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

const ROW_CLASS = "flex items-baseline gap-3 rounded-lg px-3 py-[0.5em] text-[0.875em]";
const TIME_CLASS = "w-[7.5em] shrink-0 tabular-nums";
// Setup fields: 44px / 16px text on phones (tap target, no iOS focus zoom),
// em-scaled on larger screens so they grow with A-/A+.
const FIELD_SIZE =
  "min-h-11 text-[length:max(1rem,0.8125em)] sm:min-h-[2.5em] sm:text-[0.8125em]";
const WARM_SHADOW = "shadow-[0_1px_3px_rgba(31,36,48,0.06),0_1px_2px_rgba(31,36,48,0.04)]";

type MarkerTone = "past" | "now" | "next" | "later" | "free";

/** A dot on the vertical day timeline. */
function TimelineMarker({ tone }: { tone: MarkerTone }) {
  const toneClass: Record<MarkerTone, string> = {
    past: "h-[9px] w-[9px] bg-[var(--ink-700)] opacity-50",
    now: "h-[13px] w-[13px] bg-[var(--brand)] ring-4 ring-[var(--brand-soft)]",
    next: "h-[11px] w-[11px] border-2 border-[var(--brand)] bg-[var(--paper)]",
    later: "h-[9px] w-[9px] border-2 border-[color-mix(in_srgb,var(--ink-700)_55%,var(--paper))] bg-[var(--paper)]",
    free: "h-[5px] w-[5px] bg-[color-mix(in_srgb,var(--ink-700)_40%,var(--paper))]",
  };
  return (
    <span
      aria-hidden
      className={`absolute left-[12px] top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${toneClass[tone]}`}
    />
  );
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
          stroke="var(--paper-strong)"
          strokeWidth={6}
        />
      ))}
      {marker ? (
        <circle cx={marker.x} cy={marker.y} r={16} fill="var(--ink-900)" stroke="var(--paper-strong)" strokeWidth={5} />
      ) : null}
    </svg>
  );
}

// ── NOW screen ───────────────────────────────────────────────────────────────

function NowView({ day, now, onSetup }: { day: PlannerDay; now: Date; onSetup: () => void }) {
  const [showClock, setShowClock] = useState(false);
  const minutesNow = minutesOfDay(now);
  const events = day.events;
  const current = getCurrentBlock(events, minutesNow);
  const next = getNextBlock(events, minutesNow);
  const segments = buildDaySegments(events);
  const dayName = DAY_NAMES[now.getDay()];

  const progress = current ? Math.round(progressFraction(current, minutesNow) * 100) : 0;
  const dateLabel = now.toLocaleDateString(undefined, { month: "long", day: "numeric" });

  const nowCard = (
    <section
      aria-label={`Now: ${current ? current.title : "free time"}`}
      className={`my-1 rounded-2xl border border-[color-mix(in_srgb,var(--brand)_55%,var(--line))] bg-[var(--paper-strong)] p-5 ${WARM_SHADOW}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.6875em] font-semibold uppercase tracking-wider text-[var(--brand)]">Now</p>
        {current ? (
          <p className="text-[0.8125em] tabular-nums text-[var(--ink-700)]">{formatRange(current)}</p>
        ) : null}
      </div>
      {current ? (
        <>
          <p className="mt-1 text-[1.5em] font-semibold leading-tight tracking-tight text-[var(--ink-900)]">
            {current.title}
          </p>
          <div
            role="progressbar"
            aria-label="Time through this block"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--planner-track)]"
          >
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-3 text-[0.875em] tabular-nums">
            <span className="font-medium text-[var(--ink-900)]">{formatLeft(minutesLeft(current, minutesNow))}</span>
            <span className="text-[var(--ink-700)]">{progress}% through</span>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[1.5em] font-semibold leading-tight tracking-tight text-[var(--ink-900)]">
            Free — your call
          </p>
          <p className="mt-2 text-[0.875em] text-[var(--ink-700)]">
            {next ? `Until ${formatClock(next.startMinutes)}, then ${next.title}` : "Nothing else scheduled today"}
          </p>
        </>
      )}
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 flex items-start justify-between gap-3 px-1">
        <div>
          <h1 className="text-[1.5em] font-semibold leading-tight tracking-tight text-[var(--ink-900)]">{dayName}</h1>
          <p className="mt-1 text-[0.8125em] tabular-nums text-[var(--ink-700)]">
            {dateLabel} · {WEEKDAY_LABELS[dayKeyForDate(now)]} plan · {formatClock(minutesNow)}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShowClock((value) => !value)}
              aria-label={showClock ? "Hide whole-day clock" : "Show whole-day clock"}
              aria-pressed={showClock}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border sm:h-10 sm:w-10 transition-colors duration-150 hover:bg-[var(--paper-strong)] hover:text-[var(--ink-900)] ${FOCUS_RING} ${
                showClock
                  ? "border-[var(--line)] bg-[var(--paper-strong)] text-[var(--ink-900)]"
                  : "border-transparent text-[var(--ink-700)]"
              }`}
            >
              <PieChart className="h-[18px] w-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{showClock ? "Hide whole day" : "See whole day"}</TooltipContent>
        </Tooltip>
      </div>

      {showClock ? (
        <div className="mb-6 flex justify-center rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-5">
          <DayClock events={events} minutesNow={minutesNow} />
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--line)] px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[1em] font-semibold text-[var(--ink-900)]">
              No plan for {WEEKDAY_LABELS[dayKeyForDate(now)].toLowerCase()}s yet
            </p>
            <p className="mt-1 text-[0.875em] text-[var(--ink-700)]">
              Sketch a few blocks once, and this page will tell you what&apos;s now.
            </p>
          </div>
          <button
            type="button"
            onClick={onSetup}
            className={`mt-1 flex min-h-11 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-[1em] py-[0.5em] text-[0.875em] font-medium text-[var(--paper)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--brand)_88%,var(--ink-900))] sm:min-h-0 ${FOCUS_RING}`}
          >
            <Settings2 className="h-[1.1em] w-[1.1em]" /> Shape your day
          </button>
        </div>
      ) : (
        <ol
          aria-label="Today's blocks"
          className="relative flex flex-col gap-1 before:absolute before:inset-y-4 before:left-[12px] before:w-px before:bg-[var(--line)]"
        >
          {current == null && minutesNow < (sortEventsByStart(events)[0]?.startMinutes ?? 0) ? (
            <li className="relative pl-8">
              <TimelineMarker tone="now" />
              {nowCard}
            </li>
          ) : null}
          {segments.map((segment) => {
            if (segment.kind === "free") {
              const isNowGap = current == null && minutesNow >= segment.startMinutes && minutesNow < segment.endMinutes;
              if (isNowGap) {
                return (
                  <li key={`free-${segment.startMinutes}`} className="relative pl-8">
                    <TimelineMarker tone="now" />
                    {nowCard}
                  </li>
                );
              }
              return (
                <li
                  key={`free-${segment.startMinutes}`}
                  className="relative pl-8"
                >
                  <TimelineMarker tone="free" />
                  <div className={`${ROW_CLASS} text-[var(--ink-700)]`}>
                    <span className={TIME_CLASS}>
                      {formatClock(segment.startMinutes)}–{formatClock(segment.endMinutes)}
                    </span>
                    <span className="italic">Free — your call</span>
                  </div>
                </li>
              );
            }
            const event = segment.event;
            if (current && event.id === current.id) {
              return (
                <li key={event.id} className="relative pl-8">
                  <TimelineMarker tone="now" />
                  {nowCard}
                </li>
              );
            }
            const isNext = next != null && event.id === next.id;
            const isPast = event.endMinutes <= minutesNow;
            return (
              <li key={event.id} className="relative pl-8">
                <TimelineMarker tone={isNext ? "next" : isPast ? "past" : "later"} />
                <div
                  className={`${ROW_CLASS} ${
                    isNext
                      ? "bg-[var(--paper-strong)] text-[var(--ink-900)]"
                      : "text-[var(--ink-700)]"
                  }`}
                >
                  <span className={TIME_CLASS}>{formatRange(event)}</span>
                  <span
                    className={`min-w-0 flex-1 ${
                      isNext ? "font-semibold" : isPast ? "" : "text-[var(--ink-900)]"
                    }`}
                  >
                    {event.title}
                  </span>
                  {isNext ? (
                    <span className="shrink-0 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[0.8em] font-medium text-[var(--ink-900)]">
                      Next
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
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
    `${FIELD_SIZE} cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2 text-[var(--ink-900)] tabular-nums transition-colors duration-150 hover:border-[var(--ink-700)] ${FOCUS_RING}`;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0 sm:flex sm:border-b-0 sm:pb-0">
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
        className={`${FIELD_SIZE} col-span-2 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 text-[var(--ink-900)] transition-colors duration-150 placeholder:text-[var(--ink-700)] hover:border-[var(--ink-700)] sm:order-2 sm:min-w-0 sm:flex-1 ${FOCUS_RING}`}
      />
      <div className="flex items-center gap-2 sm:order-1 sm:shrink-0">
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
      </div>
      <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger
                aria-label="Remove block"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--ink-700)] transition-colors duration-150 hover:bg-[var(--paper)] hover:text-[var(--warn)] sm:order-3 sm:h-[2.25em] sm:w-[2.25em] ${FOCUS_RING}`}
              >
                <Trash2 className="h-[1em] w-[1em]" />
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
      <div className="mb-6 px-1">
        <h1 className="text-[1.5em] font-semibold leading-tight tracking-tight text-[var(--ink-900)]">Your ideal days</h1>
        <p className="mt-1 text-[0.8125em] text-[var(--ink-700)]">
          Sketch each day once. Changes save on their own.
        </p>
      </div>

      <div className="mb-4">
        <Segmented
          label="Day template"
          fill
          options={PLANNER_TEMPLATE_TABS.map((entry) => ({ key: entry.key, label: entry.label }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className={`rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-4 ${WARM_SHADOW}`}>
        <div className="mb-4 flex items-center gap-4 border-b border-[var(--line)] pb-4">
          <DayClock events={events} minutesNow={null} size={88} />
          <div className="flex-1">
            <p className="text-[0.875em] font-semibold tabular-nums text-[var(--ink-900)]">
              {events.length} block{events.length === 1 ? "" : "s"} · {Math.round(totalMinutes / 60)}h planned
            </p>
            <p className="mt-1 text-[0.75em] leading-relaxed text-[var(--ink-700)]">
              Gaps are free time — just leave them empty.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-2">
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
          className={`mt-3 flex w-full items-center justify-center gap-1.5 min-h-11 rounded-lg border border-dashed border-[var(--line)] py-[0.5em] text-[0.8125em] sm:min-h-0 font-medium text-[var(--brand)] transition-colors duration-150 hover:border-[var(--brand)] hover:bg-[var(--paper)] ${FOCUS_RING}`}
        >
          <Plus className="h-[1.1em] w-[1.1em]" /> Add block
        </button>
      </div>

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
          <Segmented
            label="Planner mode"
            options={[
              { key: "now", label: "Now", icon: <Clock className="h-[1em] w-[1em]" /> },
              { key: "setup", label: "Set up", icon: <Settings2 className="h-[1em] w-[1em]" /> },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        {mode === "now" ? (
          <NowView day={preset.days[todayKey]} now={now} onSetup={() => setMode("setup")} />
        ) : (
          <SetupView presetId={presetId} days={preset.days} dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}
