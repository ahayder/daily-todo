# PocketBase Setup

DailyTodo uses PocketBase with client-only auth and a split synced workspace model. The app stores user content in separate collections for daily pages, notes, planner presets, the content board, content cards, and synced workspace navigation state, while keeping device-local UI preferences in local storage only.

## Environment

The web app requires `NEXT_PUBLIC_POCKETBASE_URL` in every environment:

- local: `.env.local`
- staging: deployment environment variables
- production: deployment environment variables

Optional auth behavior flag:

- `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false` for local/dev while SMTP is not configured
- `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true` for staging/production once PocketBase email delivery is ready

No admin token, service key, or privileged backend secret is used by the app client.

## Admin schema automation

The app itself stays browser-only for normal users, but the repo includes an admin-only schema reconcile script for setting up and updating the PocketBase collections from a trusted machine.

Required env vars for the admin script:

- `POCKETBASE_ADMIN_EMAIL`
- `POCKETBASE_ADMIN_PASSWORD`
- one of:
  - `POCKETBASE_ADMIN_URL`
  - `NEXT_PUBLIC_POCKETBASE_URL`
  - `POCKETBASE_URL`

Run:

```bash
pnpm pocketbase:schema:apply
```

What it does:

- authenticates as a PocketBase superuser
- creates or updates the app collections
- reconciles collection fields, indexes, and API rules
- preserves extra unknown fields and indexes instead of deleting them, except for explicitly replaced managed indexes
- keeps `app_state_snapshots` available for the migration window

What it does not do in v1:

- delete collections or fields automatically
- configure SMTP or email templates
- bootstrap broader PocketBase server settings

Expected successful output is a human-readable summary similar to:

```text
CREATED: daily_pages
UPDATED: notes
UNCHANGED: app_state_snapshots

PocketBase schema apply summary
Created: daily_pages, planner_presets
Updated: notes, workspace_state
Unchanged: app_state_snapshots
Failed: none
```

## `users` collection

Use PocketBase's built-in auth collection:

- email/password auth enabled
- unique email required
- password auth minimum: 8 characters
- optional `name` text field
- password reset email enabled
- email verification enabled for staging and production

## Synced workspace collections

The app reads from the split collections first, then falls back to `app_state_snapshots` only for migration and rollback safety.

### `daily_pages`

Fields:

- `owner`: relation to `users`, required, max select `1`
- `workspace_id`: text; empty legacy values are treated as the protected Main workspace
- `date`: text, required
- `markdown`: text
- `todos_json`: JSON, required
- `updated_at_client`: date/time, required

Indexes:

- unique composite index on `owner` + `workspace_id` + `date`

### `notes`

Fields:

- `owner`: relation to `users`, required, max select `1`
- `note_id`: text, required
- `title`: text, required
- `markdown`: text
- `updated_at_client`: date/time, required

Indexes:

- unique composite index on `owner` + `note_id`

### `planner_presets`

Fields:

- `owner`: relation to `users`, required, max select `1`
- `preset_id`: text, required
- `name`: text, required
- `day_order_json`: JSON, required
- `days_json`: JSON, required
- `updated_at_client`: date/time, required

Indexes:

- unique composite index on `owner` + `preset_id`

### `content_boards`

One record is stored per owner.

Fields:

- `owner`: relation to `users`, required, max select `1`
- `columns_json`: JSON, required
- `updated_at_client`: date/time, required

Indexes:

- unique index on `owner`

### `content_cards`

Fields:

- `owner`: relation to `users`, required, max select `1`
- `card_id`: text, required
- `column_id`: text, required
- `title`: text, required
- `notes`: text
- `position`: integer number, required
- `updated_at_client`: date/time, required

Indexes:

- unique composite index on `owner` + `card_id`
- lookup index on `owner` + `column_id` + `position`

### `workspace_state`

Fields:

- `owner`: relation to `users`, required, max select `1`
- `selected_daily_date`: text
- `selected_todo_workspace_id`: text
- `todo_workspaces_json`: JSON containing workspace id/name/timestamps
- `selected_note_id`: text
- `selected_note_folder_id`: text
- `selected_planner_preset_id`: text
- `expanded_years_json`: JSON, required
- `expanded_months_json`: JSON, required
- `last_view`: text, required
- `updated_at_client`: date/time, required

Indexes:

- unique index on `owner`

## Legacy migration collection

## `app_state_snapshots`

Keep the legacy collection during the migration window:

- `owner`: relation to `users`, required, max select `1`
- `state_json`: JSON, required
- `state_version`: number, required
- `updated_at_client`: date/time, required

Keep PocketBase's built-in `created` and `updated` timestamps enabled.

Indexes:

- unique index on `owner`

The client still dual-writes to this collection during the migration phase so rollback remains possible.

## Content planner destructive cleanup

Apply the new schema and deploy/update all active clients before removing legacy content planner data. The cleanup is intentionally a separate admin command and never runs as part of schema reconciliation.

Preview the exact cleanup scope:

```bash
pnpm pocketbase:content-planner:cleanup
```

After verifying that every active client uses `content_boards` and `content_cards`, apply it with the required confirmation flag:

```bash
pnpm pocketbase:content-planner:cleanup -- --confirm-delete-content-planner
```

The command deletes the `content_ideas` collection, removes obsolete content-planner fields from `workspace_state`, and strips legacy planner branches from snapshot JSON. Todos, notes, planner presets, daily pages, and unrelated UI state are preserved. No legacy content ideas are migrated.

## API rules

Apply the same rule shape to list/view/create/update/delete for every synced collection:

```text
@request.auth.id != "" && owner = @request.auth.id
```

These rules keep each user scoped to their own records without any admin backend.

## Email templates

PocketBase should be configured with environment-specific SMTP settings and public URLs so:

- verification emails link back to the deployed app
- password reset emails link to `/auth/reset?token=...`

The app expects verification and reset flows to be handled entirely through PocketBase-issued tokens.
