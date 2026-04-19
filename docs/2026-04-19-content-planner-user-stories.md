# Content Planner User Stories

> Temporary draft based on the current Content Planner UI in `src/components/content-planner-view.tsx`.
> Goal: turn the existing wireframe-level interface into a clear, implementation-ready set of product stories grouped by epic.

## Assumptions

- The current UI represents a content workflow from idea capture to publishing.
- AI is a core assistant in this page, not a side feature.
- The planner should connect naturally with the app's existing notes-first workflow over time.
- These stories are intentionally product-focused and implementation-agnostic.

## Epic 1: Idea Capture And Generation

### Goal

Help the user quickly get ideas into the planner from prompts, notes, transcripts, and other rough inputs.

### User stories

- As a creator, I want to generate multiple content ideas from a prompt so that I can quickly fill my idea inbox.
- As a creator, I want to start from quick prompts like `Brainstorm N ideas` or `From my notes` so that I can avoid rewriting common requests.
- As a creator, I want to create ideas from my existing notes so that my planner reflects thoughts I already captured elsewhere in the app.
- As a creator, I want to paste a transcript or raw text and turn it into ideas so that long-form source material becomes usable content seeds.
- As a creator, I want to turn a voice memo into ideas so that I can capture thoughts without typing first.
- As a creator, I want each generated idea to include a hook, premise, source, and initial metadata so that I can triage it without extra setup.
- As a creator, I want the system to clearly mark whether an idea was human-entered or AI-suggested so that I understand where it came from.
- As a creator, I want an empty-state generation flow so that the page is still useful before any ideas exist.
- As a creator, I want access to a prompt library so that I can reuse prompt patterns that work well for my audience.
- As a creator, I want to save a custom prompt as a reusable template so that ideation gets faster over time.

## Epic 2: Idea Inbox And Library Management

### Goal

Give the user a durable, browsable content library instead of a one-time generation screen.

### User stories

- As a creator, I want every idea saved in a persistent planner library so that I can come back to it later.
- As a creator, I want to browse ideas in a list grouped by workflow status so that I can see where each idea stands.
- As a creator, I want to switch between list, kanban, and grid views so that I can work in the format that best suits the moment.
- As a creator, I want to select an idea and see its full details so that I can review and refine it in context.
- As a creator, I want each idea to have a stable identifier or code so that I can reference it in discussions and workflows.
- As a creator, I want to archive stale or irrelevant ideas so that the planner stays focused.
- As a creator, I want to restore archived ideas so that good ideas are not lost permanently.
- As a creator, I want to duplicate an idea so that I can explore alternate directions without losing the original.
- As a creator, I want to delete an idea when I no longer need it so that the planner stays clean.
- As a creator, I want recent age labels or updated timestamps so that I can judge freshness at a glance.

## Epic 3: Search, Filter, Sorting, And Navigation

### Goal

Make it easy to find the right idea quickly as the library grows.

### User stories

- As a creator, I want to search ideas by hook text so that I can locate a concept I partially remember.
- As a creator, I want search to include premise, tags, and other metadata so that I can find ideas from multiple angles.
- As a creator, I want to filter by status so that I can focus on just inbox, curating, outlined, scripted, published, or archived ideas.
- As a creator, I want to filter by pillar so that I can balance my content across themes like teach, proof, opinion, or build-in-public.
- As a creator, I want to filter by channel so that I can focus on ideas suited for a specific format.
- As a creator, I want to filter by tags so that I can cluster related topics.
- As a creator, I want filter counts shown beside options so that I understand how much content sits in each slice.
- As a creator, I want to sort ideas by score so that the strongest opportunities rise first.
- As a creator, I want additional sort options like newest, oldest, or recently edited so that I can change how I review my backlog.
- As a creator, I want my current filters and view preferences to persist so that I can resume work without reconfiguring the page.

## Epic 4: Workflow Pipeline And Status Progression

### Goal

Support a clear editorial workflow from raw idea to shipped content.

### User stories

