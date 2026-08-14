"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

function withoutNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const { node, ...elementProps } = props;
  void node;
  return elementProps;
}

function withClassName<T extends { node?: unknown; className?: string }>(
  props: T,
  className: string,
) {
  const { node, className: sourceClassName, ...elementProps } = props;
  void node;
  return {
    ...elementProps,
    className: sourceClassName
      ? `${className} ${sourceClassName}`
      : className,
  };
}

const markdownComponents: Components = {
  h1: (props) => (
    <h3
      {...withClassName(
        props,
        "text-[length:var(--content-planner-font-base,1rem)] font-semibold leading-[var(--content-planner-leading-6,1.5rem)] text-[var(--ink-900)]",
      )}
    />
  ),
  h2: (props) => (
    <h4
      {...withClassName(
        props,
        "text-[length:var(--content-planner-font-sm,0.875rem)] font-semibold leading-[var(--content-planner-leading-6,1.5rem)] text-[var(--ink-900)]",
      )}
    />
  ),
  h3: (props) => (
    <h5
      {...withClassName(
        props,
        "text-[length:var(--content-planner-font-sm,0.875rem)] font-semibold leading-[var(--content-planner-leading-6,1.5rem)] text-[var(--ink-900)]",
      )}
    />
  ),
  p: (props) => (
    <p
      {...withClassName(
        props,
        "text-[length:var(--content-planner-font-sm,0.875rem)] font-normal leading-[var(--content-planner-leading-6,1.5rem)] text-[var(--ink-900)]",
      )}
    />
  ),
  ul: (props) => (
    <ul
      {...withClassName(
        props,
        props.className?.includes("contains-task-list")
          ? "list-none space-y-1 pl-0 text-[length:var(--content-planner-font-sm,0.875rem)] leading-[var(--content-planner-leading-6,1.5rem)]"
          : "list-disc space-y-1 pl-5 text-[length:var(--content-planner-font-sm,0.875rem)] leading-[var(--content-planner-leading-6,1.5rem)]",
      )}
    />
  ),
  ol: (props) => (
    <ol
      {...withClassName(
        props,
        "list-decimal space-y-1 pl-5 text-[length:var(--content-planner-font-sm,0.875rem)] leading-[var(--content-planner-leading-6,1.5rem)]",
      )}
    />
  ),
  li: (props) => <li {...withClassName(props, "pl-0.5")} />,
  blockquote: (props) => (
    <blockquote
      {...withClassName(
        props,
        "border-l-2 border-[var(--brand)] pl-3 text-[var(--ink-700)]",
      )}
    />
  ),
  a: (props) => (
    <a
      {...withClassName(
        props,
        "font-medium text-[var(--brand)] underline decoration-[color:color-mix(in_srgb,var(--brand)_45%,transparent)] underline-offset-2 transition-colors duration-150 hover:decoration-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
      )}
      target="_blank"
      rel="noreferrer"
    />
  ),
  code: (props) => {
    const { className, ...elementProps } = withoutNode(props);
    return (
      <code
        className={
          className
            ? `font-mono text-[length:var(--content-planner-font-xs,0.75rem)] ${className}`
            : "rounded bg-[var(--paper)] px-1 py-0.5 font-mono text-[length:var(--content-planner-font-xs,0.75rem)] text-[var(--ink-900)]"
        }
        {...elementProps}
      />
    );
  },
  pre: (props) => (
    <pre
      {...withClassName(
        props,
        "overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3 font-mono text-[length:var(--content-planner-font-xs,0.75rem)] leading-[var(--content-planner-leading-5,1.25rem)] text-[var(--ink-900)]",
      )}
    />
  ),
  hr: (props) => (
    <hr
      {...withClassName(props, "border-0 border-t border-[var(--line)]")}
    />
  ),
  table: (props) => (
    <table
      {...withClassName(
        props,
        "w-full border-collapse text-left text-[length:var(--content-planner-font-xs,0.75rem)] text-[var(--ink-900)]",
      )}
    />
  ),
  th: (props) => (
    <th
      {...withClassName(
        props,
        "border border-[var(--line)] bg-[var(--paper)] px-2 py-1.5 font-semibold",
      )}
    />
  ),
  td: (props) => (
    <td
      {...withClassName(
        props,
        "border border-[var(--line)] px-2 py-1.5 align-top",
      )}
    />
  ),
  input: (props) => (
    <input
      {...withClassName(props, "mr-1.5 accent-[var(--brand)]")}
      disabled
    />
  ),
};

const titleMarkdownComponents: Components = {
  ...markdownComponents,
  p: (props) => (
    <p
      {...withClassName(
        props,
        "text-[length:var(--content-planner-font-base,1rem)] font-semibold leading-[var(--content-planner-leading-6,1.5rem)] text-[var(--ink-900)]",
      )}
    />
  ),
};

const remarkPlugins = [remarkGfm];

export const ContentCardMarkdown = memo(function ContentCardMarkdown({
  title,
  notes,
  variant = "plain",
}: {
  title: string;
  notes?: string;
  variant?: "card" | "plain";
}) {
  const isCard = variant === "card";

  return (
    <div
      className={
        isCard
          ? "content-card-markdown overflow-x-auto"
          : "content-card-markdown space-y-2 overflow-x-auto"
      }
    >
      <div
        className={
          isCard
            ? "border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--brand-soft)_62%,var(--paper-strong))] px-4 py-2.5"
            : undefined
        }
        data-card-section={isCard ? "header" : undefined}
      >
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          components={titleMarkdownComponents}
        >
          {title}
        </ReactMarkdown>
      </div>
      {notes ? (
        <div className={isCard ? "px-4 py-3.5" : undefined}>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={markdownComponents}
          >
            {notes}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
});
