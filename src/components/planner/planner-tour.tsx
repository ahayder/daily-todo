"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";

type TourStep = {
  target: string;
  eyebrow: string;
  title: string;
  description: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-planner-tour="heading"]',
    eyebrow: "Make it yours",
    title: "Click the title or subtitle to edit",
    description:
      "Each planner is a reusable page.",
  },
  {
    target: '[data-planner-tour="days"]',
    eyebrow: "Shape the week",
    title: "Keep useful weekday variations",
    description:
      "Switch days to tune each rhythm.",
  },
  {
    target: '[data-planner-tour="wheel"]',
    eyebrow: "Plan all 24 hours",
    title: "Place time blocks on the clock",
    description:
      "Choose a focus, select one of its child blocks, then drag the handles or use the exact time fields.",
  },
  {
    target: '[data-planner-tour="details"]',
    eyebrow: "Build the rhythm",
    title: "Focuses hold your time blocks",
    description:
      "Add the main areas of your day here, set a target, and create as many scheduled blocks as you need.",
  },
  {
    target: '[data-planner-tour="sidebar-toggle"]',
    eyebrow: "Keep the page quiet",
    title: "Your planner sidebar starts collapsed",
    description:
      "Open it when you want to create, switch, copy, or delete a planner. Use Guide on this page whenever you want this tour again.",
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

type Highlight = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function PlannerTour({ open, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[stepIndex];

  const closeTour = useCallback(() => {
    setStepIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const target = document.querySelector<HTMLElement>(step.target);
      if (!target) {
        setHighlight(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      setHighlight({
        top: Math.max(8, rect.top - 7),
        left: Math.max(8, rect.left - 7),
        width: Math.min(window.innerWidth - 16, rect.width + 14),
        height: Math.min(window.innerHeight - 16, rect.height + 14),
      });
    };

    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(step.target)?.scrollIntoView?.({
        block: "nearest",
        inline: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      updatePosition();
      cardRef.current?.focus();
    });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, step.target]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeTour();
      if (event.key === "ArrowRight" && stepIndex < TOUR_STEPS.length - 1) {
        setStepIndex((current) => current + 1);
      }
      if (event.key === "ArrowLeft" && stepIndex > 0) {
        setStepIndex((current) => current - 1);
      }
      if (event.key === "Tab" && cardRef.current) {
        const controls = Array.from(
          cardRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeTour, open, stepIndex]);

  if (!open || typeof document === "undefined") return null;

  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  const cardStyle = getTourCardStyle(highlight);

  return createPortal(
    <div className="planner-tour-layer">
      <div className="planner-tour-click-shield" aria-hidden="true" />
      {highlight ? (
        <div
          className="planner-tour-highlight"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
          aria-hidden="true"
        />
      ) : null}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Daily Planner guided tour"
        aria-describedby="planner-tour-description"
        className="planner-tour-card"
        style={cardStyle}
        tabIndex={-1}
      >
        <div className="planner-tour-card__topline">
          <span>
            {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button type="button" onClick={closeTour} aria-label="Close planner guide">
            <span>Close</span>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="planner-tour-card__eyebrow">{step.eyebrow}</p>
        <h2>{step.title}</h2>
        <p id="planner-tour-description">{step.description}</p>
        <div className="planner-tour-progress" aria-hidden="true">
          {TOUR_STEPS.map((tourStep, index) => (
            <span key={tourStep.title} data-active={index === stepIndex ? "true" : undefined} />
          ))}
        </div>
        <div className="planner-tour-actions">
          <button
            type="button"
            className="planner-tour-secondary"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            className="planner-tour-primary"
            onClick={() => {
              if (isLastStep) {
                closeTour();
                return;
              }
              setStepIndex((current) => current + 1);
            }}
          >
            {isLastStep ? (
              <>
                Finish
                <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function getTourCardStyle(highlight: Highlight | null): CSSProperties {
  if (typeof window === "undefined" || window.innerWidth < 720 || !highlight) {
    return { left: "50%", bottom: 16, transform: "translateX(-50%)" };
  }

  const cardWidth = 360;
  const gap = 20;
  const left =
    highlight.left + highlight.width + gap + cardWidth <= window.innerWidth
      ? highlight.left + highlight.width + gap
      : Math.max(16, highlight.left - cardWidth - gap);
  const top = Math.min(
    Math.max(16, highlight.top),
    Math.max(16, window.innerHeight - 340),
  );

  return { left, top };
}
