import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ReactNode;
  /** Short and kind: "A fresh page." */
  title: string;
  /** One line that invites the next step: "What's one thing for today?" */
  description?: string;
  /** At most one action, usually a Button. */
  action?: ReactNode;
  /** `page` fills a pane; `inline` sits inside a list or group. */
  size?: "page" | "inline";
  className?: string;
};

export function EmptyState({ icon, title, description, action, size = "page", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center animate-enter",
        size === "page" ? "gap-3 px-6 py-16" : "gap-1.5 px-4 py-6",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className={cn(
            "grid place-items-center rounded-full bg-brand-subtle text-brand-subtle-foreground [&_svg]:size-5",
            size === "page" ? "mb-1 size-12" : "size-9",
          )}
        >
          {icon}
        </div>
      ) : null}
      <p className={cn("font-heading font-semibold text-foreground", size === "page" ? "text-lg" : "text-base")}>
        {title}
      </p>
      {description ? <p className="max-w-xs text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
