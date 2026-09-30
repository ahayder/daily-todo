import { Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type InlineAlertProps = {
  tone?: "info" | "warn";
  /** Say what is safe first, then what to do: "Saved on this device. We'll sync when you're back online." */
  children: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** In-place message for errors and notices. Global sync state lives in the top-nav sync pill, not here. */
export function InlineAlert({ tone = "info", children, action, className }: InlineAlertProps) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div
      role={tone === "warn" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-3 text-sm",
        tone === "warn" ? "bg-destructive/12 text-foreground" : "bg-brand-subtle text-brand-subtle-foreground",
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone === "warn" && "text-destructive")} />
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="-my-1 shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
