import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  /** One short line. Hidden on phones when `condenseOnMobile`. */
  subtitle?: ReactNode;
  /** Small chip next to the title, e.g. the workspace name. */
  meta?: ReactNode;
  /** Right-aligned actions: at most one primary Button plus IconButtons. */
  actions?: ReactNode;
  /** `h1` for a page, `h2` for a pane inside a page. */
  as?: "h1" | "h2";
  condenseOnMobile?: boolean;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  as: Heading = "h1",
  condenseOnMobile = false,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Heading
            className={cn(
              "font-heading font-bold text-foreground",
              Heading === "h1" ? "text-xl leading-tight text-balance sm:text-2xl" : "text-xl leading-tight text-balance",
            )}
          >
            {title}
          </Heading>
          {meta}
        </div>
        {subtitle ? (
          <p className={cn("mt-0.5 text-sm text-muted-foreground", condenseOnMobile && "max-sm:hidden")}>{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </header>
  );
}