- As a creator, I want every idea to move through explicit stages so that I can manage work in progress.
- As a creator, I want to change an idea's status from the detail pane so that I can advance work while editing.
- As a creator, I want to drag ideas between kanban columns so that changing stage feels fast and visual.
- As a creator, I want grouped status sections in list view so that I can review workload by pipeline stage.
- As a creator, I want the planner to surface counts per status so that I can understand pipeline balance.
- As a creator, I want to see whether an idea is blocked by missing proof, missing script sections, or missing assets so that I know what to do next.
- As a creator, I want to publish an idea into a completed state so that my content history reflects shipped work.
- As a creator, I want archived content to be clearly separate from active workflow stages so that old ideas do not clutter current planning.

## Epic 5: Idea Metadata And Content Framing

### Goal

Help the user describe each idea well enough for prioritization, repurposing, and publishing.

### User stories

- As a creator, I want to edit an idea's core hook so that the top-line framing improves over time.
- As a creator, I want to edit the idea premise so that the core argument or angle stays clear.
- As a creator, I want to assign a content pillar so that each idea fits into my broader strategy.
- As a creator, I want to assign one or more channels to an idea so that I know where it can ship.
- As a creator, I want to add and remove tags so that ideas stay organized by topic.
- As a creator, I want to view the source of an idea so that I remember the context that created it.
- As a creator, I want to connect an idea back to notes, transcripts, or conversations so that proof and supporting material remain traceable.
- As a creator, I want the system to suggest missing metadata so that raw ideas become structured with less manual work.

## Epic 6: Scoring, Prioritization, And Ranking

### Goal

Help the user decide which ideas deserve attention first.

### User stories

- As a creator, I want each idea to have a score so that I can prioritize what to develop next.
- As a creator, I want to see a score breakdown such as hook, proof, and audience fit so that the score feels explainable.
- As a creator, I want AI to rank ideas in my inbox so that I can triage large batches faster.
- As a creator, I want to re-score an idea after editing it so that improvements are reflected in priority.
- As a creator, I want to sort by score descending so that my strongest opportunities appear first.
- As a creator, I want to understand why a lower-scoring idea was ranked lower so that I know whether to improve or discard it.
- As a creator, I want to override or adjust AI scoring when my judgment differs so that prioritization stays under my control.

## Epic 7: Hook Development

### Goal

Turn each raw idea into a sharper opening angle before full drafting begins.

### User stories

- As a creator, I want multiple hook variations for an idea so that I can test different angles.
- As a creator, I want AI to generate additional hook variations so that I can explore more possibilities quickly.
- As a creator, I want to mark one hook as the active version so that the rest of the workflow uses the selected framing.
- As a creator, I want to delete weak hook variations so that the detail pane stays focused.
- As a creator, I want to rewrite an individual hook with AI so that I can improve a promising angle without starting over.
- As a creator, I want to compare hook options side by side so that I can choose the strongest opener for my audience.

## Epic 8: Script And Outline Building

### Goal

Support progression from idea to working outline and draft structure.

### User stories

- As a creator, I want to build a script or outline as ordered sections so that I can shape a complete piece.
- As a creator, I want AI to draft an initial outline from the selected idea so that I can move from concept to structure quickly.
- As a creator, I want each section to have a label and body so that I can separate the role of each part.
- As a creator, I want to add a new section manually so that I can extend the script where needed.
- As a creator, I want to reorder sections so that I can improve flow.
- As a creator, I want to rewrite or expand a specific section with AI so that I can refine weak areas in place.
- As a creator, I want placeholders for missing proof or CTA sections so that incomplete drafts still show what is left.
- As a creator, I want to mark an idea as outlined or scripted based on the maturity of its structure so that workflow status reflects reality.

## Epic 9: AI Copilot For Idea Development

### Goal

Make AI a contextual collaborator while the user curates and drafts.

### User stories

- As a creator, I want an AI chat panel scoped to the selected idea so that I can ask targeted questions without losing context.
- As a creator, I want quick AI actions like `Suggest tags`, `Outline script`, or `Repurpose for LinkedIn` so that common actions are one click away.
- As a creator, I want AI to use the currently selected idea as context automatically so that I do not need to restate it every time.
- As a creator, I want AI to pull supporting material from my notes when relevant so that idea development is grounded in existing material.
- As a creator, I want AI to help find missing proof, examples, or CTAs so that drafts become more publishable.
- As a creator, I want AI suggestions to remain editable and non-destructive so that I stay in control of the final content.

