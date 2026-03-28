# PocketBase Setup

DailyTodo uses PocketBase with client-only auth and one synced `AppState` snapshot per user.

## Environment

The web app requires `NEXT_PUBLIC_POCKETBASE_URL` in every environment:

- local: `.env.local`
- staging: deployment environment variables
- production: deployment environment variables

Optional auth behavior flag:

- `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false` for local/dev while SMTP is not configured
- `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true` for staging/production once PocketBase email delivery is ready

No admin token, service key, or privileged backend secret is used by the app client.

## `users` collection

Use PocketBase's built-in auth collection:

- email/password auth enabled
- unique email required
- password auth minimum: 8 characters
- optional `name` text field
- password reset email enabled
- email verification enabled for staging and production

## `app_state_snapshots` collection

Create a regular collection named `app_state_snapshots` with these fields:

- `owner`: relation to `users`, required, max select `1`
- `state_json`: JSON, required
- `state_version`: number, required
- `updated_at_client`: date/time, required

Keep PocketBase's built-in `created` and `updated` timestamps enabled.

### Indexes

- unique index on `owner`

### API rules

Apply the same rule shape to list/view/update/delete:

```text
@request.auth.id != "" && owner = @request.auth.id
```

Create rule:

```text
@request.auth.id != "" && owner = @request.auth.id
```

Update rule:

```text
@request.auth.id != "" && owner = @request.auth.id
```

These rules keep each user scoped to their own snapshot without any admin backend.

## Email templates

PocketBase should be configured with environment-specific SMTP settings and public URLs so:

- verification emails link back to the deployed app
- password reset emails link to `/auth/reset?token=...`

The app expects verification and reset flows to be handled entirely through PocketBase-issued tokens.
