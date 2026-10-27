"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TodayBlock } from "@/lib/memory/tasks";

/** "Do today": pick a time block (or any time) for a task. Pass only blocks that haven't ended. */
export function DoTodayMenu({
  title,
  blocks,
  disabled,
  onPick,
}: {
  title: string;
  blocks: TodayBlock[];
  disabled: boolean;
  onPick: (blockId: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button variant="outline" size="sm" className="pointer-coarse:h-11" aria-label={`Do “${title}” today`}>
            Do today
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Put it in which block?</DropdownMenuLabel>
          {blocks.map((block) => (
            <DropdownMenuItem
              key={block.id}
              aria-label={`${block.title || "Untitled block"}, ${block.start} to ${block.end}`}
              onClick={() => onPick(block.id)}
            >
              <span className="font-mono text-[0.8125rem] tabular-nums text-muted-foreground">{block.start}</span>
              <span className="truncate">{block.title || "Untitled block"}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {blocks.length > 0 ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem onClick={() => onPick(null)}>Any time today</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