## Epic 10: Repurposing And Channel Adaptation

### Goal

Enable one idea to become multiple content assets across formats.

### User stories

- As a creator, I want to repurpose an idea for another channel so that one concept can generate multiple outputs.
- As a creator, I want channel-specific rewrites so that the same idea fits LinkedIn, newsletter, short video, or long-form video.
- As a creator, I want to maintain multiple channel targets on a single idea so that I can plan repurposing early.
- As a creator, I want to duplicate a developed idea into channel-specific drafts so that each output can evolve independently.
- As a creator, I want the planner to preserve the shared source idea across repurposed pieces so that I can trace where content originated.

## Epic 11: Bulk Operations And Editorial Operations

### Goal

Make large-batch review and cleanup practical.

### User stories

- As a creator, I want to bulk select ideas so that I can update many items at once.
- As a creator, I want to bulk change status so that I can clean up my pipeline efficiently.
- As a creator, I want to bulk archive low-priority ideas so that the inbox stays manageable.
- As a creator, I want to bulk tag or retag ideas so that organization scales with volume.
- As a creator, I want to bulk delete disposable AI-generated ideas so that quick ideation sessions do not clutter the planner.
- As a creator, I want confirmation for destructive bulk actions so that I do not lose work accidentally.

## Epic 12: Notes And Source Integration

### Goal

Tie the content planner back to the app's core notebook workflow.

### User stories

- As a creator, I want to generate ideas from notes stored in the app so that the planner feels connected to my existing workflow.
- As a creator, I want AI to find related notes for a selected idea so that I can enrich it with material I already have.
- As a creator, I want to see which note, transcript, or digest an idea came from so that I can reopen the original source.
- As a creator, I want to attach references, screenshots, or proof assets to an idea so that supporting material stays nearby.
- As a creator, I want future ideas to be discoverable from note content and not just manual prompts so that valuable insights are easier to reuse.

## Epic 13: Publishing, History, And Outcomes

### Goal

Close the loop from planning to shipped content.

### User stories

- As a creator, I want to mark an idea as published so that completed content is represented in the workflow.
- As a creator, I want published entries to retain their final hook, channel, and source context so that I can review what shipped.
- As a creator, I want to store publication details such as publish date or destination so that the planner becomes a real content history.
- As a creator, I want to review previously published ideas so that I can repurpose or revisit what worked.
- As a creator, I want to archive outdated published content ideas separately from active planning so that the active workspace stays focused.

## Epic 14: Preferences, Layout, And Workspace State

### Goal

Make the planner feel stable and personal during repeated use.

### User stories

- As a creator, I want the planner to remember whether I last used list, kanban, or grid view so that the page opens the way I work.
- As a creator, I want density settings like compact or comfortable so that I can choose information density.
- As a creator, I want the right detail pane and AI panel visibility remembered so that the workspace matches my preferred setup.
- As a creator, I want responsive behavior across desktop and smaller layouts so that the planner remains usable on different screen sizes.
- As a creator, I want the selected idea to remain stable while I change filters or views when possible so that I do not lose context.

## Suggested MVP Cut

If we want to phase this cleanly, the likely MVP epics are:

- Epic 1: Idea Capture And Generation
- Epic 2: Idea Inbox And Library Management
- Epic 3: Search, Filter, Sorting, And Navigation
- Epic 4: Workflow Pipeline And Status Progression
- Epic 5: Idea Metadata And Content Framing
- Epic 7: Hook Development
- Epic 8: Script And Outline Building
- Epic 9: AI Copilot For Idea Development

## Likely Phase 2

- Epic 10: Repurposing And Channel Adaptation
- Epic 11: Bulk Operations And Editorial Operations
- Epic 12: Notes And Source Integration
- Epic 13: Publishing, History, And Outcomes
- Epic 14: Preferences, Layout, And Workspace State

## Open Product Questions

- Should the planner treat generated ideas as drafts until explicitly saved, or save everything immediately?
- Should one planner item represent one core idea or one channel-specific asset?
- Should published content stay in the same pipeline or move into a separate content library?
- How tightly should this planner integrate with notes in the first release?
- Should AI-generated edits overwrite current fields or always create suggestions first?

