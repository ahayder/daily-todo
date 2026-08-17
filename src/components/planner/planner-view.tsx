"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
import { PlannerTour } from "@/components/planner/planner-tour";
import type { AppAction } from "@/components/app/app-context";
import {
  assignPlannerEventLanes,
  clampPlannerMinute,
  formatPlannerDuration,
  formatPlannerTime,
  getDefaultPlannerSliceRange,
  getPlannerArcPath,
  getPlannerPoint,
  getPlannerPurposeScheduledMinutes,
  MINUTES_PER_DAY,
  plannerInputValueToMinutes,
  plannerMinutesToInputValue,
  PLANNER_SNAP_MINUTES,
  snapPlannerMinute,
} from "@/components/planner/planner-radial-utils";
import {
  createPlannerPurpose,
  makeId,
  PLANNER_DAY_ORDER,
  PLANNER_EVENT_COLORS,
} from "@/lib/store";
import type {
  AppState,
  PlannerDayKey,
  PlannerEvent,
  PlannerEventColor,
  PlannerPurpose,
  PlannerPurposeRole,
} from "@/lib/types";
import {
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock3,
  Layers2,
  Layers3,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

type Props = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

type PurposeDraft = {
  title: string;
  color: PlannerEventColor;
  targetMinutes: number;
  role: PlannerPurposeRole;
  notes: string;
};

type DragState = {
  eventId: string;
  edge: "start" | "end";
};

type DragPreview = {
  eventId: string;
  startMinutes: number;
  endMinutes: number;
};

const DAY_LABELS: Record<PlannerDayKey, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const DAY_SHORT_LABELS: Record<PlannerDayKey, string> = {
  monday: "M",
  tuesday: "T",
  wednesday: "W",
  thursday: "T",
  friday: "F",
  saturday: "S",
  sunday: "S",
};

const COLOR_LABELS: Record<PlannerEventColor, string> = {
  teal: "Teal",
  gold: "Gold",
  rose: "Rose",
  sage: "Sage",
  lavender: "Lavender",
};

const COLOR_VARS: Record<PlannerEventColor, string> = {
  teal: "var(--planner-teal)",
  gold: "var(--planner-gold)",
  rose: "var(--planner-rose)",
  sage: "var(--planner-sage)",
  lavender: "var(--planner-lavender)",
};

const CLOCK_LABELS = [
  { minutes: 0, label: "12a" },
  { minutes: 3 * 60, label: "3a" },
  { minutes: 6 * 60, label: "6a" },
  { minutes: 9 * 60, label: "9a" },
  { minutes: 12 * 60, label: "12p" },
  { minutes: 15 * 60, label: "3p" },
  { minutes: 18 * 60, label: "6p" },
  { minutes: 21 * 60, label: "9p" },
];

const TIME_OPTIONS = Array.from(
  { length: MINUTES_PER_DAY / PLANNER_SNAP_MINUTES + 1 },
  (_, index) => {
    const value = index * PLANNER_SNAP_MINUTES;
    return { value, label: formatPlannerTime(value) };
  },
);

function purposeToDraft(purpose?: PlannerPurpose | null): PurposeDraft {
  return {
    title: purpose?.title ?? "",
    color: purpose?.color ?? "teal",
    targetMinutes: purpose?.targetMinutes ?? 60,
    role: purpose?.role ?? "primary",
    notes: purpose?.notes ?? "",
  };
}

function getPurposeStyle(color: PlannerEventColor): CSSProperties {
  return { "--planner-purpose-color": COLOR_VARS[color] } as CSSProperties;
}

function formatPlannerCreationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Creation date unavailable";
  return `Created ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function EditablePlannerHeading({
  value,
  label,
  variant,
  onSave,
}: {
  value: string;
  label: string;
  variant: "title" | "subtitle";
  onSave: (value: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const finishEditing = (shouldSave: boolean) => {
    if (shouldSave) onSave(draft);
    else setDraft(value);
    setIsEditing(false);
  };

  const content = isEditing ? (
    <input
      ref={inputRef}
      aria-label={label}
      className={`planner-heading-input planner-heading-input--${variant}`}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finishEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finishEditing(true);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          finishEditing(false);
        }
      }}
    />
  ) : (
    <button
      type="button"
      className={`planner-heading-edit planner-heading-edit--${variant}`}
      aria-label={`${label}. Click to edit`}
      onClick={() => {
        setDraft(value);
        setIsEditing(true);
      }}
    >
      <span>{value}</span>
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );

  return variant === "title" ? <h1>{content}</h1> : <p>{content}</p>;
}

function PurposeFields({
  draft,
  onChange,
}: {
  draft: PurposeDraft;
  onChange: (draft: PurposeDraft) => void;
}) {
  const pct = ((draft.targetMinutes / MINUTES_PER_DAY) * 100).toFixed(1);

  return (
    <div className="planner-purpose-fields">
      <label className="planner-field">
        <span>Main focus</span>
        <input
          aria-label="Planner main focus title"
          className="planner-text-input"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          placeholder="Work, health, family, rest..."
        />
      </label>

      <div className="planner-field">
        <div className="planner-field-header-row">
          <span>Daily target</span>
          <span className="planner-target-badge">
            {formatPlannerDuration(draft.targetMinutes)}
            {draft.role === "primary" ? ` · ${pct}% of 24h` : " · overlap"}
          </span>
        </div>

        <div className="planner-field-grid">
          <div className="planner-hours-input-wrap">
            <input
              aria-label="Planner main focus target hours"
              className="planner-text-input"
              type="number"
              min="0"
              max="24"
              step="0.25"
              value={draft.targetMinutes / 60}
              onChange={(event) =>
                onChange({
                  ...draft,
                  targetMinutes: Math.min(
                    MINUTES_PER_DAY,
                    Math.max(0, Math.round(Number(event.target.value || 0) * 60)),
                  ),
                })
              }
            />
            <span>hours</span>
          </div>

          <div className="planner-stepper-row">
            <button
              type="button"
              className="planner-stepper-btn"
              aria-label="Decrease target by 15 minutes"
              onClick={() =>
                onChange({
                  ...draft,
                  targetMinutes: clampPlannerMinute(draft.targetMinutes - 15),
                })
              }
            >
              -15m
            </button>
            <button
              type="button"
              className="planner-stepper-btn"
              aria-label="Increase target by 15 minutes"
              onClick={() =>
                onChange({
                  ...draft,
                  targetMinutes: clampPlannerMinute(draft.targetMinutes + 15),
                })
              }
            >
              +15m
            </button>
            <button
              type="button"
              className="planner-stepper-btn"
              aria-label="Decrease target by 1 hour"
              onClick={() =>
                onChange({
                  ...draft,
                  targetMinutes: clampPlannerMinute(draft.targetMinutes - 60),
                })
              }
            >
              -1h
            </button>
            <button
              type="button"
              className="planner-stepper-btn"
              aria-label="Increase target by 1 hour"
              onClick={() =>
                onChange({
                  ...draft,
                  targetMinutes: clampPlannerMinute(draft.targetMinutes + 60),
                })
              }
            >
              +1h
            </button>
          </div>
        </div>

        <div className="planner-preset-row" aria-label="Quick target presets">
          {[
            { label: "30m", minutes: 30 },
            { label: "1h", minutes: 60 },
            { label: "2h", minutes: 120 },
            { label: "4h", minutes: 240 },
            { label: "6h", minutes: 360 },
            { label: "8h", minutes: 480 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="planner-preset-pill"
              aria-label={`Set target to ${preset.label}`}
              aria-pressed={draft.targetMinutes === preset.minutes}
              onClick={() => onChange({ ...draft, targetMinutes: preset.minutes })}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="planner-field-grid">
        <label className="planner-field">
          <span>Role</span>
          <select
            aria-label="Planner main focus allocation role"
            className="planner-select"
            value={draft.role}
            onChange={(event) =>
              onChange({
                ...draft,
                role: event.target.value as PlannerPurposeRole,
              })
            }
          >
            <option value="primary">Primary · counts toward 24h</option>
            <option value="secondary">Secondary · may overlap</option>
          </select>
        </label>

        <div className="planner-field">
          <span>Color</span>
          <div className="planner-color-row">
            {PLANNER_EVENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                aria-pressed={draft.color === color}
                className="planner-color-swatch"
                style={getPurposeStyle(color)}
                onClick={() => onChange({ ...draft, color })}
              >
                <span className="planner-purpose-dot" />
                {COLOR_LABELS[color]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="planner-field">
        <span>Intentions & notes</span>
        <textarea
          aria-label="Planner main focus notes"
          className="planner-textarea"
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          placeholder="Why this focus matters and how you want to protect it..."
          rows={2}
        />
      </label>
    </div>
  );
}

function UnifiedFocusCard({
  purpose,
  isSelected,
  scheduledEvents,
  effectiveEventId,
  onSelect,
  onSelectEvent,
  onUpdateTitle,
  onAdjustMinutes,
  onToggleRole,
  onAddBlock,
  onUpdateEventRange,
  onUpdateEventTitle,
  onDeleteEvent,
  onDeletePurpose,
  onChangeColor,
  onChangeNotes,
  onApplyDaysToggle,
  applyDays,
  effectiveDayKey,
}: {
  purpose: PlannerPurpose;
  isSelected: boolean;
  scheduledEvents: PlannerEvent[];
  effectiveEventId: string | null;
  onSelect: () => void;
  onSelectEvent: (eventId: string) => void;
  onUpdateTitle: (title: string) => void;
  onAdjustMinutes: (delta: number) => void;
  onToggleRole: () => void;
  onAddBlock: () => void;
  onUpdateEventRange: (event: PlannerEvent, start: number, end: number) => void;
  onUpdateEventTitle: (event: PlannerEvent, title: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onDeletePurpose: () => void;
  onChangeColor: (color: PlannerEventColor) => void;
  onChangeNotes: (notes: string) => void;
  onApplyDaysToggle: (dayKey: PlannerDayKey) => void;
  applyDays: PlannerDayKey[];
  effectiveDayKey: PlannerDayKey;
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(purpose.title);
  const [isExpanded, setIsExpanded] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleDraft(purpose.title);
  }, [purpose.title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const scheduledMinutes = scheduledEvents.reduce(
    (sum, event) => sum + (event.endMinutes - event.startMinutes),
    0,
  );

  const pct = ((purpose.targetMinutes / MINUTES_PER_DAY) * 100).toFixed(1);
  const progressRatio = purpose.targetMinutes > 0 ? (scheduledMinutes / purpose.targetMinutes) * 100 : 0;

  const finishTitleEdit = (save: boolean) => {
    if (save && titleDraft.trim() && titleDraft.trim() !== purpose.title) {
      onUpdateTitle(titleDraft.trim());
    } else {
      setTitleDraft(purpose.title);
    }
    setIsEditingTitle(false);
  };

  return (
    <div
      className={`planner-unified-card${isSelected ? " planner-unified-card--active" : ""}`}
      style={getPurposeStyle(purpose.color)}
      onClick={onSelect}
    >
      {/* Top Header Row */}
      <div className="planner-unified-card-top">
        <div className="planner-unified-card-title-wrap">
          <span className="planner-purpose-dot" />
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              aria-label={`Edit title for ${purpose.title}`}
              className="planner-allocation-card-title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => finishTitleEdit(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  finishTitleEdit(true);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  finishTitleEdit(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              className="planner-allocation-card-title-btn"
              aria-label={`${purpose.title}, click to edit title`}
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
            >
              <strong>{purpose.title}</strong>
              <Pencil className="h-3 w-3 text-[var(--ink-700)] opacity-60" />
            </button>
          )}
        </div>

        <div className="planner-unified-card-top-actions">
          <button
            type="button"
            aria-label={`Toggle role for ${purpose.title}, currently ${purpose.role}`}
            className={`planner-allocation-role-badge planner-allocation-role-badge--${purpose.role}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleRole();
            }}
          >
            {purpose.role === "primary" ? "Primary · 24h" : "Secondary · Overlap"}
          </button>

          <button
            type="button"
            aria-label={isExpanded ? `Collapse settings for ${purpose.title}` : `Expand settings for ${purpose.title}`}
            className="planner-card-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((expanded) => !expanded);
            }}
          >
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Target & Stepper Row */}
      <div className="planner-unified-card-target-row">
        <div className="planner-allocation-time-controls">
          <button
            type="button"
            aria-label={`Decrease ${purpose.title} target by 1 hour`}
            className="planner-allocation-card-stepper"
            onClick={(e) => {
              e.stopPropagation();
              onAdjustMinutes(-60);
            }}
          >
            -1h
          </button>
          <button
            type="button"
            aria-label={`Decrease ${purpose.title} target by 15 minutes`}
            className="planner-allocation-card-stepper"
            onClick={(e) => {
              e.stopPropagation();
              onAdjustMinutes(-15);
            }}
          >
            -15m
          </button>
          <span className="planner-allocation-duration">
            {formatPlannerDuration(purpose.targetMinutes)}
          </span>
          <button
            type="button"
            aria-label={`Increase ${purpose.title} target by 15 minutes`}
            className="planner-allocation-card-stepper"
            onClick={(e) => {
              e.stopPropagation();
              onAdjustMinutes(15);
            }}
          >
            +15m
          </button>
          <button
            type="button"
            aria-label={`Increase ${purpose.title} target by 1 hour`}
            className="planner-allocation-card-stepper"
            onClick={(e) => {
              e.stopPropagation();
              onAdjustMinutes(60);
            }}
          >
            +1h
          </button>
        </div>

        <span className="planner-allocation-pct">
          {purpose.role === "primary" ? `${pct}% of 24h` : "overlap target"}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="planner-unified-card-progress-wrap">
        <div className="planner-allocation-progress-bar">
          <div
            className="planner-allocation-progress-fill"
            style={{ width: `${Math.min(100, progressRatio)}%` }}
          />
        </div>
        <div className="planner-allocation-scheduled-info">
          <span>
            {formatPlannerDuration(scheduledMinutes)} of {formatPlannerDuration(purpose.targetMinutes)} scheduled
          </span>
          {scheduledMinutes < purpose.targetMinutes ? (
            <small>({formatPlannerDuration(purpose.targetMinutes - scheduledMinutes)} remaining)</small>
          ) : scheduledMinutes > purpose.targetMinutes ? (
            <small>({formatPlannerDuration(scheduledMinutes - purpose.targetMinutes)} over target)</small>
          ) : (
            <small>(target reached)</small>
          )}
        </div>
      </div>

      {/* Child Time Blocks */}
      <div className="planner-card-blocks-section">
        <div className="planner-card-blocks-header">
          <span>Scheduled clock blocks</span>
          <button
            type="button"
            className="planner-add-slice-btn"
            aria-label={`Add time block to ${purpose.title}`}
            onClick={(e) => {
              e.stopPropagation();
              onAddBlock();
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add block</span>
          </button>
        </div>

        {scheduledEvents.length > 0 ? (
          <div className="planner-card-blocks-list">
            {scheduledEvents.map((event) => {
              const isEventSelected = event.id === effectiveEventId;
              return (
                <div
                  key={event.id}
                  className={`planner-card-block-item${isEventSelected ? " planner-card-block-item--active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent(event.id);
                  }}
                >
                    <div className="planner-card-block-summary">
                      <span className="planner-child-block-marker" />
                      <strong>{event.title}</strong>
                      <span className="planner-card-block-time">
                        {formatPlannerTime(event.startMinutes)} – {formatPlannerTime(event.endMinutes)}
                      </span>
                      <span className="planner-card-block-dur">
                        ({formatPlannerDuration(event.endMinutes - event.startMinutes)})
                      </span>
                    </div>

                  {isEventSelected && (
                    <div className="planner-card-block-edit" onClick={(e) => e.stopPropagation()}>
                      <div className="planner-card-block-inputs">
                        <label className="planner-field">
                          <span>Label</span>
                          <input
                            aria-label="Planner time block title"
                            className="planner-text-input"
                            defaultValue={event.title}
                            onBlur={(e) => {
                              const newTitle = e.currentTarget.value.trim();
                              if (newTitle && newTitle !== event.title) {
                                onUpdateEventTitle(event, newTitle);
                              }
                            }}
                          />
                        </label>
                        <div className="planner-field-grid">
                          <label className="planner-field">
                            <span>Start</span>
                            <select
                              aria-label="Planner time block start time"
                              className="planner-select"
                              value={plannerMinutesToInputValue(event.startMinutes)}
                              onChange={(e) => {
                                const nextStart = plannerInputValueToMinutes(e.target.value);
                                onUpdateEventRange(
                                  event,
                                  Math.min(nextStart, event.endMinutes - PLANNER_SNAP_MINUTES),
                                  event.endMinutes,
                                );
                              }}
                            >
                              {TIME_OPTIONS.slice(0, -1).map((opt) => (
                                <option key={opt.value} value={plannerMinutesToInputValue(opt.value)}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="planner-field">
                            <span>End</span>
                            <select
                              aria-label="Planner time block end time"
                              className="planner-select"
                              value={
                                event.endMinutes === MINUTES_PER_DAY
                                  ? "24:00"
                                  : plannerMinutesToInputValue(event.endMinutes)
                              }
                              onChange={(e) => {
                                const nextEnd =
                                  e.target.value === "24:00"
                                    ? MINUTES_PER_DAY
                                    : plannerInputValueToMinutes(e.target.value);
                                onUpdateEventRange(
                                  event,
                                  event.startMinutes,
                                  Math.max(nextEnd, event.startMinutes + PLANNER_SNAP_MINUTES),
                                );
                              }}
                            >
                              {TIME_OPTIONS.slice(1).map((opt) => (
                                <option
                                  key={opt.value}
                                  value={
                                    opt.value === MINUTES_PER_DAY
                                      ? "24:00"
                                      : plannerMinutesToInputValue(opt.value)
                                  }
                                >
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="planner-delete-slice"
                        aria-label={`Delete ${event.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEvent(event.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete block</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="planner-card-blocks-empty">No time blocks scheduled on the clock yet.</p>
        )}
      </div>

      {/* Expanded Settings & Controls */}
      {isExpanded && (
        <div className="planner-unified-card-expanded" onClick={(e) => e.stopPropagation()}>
          <div className="planner-field">
            <span>Color theme</span>
            <div className="planner-color-row">
              {PLANNER_EVENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Color ${color}`}
                  aria-pressed={purpose.color === color}
                  className="planner-color-swatch"
                  style={getPurposeStyle(color)}
                  onClick={() => onChangeColor(color)}
                >
                  <span className="planner-purpose-dot" />
                  {COLOR_LABELS[color]}
                </button>
              ))}
            </div>
          </div>

          <div className="planner-field">
            <span>Quick target presets</span>
            <div className="planner-preset-row">
              {[
                { label: "30m", minutes: 30 },
                { label: "1h", minutes: 60 },
                { label: "2h", minutes: 120 },
                { label: "4h", minutes: 240 },
                { label: "6h", minutes: 360 },
                { label: "8h", minutes: 480 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="planner-preset-pill"
                  aria-label={`Set target to ${preset.label}`}
                  aria-pressed={purpose.targetMinutes === preset.minutes}
                  onClick={() => onAdjustMinutes(preset.minutes - purpose.targetMinutes)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <label className="planner-field">
            <span>Notes & Intentions</span>
            <textarea
              aria-label={`Notes for ${purpose.title}`}
              className="planner-textarea"
              defaultValue={purpose.notes}
              placeholder="Why this focus matters..."
              rows={2}
              onBlur={(e) => onChangeNotes(e.target.value)}
            />
          </label>

          <PlannerDayPicker
            selectedDayKey={effectiveDayKey}
            selectedDays={applyDays}
            onToggle={onApplyDaysToggle}
            label="Apply to other days"
          />

          <AlertDialog>
            <AlertDialogTrigger
              type="button"
              className="planner-delete-purpose"
              aria-label={`Delete ${purpose.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete main focus</span>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete main focus?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes &quot;{purpose.title}&quot; and all of its scheduled time blocks from {DAY_LABELS[effectiveDayKey]}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDeletePurpose}>
                  Delete main focus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

function PlannerDayPicker({
  selectedDayKey,
  selectedDays,
  onToggle,
  label,
}: {
  selectedDayKey: PlannerDayKey;
  selectedDays: PlannerDayKey[];
  onToggle: (dayKey: PlannerDayKey) => void;
  label: string;
}) {
  return (
    <div className="planner-apply-days">
      <span>{label}</span>
      <div className="planner-apply-day-grid">
        {PLANNER_DAY_ORDER.map((dayKey) => {
          const isSource = dayKey === selectedDayKey;
          return (
            <label key={dayKey} className="planner-apply-day">
              <input
                type="checkbox"
                checked={selectedDays.includes(dayKey)}
                disabled={isSource}
                aria-label={`${label} ${DAY_LABELS[dayKey]}`}
                onChange={() => onToggle(dayKey)}
              />
              <span title={DAY_LABELS[dayKey]}>{DAY_SHORT_LABELS[dayKey]}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function PlannerView(props: Props) {
  const presetId = props.state.uiState.selectedPlannerPresetId;
  const preset = presetId ? props.state.plannerPresets[presetId] : null;

  if (!preset || !presetId) {
    return (
      <section className="empty-view-container">
        <div className="empty-view">
          <Layers3 className="mb-3 h-8 w-8 text-[var(--ink-700)] opacity-30" />
          <p className="text-sm text-[var(--ink-700)]">
            Create or select a daily plan to start planning.
          </p>
        </div>
      </section>
    );
  }

  return <PlannerPresetView key={presetId} {...props} />;
}

function PlannerPresetView({ state, dispatch }: Props) {
  const presetId = state.uiState.selectedPlannerPresetId!;
  const preset = state.plannerPresets[presetId];
  const initialDayKey = preset.dayOrder[0] ?? "monday";
  const initialDay = preset.days[initialDayKey];
  const initialPurpose = initialDay.purposes[0] ?? null;
  const [selectedDayKey, setSelectedDayKey] = useState<PlannerDayKey>(initialDayKey);
  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(
    initialPurpose?.id ?? null,
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialDay.events.find((event) => event.purposeId === initialPurpose?.id)?.id ?? null,
  );
  const [isDetailsVisible, setIsDetailsVisible] = useState(true);
  const [isTourOpen, setIsTourOpen] = useState(() => !state.uiState.hasSeenPlannerTour);
  const [isCreatingPurpose, setIsCreatingPurpose] = useState(false);
  const [purposeDraft, setPurposeDraft] = useState<PurposeDraft>(() =>
    purposeToDraft(initialPurpose),
  );
  const [applyDayKeys, setApplyDayKeys] = useState<PlannerDayKey[]>([initialDayKey]);
  const [dayTitleDraft, setDayTitleDraft] = useState(initialDay.title);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);

  const effectiveDayKey = selectedDayKey;
  const day = preset.days[effectiveDayKey];
  const purposes = useMemo(() => day.purposes, [day.purposes]);
  const purposeById = useMemo(
    () => new Map(purposes.map((purpose) => [purpose.id, purpose])),
    [purposes],
  );
  const effectivePurposeId =
    selectedPurposeId && purposeById.has(selectedPurposeId)
      ? selectedPurposeId
      : purposes[0]?.id ?? null;
  const selectedPurpose = effectivePurposeId ? purposeById.get(effectivePurposeId) ?? null : null;
  const purposeEvents = useMemo(
    () =>
      day && effectivePurposeId
        ? day.events.filter((event) => event.purposeId === effectivePurposeId)
        : [],
    [day, effectivePurposeId],
  );
  const effectiveEventId =
    selectedEventId && purposeEvents.some((event) => event.id === selectedEventId)
      ? selectedEventId
      : purposeEvents[0]?.id ?? null;

  const displayEvents = useMemo(
    () =>
      day.events.map((event) =>
        dragPreview?.eventId === event.id
          ? {
              ...event,
              startMinutes: dragPreview.startMinutes,
              endMinutes: dragPreview.endMinutes,
            }
          : event,
      ),
    [day.events, dragPreview],
  );
  const eventLayouts = useMemo(() => assignPlannerEventLanes(displayEvents), [displayEvents]);
  const laneCount = Math.max(1, ...eventLayouts.map((layout) => layout.lane + 1));

  const primaryAllocatedMinutes = purposes.reduce(
    (total, purpose) =>
      purpose.role === "primary" ? total + purpose.targetMinutes : total,
    0,
  );
  const totalScheduledMinutes = displayEvents.reduce(
    (total, event) => total + (event.endMinutes - event.startMinutes),
    0,
  );

  const selectedScheduledMinutes = selectedPurpose
    ? getPlannerPurposeScheduledMinutes(displayEvents, selectedPurpose.id)
    : 0;
  const selectedDisplayEvent = effectiveEventId
    ? displayEvents.find((event) => event.id === effectiveEventId) ?? null
    : null;

  const selectPurpose = (purposeId: string) => {
    const purpose = day.purposes.find((candidate) => candidate.id === purposeId) ?? null;
    setSelectedPurposeId(purposeId);
    const firstEvent = day.events.find((event) => event.purposeId === purposeId);
    setSelectedEventId(firstEvent?.id ?? null);
    setPurposeDraft(purposeToDraft(purpose));
    setApplyDayKeys([effectiveDayKey]);
    setIsCreatingPurpose(false);
  };

  const selectTimeBlock = (purposeId: string, eventId: string) => {
    selectPurpose(purposeId);
    setSelectedEventId(eventId);
  };

  const selectDay = (dayKey: PlannerDayKey) => {
    const nextDay = preset.days[dayKey];
    const nextPurpose = nextDay.purposes[0] ?? null;
    setSelectedDayKey(dayKey);
    setSelectedPurposeId(nextPurpose?.id ?? null);
    setSelectedEventId(
      nextDay.events.find((event) => event.purposeId === nextPurpose?.id)?.id ?? null,
    );
    setPurposeDraft(purposeToDraft(nextPurpose));
    setApplyDayKeys([dayKey]);
    setDayTitleDraft(nextDay.title);
    setIsCreatingPurpose(false);
    setDragPreview(null);
    dragStateRef.current = null;
  };

  const toggleApplyDay = (dayKey: PlannerDayKey) => {
    if (dayKey === effectiveDayKey) return;
    setApplyDayKeys((current) =>
      current.includes(dayKey)
        ? current.filter((candidate) => candidate !== dayKey)
        : [...current, dayKey],
    );
  };

  const handlePurposeDraftChange = (nextDraft: PurposeDraft) => {
    setPurposeDraft(nextDraft);
    if (!selectedPurpose) return;
    dispatch({
      type: "update-planner-purpose",
      presetId,
      dayKey: effectiveDayKey,
      purposeId: selectedPurpose.id,
      updates: {
        title: nextDraft.title.trim() || selectedPurpose.title,
        color: nextDraft.color,
        targetMinutes: nextDraft.targetMinutes,
        role: nextDraft.role,
        notes: nextDraft.notes,
      },
    });
  };

  const handleDirectPurposeTitleUpdate = (purposeId: string, title: string) => {
    if (!title.trim()) return;
    dispatch({
      type: "update-planner-purpose",
      presetId,
      dayKey: effectiveDayKey,
      purposeId,
      updates: { title: title.trim() },
    });
    if (selectedPurposeId === purposeId) {
      setPurposeDraft((prev) => ({ ...prev, title: title.trim() }));
    }
  };

  const handleDirectPurposeTargetAdjust = (purpose: PlannerPurpose, delta: number) => {
    const nextTarget = clampPlannerMinute(purpose.targetMinutes + delta);
    dispatch({
      type: "update-planner-purpose",
      presetId,
      dayKey: effectiveDayKey,
      purposeId: purpose.id,
      updates: { targetMinutes: nextTarget },
    });
    if (selectedPurposeId === purpose.id) {
      setPurposeDraft((prev) => ({ ...prev, targetMinutes: nextTarget }));
    }
  };

  const handleDirectPurposeRoleToggle = (purpose: PlannerPurpose) => {
    const nextRole: PlannerPurposeRole = purpose.role === "primary" ? "secondary" : "primary";
    dispatch({
      type: "update-planner-purpose",
      presetId,
      dayKey: effectiveDayKey,
      purposeId: purpose.id,
      updates: { role: nextRole },
    });
    if (selectedPurposeId === purpose.id) {
      setPurposeDraft((prev) => ({ ...prev, role: nextRole }));
    }
  };

  const handleDirectPurposeColorChange = (purposeId: string, color: PlannerEventColor) => {
    dispatch({
      type: "update-planner-purpose",
      presetId,
      dayKey: effectiveDayKey,
      purposeId,
      updates: { color },
    });
    if (selectedPurposeId === purposeId) {
      setPurposeDraft((prev) => ({ ...prev, color }));
    }
  };

  const handleDirectPurposeNotesChange = (purposeId: string, notes: string) => {
    dispatch({
      type: "update-planner-purpose",
      presetId,
      dayKey: effectiveDayKey,
      purposeId,
      updates: { notes },
    });
    if (selectedPurposeId === purposeId) {
      setPurposeDraft((prev) => ({ ...prev, notes }));
    }
  };

  const addSliceForPurpose = (purposeId: string) => {
    const targetPurpose = purposeById.get(purposeId);
    if (!targetPurpose) return;
    const existingEvents = day.events.filter((e) => e.purposeId === purposeId);
    const range = getDefaultPlannerSliceRange(displayEvents);
    const eventId = makeId("evt");
    const eventTitle = `${targetPurpose.title} ${existingEvents.length + 1}`;
    dispatch({
      type: "create-planner-event",
      presetId,
      eventId,
      dayKey: effectiveDayKey,
      purposeId: targetPurpose.id,
      title: eventTitle,
      startMinutes: range.startMinutes,
      endMinutes: range.endMinutes,
      color: targetPurpose.color,
      notes: "",
    });
    setSelectedPurposeId(purposeId);
    setSelectedEventId(eventId);
    setPurposeDraft(purposeToDraft(targetPurpose));
  };

  const addSlice = () => {
    if (!selectedPurpose) return;
    addSliceForPurpose(selectedPurpose.id);
  };

  const updateEventRange = (event: PlannerEvent, startMinutes: number, endMinutes: number) => {
    dispatch({
      type: "update-planner-event",
      presetId,
      dayKey: effectiveDayKey,
      eventId: event.id,
      updates: {
        startMinutes: clampPlannerMinute(startMinutes),
        endMinutes: clampPlannerMinute(endMinutes),
      },
    });
  };

  const deleteEvent = (eventId: string) => {
    dispatch({
      type: "delete-planner-event",
      presetId,
      dayKey: effectiveDayKey,
      eventId,
    });
    const nextEvent = purposeEvents.find((event) => event.id !== eventId) ?? null;
    setSelectedEventId(nextEvent?.id ?? null);
  };

  const createPurpose = () => {
    const title = purposeDraft.title.trim();
    if (!title) return;
    const purpose = createPlannerPurpose({
      title,
      color: purposeDraft.color,
      targetMinutes: purposeDraft.targetMinutes,
      role: purposeDraft.role,
      notes: purposeDraft.notes,
    });
    dispatch({
      type: "create-planner-purpose",
      presetId,
      dayKeys: applyDayKeys.length ? applyDayKeys : [effectiveDayKey],
      purpose,
    });
    setSelectedPurposeId(purpose.id);
    setSelectedEventId(null);
    setIsCreatingPurpose(false);
    setPurposeDraft(purposeToDraft(purpose));
    setApplyDayKeys([effectiveDayKey]);
  };

  const savePurpose = () => {
    if (!selectedPurpose) return;
    const title = purposeDraft.title.trim();
    if (!title) return;
    dispatch({
      type: "update-planner-purpose",
      presetId,
      dayKey: effectiveDayKey,
      purposeId: selectedPurpose.id,
      updates: {
        title,
        color: purposeDraft.color,
        targetMinutes: purposeDraft.targetMinutes,
        role: purposeDraft.role,
        notes: purposeDraft.notes,
      },
    });
  };

  const deletePurpose = (purposeId: string) => {
    const nextPurpose = purposes.find((candidate) => candidate.id !== purposeId) ?? null;
    dispatch({
      type: "delete-planner-purpose",
      presetId,
      dayKey: effectiveDayKey,
      purposeId,
    });
    setSelectedPurposeId(nextPurpose?.id ?? null);
    setSelectedEventId(
      day.events.find((event) => event.purposeId === nextPurpose?.id)?.id ?? null,
    );
    setPurposeDraft(purposeToDraft(nextPurpose));
    setApplyDayKeys([effectiveDayKey]);
  };

  const getMinuteFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const chart = chartRef.current;
    if (!chart) return 0;
    const rect = chart.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const angle = Math.atan2(y, x);
    let degrees = angle * (180 / Math.PI) + 90;
    if (degrees < 0) degrees += 360;
    const rawMinutes = (degrees / 360) * MINUTES_PER_DAY;
    return snapPlannerMinute(rawMinutes);
  };

  const startHandleDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    eventId: string,
    edge: "start" | "end",
  ) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = { eventId, edge };
    const targetEvent = displayEvents.find((candidate) => candidate.id === eventId);
    if (!targetEvent) return;
    setDragPreview({
      eventId,
      startMinutes: targetEvent.startMinutes,
      endMinutes: targetEvent.endMinutes,
    });
  };

  const handleChartPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const minute = getMinuteFromPointer(event);
    setDragPreview((current) => {
      const targetEvent = displayEvents.find((candidate) => candidate.id === dragState.eventId);
      if (!targetEvent) return current;
      const baseStart = current?.startMinutes ?? targetEvent.startMinutes;
      const baseEnd = current?.endMinutes ?? targetEvent.endMinutes;
      if (dragState.edge === "start") {
        const nextStart = Math.min(minute, baseEnd - PLANNER_SNAP_MINUTES);
        return {
          eventId: dragState.eventId,
          startMinutes: clampPlannerMinute(nextStart),
          endMinutes: baseEnd,
        };
      }
      const nextEnd = Math.max(minute, baseStart + PLANNER_SNAP_MINUTES);
      return {
        eventId: dragState.eventId,
        startMinutes: baseStart,
        endMinutes: clampPlannerMinute(nextEnd),
      };
    });
  };

  const finishHandleDrag = () => {
    const dragState = dragStateRef.current;
    if (!dragState || !dragPreview) {
      dragStateRef.current = null;
      setDragPreview(null);
      return;
    }
    const targetEvent = displayEvents.find((candidate) => candidate.id === dragState.eventId);
    if (targetEvent) {
      updateEventRange(targetEvent, dragPreview.startMinutes, dragPreview.endMinutes);
    }
    dragStateRef.current = null;
    setDragPreview(null);
  };

  const adjustEventHandleByKeyboard = (
    event: ReactKeyboardEvent<SVGCircleElement>,
    eventId: string,
    edge: "start" | "end",
  ) => {
    const targetEvent = displayEvents.find((candidate) => candidate.id === eventId);
    if (!targetEvent) return;
    const delta = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -PLANNER_SNAP_MINUTES : PLANNER_SNAP_MINUTES;
    if (edge === "start") {
      updateEventRange(
        targetEvent,
        Math.min(targetEvent.startMinutes + delta, targetEvent.endMinutes - PLANNER_SNAP_MINUTES),
        targetEvent.endMinutes,
      );
    } else {
      updateEventRange(
        targetEvent,
        targetEvent.startMinutes,
        Math.max(targetEvent.endMinutes + delta, targetEvent.startMinutes + PLANNER_SNAP_MINUTES),
      );
    }
  };

  const laneRadius = (lane: number) => {
    const baseOuter = 265;
    const laneWidth = 24;
    const laneGap = 6;
    const outer = baseOuter - lane * (laneWidth + laneGap);
    const inner = outer - laneWidth;
    return { inner, outer };
  };

  const selectedLayout = eventLayouts.find((layout) => layout.event.id === effectiveEventId);
  const selectedEventForHandles = selectedLayout?.event ?? null;
  const allocatedDifference = MINUTES_PER_DAY - primaryAllocatedMinutes;

  const closeTour = () => {
    setIsTourOpen(false);
    if (!state.uiState.hasSeenPlannerTour) {
      dispatch({ type: "complete-planner-tour" });
    }
  };

  return (
    <section className="planner-layout">
      <div className="planner-radial-board">
        <header className="planner-radial-header">
          <div className="planner-heading-copy" data-planner-tour="heading">
            <p className="planner-kicker">
              <span>Daily planner</span>
              <span aria-hidden="true">·</span>
              <time dateTime={preset.createdAt}>{formatPlannerCreationDate(preset.createdAt)}</time>
            </p>
            <EditablePlannerHeading
              value={preset.name}
              label="Planner title"
              variant="title"
              onSave={(name) => dispatch({ type: "rename-planner-preset", presetId, name })}
            />
            <EditablePlannerHeading
              value={preset.subtitle}
              label="Planner subtitle"
              variant="subtitle"
              onSave={(subtitle) =>
                dispatch({ type: "update-planner-preset-subtitle", presetId, subtitle })
              }
            />
          </div>
          <div className="planner-header-actions">
            <button
              type="button"
              className="planner-secondary-btn planner-add-purpose"
              onClick={() => {
                setPurposeDraft(purposeToDraft());
                setApplyDayKeys([effectiveDayKey]);
                setIsCreatingPurpose(true);
                setIsDetailsVisible(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add focus
            </button>
            <button
              type="button"
              className="planner-secondary-btn planner-guide-btn"
              onClick={() => setIsTourOpen(true)}
            >
              <CircleHelp className="h-4 w-4" />
              Guide
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="planner-details-toggle"
                  aria-label={isDetailsVisible ? "Hide planner details" : "Show planner details"}
                  onClick={() => setIsDetailsVisible((visible) => !visible)}
                >
                  {isDetailsVisible ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                  <span>{isDetailsVisible ? "Hide details" : "Show details"}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isDetailsVisible ? "Give the clock more room" : "Open focus & budget panel"}
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Weekday Selector Bar */}
        <div className="planner-radial-controls">
          <div className="planner-day-tabs" aria-label="Planner day" data-planner-tour="days">
            {preset.dayOrder.map((dayKey) => (
              <button
                key={dayKey}
                type="button"
                aria-label={DAY_LABELS[dayKey]}
                aria-pressed={effectiveDayKey === dayKey}
                onClick={() => selectDay(dayKey)}
              >
                <span className="planner-day-full-label">{DAY_LABELS[dayKey]}</span>
                <span className="planner-day-short-label">{DAY_SHORT_LABELS[dayKey]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Stage */}
        <div className={`planner-radial-stage${isDetailsVisible ? "" : " planner-radial-stage--wide"}`}>
          {/* Left Canvas: 24-Hour Radial Clock */}
          <div className="planner-wheel-panel" data-planner-tour="wheel">
            <div className="planner-wheel-header">
              <label>
                <span>{DAY_LABELS[effectiveDayKey]}</span>
                <input
                  aria-label={`${DAY_LABELS[effectiveDayKey]} title`}
                  value={dayTitleDraft}
                  onChange={(event) => setDayTitleDraft(event.target.value)}
                  onBlur={() =>
                    dispatch({
                      type: "rename-planner-day",
                      presetId,
                      dayKey: effectiveDayKey,
                      title: dayTitleDraft,
                    })
                  }
                />
              </label>
              <div className="planner-wheel-header-metrics">
                <span
                  className={`planner-wheel-status${allocatedDifference < 0 ? " planner-wheel-status--warning" : ""}`}
                >
                  {allocatedDifference >= 0
                    ? `${formatPlannerDuration(allocatedDifference)} open`
                    : `${formatPlannerDuration(Math.abs(allocatedDifference))} over`}
                </span>
                <span className="planner-wheel-status">
                  <Layers2 className="h-4 w-4" />
                  {laneCount === 1 ? "No overlaps" : `${laneCount} overlap lanes`}
                </span>
              </div>
            </div>

            <div className="planner-wheel-wrap">
              <svg
                ref={chartRef}
                className="planner-wheel"
                viewBox="0 0 600 600"
                role="img"
                aria-label={`${DAY_LABELS[effectiveDayKey]} radial schedule`}
                onPointerMove={handleChartPointerMove}
                onPointerUp={finishHandleDrag}
                onPointerCancel={finishHandleDrag}
              >
                <title id="planner-wheel-title">
                  {`${DAY_LABELS[effectiveDayKey]} radial schedule`}
                </title>
                <desc id="planner-wheel-description">
                  A 24-hour radial timeline. Main focuses may contain multiple child blocks, and overlapping blocks use additional concentric rings.
                </desc>

                {/* Clock Ticks */}
                {Array.from({ length: 24 }, (_, hour) => {
                  const minutes = hour * 60;
                  const inner = getPlannerPoint(minutes, hour % 3 === 0 ? 270 : 276);
                  const outer = getPlannerPoint(minutes, 284);
                  return (
                    <line
                      key={hour}
                      className={`planner-wheel-tick${hour % 3 === 0 ? " planner-wheel-tick--major" : ""}`}
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                    />
                  );
                })}

                {/* Clock Hour Labels */}
                {CLOCK_LABELS.map(({ minutes, label }) => {
                  const point = getPlannerPoint(minutes, 294);
                  return (
                    <text
                      key={minutes}
                      className="planner-wheel-hour-label"
                      x={point.x}
                      y={point.y}
                    >
                      {label}
                    </text>
                  );
                })}

                {/* Concentric Lane Tracks */}
                {Array.from({ length: laneCount }, (_, lane) => {
                  const radii = laneRadius(lane);
                  return (
                    <circle
                      key={lane}
                      className="planner-wheel-track"
                      cx="300"
                      cy="300"
                      r={(radii.inner + radii.outer) / 2}
                      strokeWidth={radii.outer - radii.inner}
                    />
                  );
                })}

                {/* Scheduled Child Time Block Arcs */}
                {eventLayouts.map(({ event, lane }) => {
                  const purpose = event.purposeId ? purposeById.get(event.purposeId) : null;
                  const radii = laneRadius(lane);
                  const isSelected = purpose?.id === effectivePurposeId;
                  const isEventSelected = event.id === effectiveEventId;
                  return (
                    <path
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${event.title}, ${formatPlannerTime(event.startMinutes)} to ${formatPlannerTime(event.endMinutes)}${purpose ? ` under ${purpose.title}` : ""}`}
                      className={`planner-wheel-slice${isSelected ? " planner-wheel-slice--active" : ""}${isEventSelected ? " planner-wheel-slice--focused" : ""}`}
                      style={getPurposeStyle(event.color)}
                      d={getPlannerArcPath(event.startMinutes, event.endMinutes, radii.inner, radii.outer)}
                      onClick={() => selectTimeBlock(event.purposeId ?? "", event.id)}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                          keyEvent.preventDefault();
                          selectTimeBlock(event.purposeId ?? "", event.id);
                        }
                      }}
                    />
                  );
                })}

                {/* Draggable Arc Handles for Selected Time Block */}
                {selectedEventForHandles && (
                  (() => {
                    const radii = laneRadius(selectedLayout?.lane ?? 0);
                    const midRadius = (radii.inner + radii.outer) / 2;
                    const startPoint = getPlannerPoint(selectedEventForHandles.startMinutes, midRadius);
                    const endPoint = getPlannerPoint(selectedEventForHandles.endMinutes, midRadius);
                    return (
                      <g className="planner-drag-handles">
                        <circle
                          data-testid="planner-drag-handle-start"
                          tabIndex={0}
                          role="slider"
                          aria-label={`Start time for ${selectedEventForHandles.title}`}
                          aria-valuenow={selectedEventForHandles.startMinutes}
                          aria-valuetext={formatPlannerTime(selectedEventForHandles.startMinutes)}
                          className="planner-drag-handle"
                          cx={startPoint.x}
                          cy={startPoint.y}
                          r={11}
                          onPointerDown={(e) => startHandleDrag(e, selectedEventForHandles.id, "start")}
                          onKeyDown={(e) => adjustEventHandleByKeyboard(e, selectedEventForHandles.id, "start")}
                        />
                        <circle
                          data-testid="planner-drag-handle-end"
                          tabIndex={0}
                          role="slider"
                          aria-label={`End time for ${selectedEventForHandles.title}`}
                          aria-valuenow={selectedEventForHandles.endMinutes}
                          aria-valuetext={formatPlannerTime(selectedEventForHandles.endMinutes)}
                          className="planner-drag-handle"
                          cx={endPoint.x}
                          cy={endPoint.y}
                          r={11}
                          onPointerDown={(e) => startHandleDrag(e, selectedEventForHandles.id, "end")}
                          onKeyDown={(e) => adjustEventHandleByKeyboard(e, selectedEventForHandles.id, "end")}
                        />
                      </g>
                    );
                  })()
                )}

                {/* Center of the Radial Clock */}
                {selectedPurpose ? (
                  <g className="planner-wheel-center">
                    <circle
                      className="planner-wheel-center-bg"
                      cx="300"
                      cy="300"
                      r="108"
                    />
                    <circle
                      className="planner-wheel-center-progress-bg"
                      cx="300"
                      cy="300"
                      r="96"
                      fill="none"
                      stroke="color-mix(in srgb, var(--line) 40%, transparent)"
                      strokeWidth="6"
                    />
                    {selectedPurpose.targetMinutes > 0 && (
                      <circle
                        className="planner-wheel-center-progress-fill"
                        cx="300"
                        cy="300"
                        r="96"
                        fill="none"
                        stroke={COLOR_VARS[selectedPurpose.color]}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 96}
                        strokeDashoffset={
                          2 * Math.PI * 96 * (1 - Math.min(1, selectedScheduledMinutes / selectedPurpose.targetMinutes))
                        }
                        transform="rotate(-90 300 300)"
                      />
                    )}
                    <text className="planner-wheel-center-title" x="300" y="274">
                      {selectedPurpose.title}
                    </text>
                    <text className="planner-wheel-center-time" x="300" y="298">
                      {formatPlannerDuration(selectedScheduledMinutes)} / {formatPlannerDuration(selectedPurpose.targetMinutes)}
                    </text>
                    <text className="planner-wheel-center-caption" x="300" y="318">
                      {selectedPurpose.targetMinutes > 0
                        ? `${Math.round((selectedScheduledMinutes / selectedPurpose.targetMinutes) * 100)}% scheduled`
                        : "No target set"}
                    </text>
                    <text className="planner-wheel-center-secondary" x="300" y="336">
                      {selectedPurpose.role === "primary"
                        ? `${((selectedPurpose.targetMinutes / MINUTES_PER_DAY) * 100).toFixed(0)}% of 24h budget`
                        : "Secondary · Overlap"}
                    </text>
                  </g>
                ) : (
                  <g className="planner-wheel-center">
                    <circle
                      className="planner-wheel-center-bg"
                      cx="300"
                      cy="300"
                      r="108"
                    />
                    <text className="planner-wheel-center-title" x="300" y="278">
                      24-Hour Rhythm
                    </text>
                    <text className="planner-wheel-center-time" x="300" y="304">
                      {formatPlannerDuration(totalScheduledMinutes)} placed
                    </text>
                    <text className="planner-wheel-center-caption" x="300" y="326">
                      {formatPlannerDuration(primaryAllocatedMinutes)} budgeted
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Bottom Legend */}
            <div className="planner-wheel-legend" aria-label="Purpose colors">
              {purposes.map((purpose) => {
                const scheduled = getPlannerPurposeScheduledMinutes(day.events, purpose.id);
                return (
                  <button
                    key={purpose.id}
                    type="button"
                    aria-pressed={purpose.id === effectivePurposeId}
                    style={getPurposeStyle(purpose.color)}
                    onClick={() => selectPurpose(purpose.id)}
                  >
                    <span className="planner-purpose-dot" />
                    {purpose.title}
                    <small>
                      {formatPlannerDuration(scheduled)} / {formatPlannerDuration(purpose.targetMinutes)}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Canvas: Unified Focus Areas & Budget Panel */}
          {isDetailsVisible ? (
            <aside
              className="planner-details-panel"
              aria-label="Planner details"
              data-planner-tour="details"
            >
              <div className="planner-details-header">
                <div>
                  <p className="planner-editor-kicker">24-Hour Budget</p>
                  <h2>Focus areas &amp; schedule</h2>
                </div>
              </div>

              {/* Total Day Budget Summary Bar */}
              <div className="planner-budget-overview-card">
                <div className="planner-budget-overview-metrics">
                  <span>
                    <strong>{formatPlannerDuration(primaryAllocatedMinutes)}</strong> allocated
                  </span>
                  <span className={allocatedDifference < 0 ? "text-[var(--warn)]" : ""}>
                    <strong>{formatPlannerDuration(Math.abs(allocatedDifference))}</strong>{" "}
                    {allocatedDifference >= 0 ? "open" : "over"}
                  </span>
                </div>
                <div className="planner-allocation-progress-bar">
                  <div
                    className="planner-allocation-progress-fill"
                    style={{
                      width: `${Math.min(100, (primaryAllocatedMinutes / MINUTES_PER_DAY) * 100)}%`,
                      background:
                        allocatedDifference < 0
                          ? "var(--warn)"
                          : "var(--brand)",
                    }}
                  />
                </div>
              </div>

              {/* Focus Cards List or Create Mode */}
              {!isCreatingPurpose ? (
                <div
                  className="planner-purpose-list"
                  aria-label="Main focuses and child time blocks"
                >
                  {purposes.map((purpose) => {
                    const scheduledEvents = day.events.filter(
                      (event) => event.purposeId === purpose.id,
                    );
                    const isSelected = purpose.id === effectivePurposeId;
                    return (
                      <UnifiedFocusCard
                        key={purpose.id}
                        purpose={purpose}
                        isSelected={isSelected}
                        scheduledEvents={scheduledEvents}
                        effectiveEventId={effectiveEventId}
                        onSelect={() => selectPurpose(purpose.id)}
                        onSelectEvent={(eventId) => selectTimeBlock(purpose.id, eventId)}
                        onUpdateTitle={(title) => handleDirectPurposeTitleUpdate(purpose.id, title)}
                        onAdjustMinutes={(delta) => handleDirectPurposeTargetAdjust(purpose, delta)}
                        onToggleRole={() => handleDirectPurposeRoleToggle(purpose)}
                        onAddBlock={() => addSliceForPurpose(purpose.id)}
                        onUpdateEventRange={updateEventRange}
                        onUpdateEventTitle={(event, title) => {
                          dispatch({
                            type: "update-planner-event",
                            presetId,
                            dayKey: effectiveDayKey,
                            eventId: event.id,
                            updates: { title },
                          });
                        }}
                        onDeleteEvent={deleteEvent}
                        onDeletePurpose={() => deletePurpose(purpose.id)}
                        onChangeColor={(color) => handleDirectPurposeColorChange(purpose.id, color)}
                        onChangeNotes={(notes) => handleDirectPurposeNotesChange(purpose.id, notes)}
                        onApplyDaysToggle={toggleApplyDay}
                        applyDays={applyDayKeys}
                        effectiveDayKey={effectiveDayKey}
                      />
                    );
                  })}

                  {!purposes.length ? (
                    <p className="planner-purpose-empty">No main focuses on {DAY_LABELS[effectiveDayKey]} yet.</p>
                  ) : null}

                  <button
                    type="button"
                    className="planner-empty-add"
                    onClick={() => {
                      setPurposeDraft(purposeToDraft());
                      setApplyDayKeys([effectiveDayKey]);
                      setIsCreatingPurpose(true);
                    }}
                  >
                    <Plus className="h-5 w-5" />
                    Add new focus
                  </button>
                </div>
              ) : (
                <div className="planner-purpose-editor">
                  <PurposeFields draft={purposeDraft} onChange={setPurposeDraft} />
                  <PlannerDayPicker
                    selectedDayKey={effectiveDayKey}
                    selectedDays={applyDayKeys}
                    onToggle={toggleApplyDay}
                    label="Create on"
                  />
                  <div className="planner-editor-actions">
                    <button
                      type="button"
                      className="planner-secondary-btn"
                      onClick={() => {
                        setIsCreatingPurpose(false);
                        setPurposeDraft(purposeToDraft(selectedPurpose));
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="planner-primary-btn"
                      disabled={!purposeDraft.title.trim()}
                      onClick={createPurpose}
                    >
                      Create main focus
                    </button>
                  </div>
                </div>
              )}
            </aside>
          ) : null}
        </div>
      </div>
      <PlannerTour open={isTourOpen} onClose={closeTour} />
    </section>
  );
}
