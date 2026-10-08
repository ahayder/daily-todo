import type { ConveyorSection, ConveyorStage } from "@/lib/content-conveyor";

/** Shelf group names. The Inbox reads as "Ideas" — same stage id, kinder word. */
export const STAGE_LABELS: Record<ConveyorStage, string> = {
  inbox: "Ideas",
  develop: "Develop",
  "shoot-next": "Shoot next",
  editing: "Editing",
  published: "Published",
};

export const SECTION_LABELS: Record<ConveyorSection, string> = {
  "ORIGINAL THOUGHT": "Original thought",
  "IDEA NOTE": "Idea note",
  "SHOOT CARD": "Shoot card",
  SATELLITES: "Satellites",
};

/** Guidance shown inside each empty section — never inserted into the card. */
export const SECTION_PLACEHOLDERS: Record<ConveyorSection, string> = {
  "ORIGINAL THOUGHT": "The specific thought — the problem and the method, not just the topic.",
  "IDEA NOTE": "Angle · hook · talk points · risk",
  "SHOOT CARD": "Paste your shoot card — part 1 (the core message) becomes the intent.",
  SATELLITES: "Spin-off ideas this one could lead to",
};
