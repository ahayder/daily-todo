// Seed the LOCAL test PocketBase with a login + sample data so `pnpm dev:test`
// has something to show. Safe to run repeatedly (idempotent). Never point this
// at production — it authenticates with the local superuser from .env.test.local
// and refuses any non-localhost URL as a guard.
//
// Usage: pnpm pocketbase:seed:local   (loads .env.test.local via --env-file)

import PocketBase from "pocketbase";

const TEST_USER_EMAIL = "test@local.test";
const TEST_USER_PASSWORD = "testuser1234";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Did you run via "pnpm pocketbase:seed:local"?`);
  }
  return value;
}

function assertLocalUrl(url) {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(url)) {
    throw new Error(
      `Refusing to seed a non-local PocketBase (${url}). This script only targets 127.0.0.1/localhost.`,
    );
  }
}

const nowIso = () => new Date().toISOString();
const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const CANONICAL_COLUMNS = [
  { id: "content-column-inbox", title: "Inbox", subtitle: "Capture anything" },
  { id: "content-column-develop", title: "Develop", subtitle: "Flesh it out" },
  { id: "content-column-shoot-next", title: "Shoot next", subtitle: "Ready to film" },
  { id: "content-column-published", title: "Published", subtitle: "Done" },
];

async function ensureTestUser(client) {
  try {
    const existing = await client
      .collection("users")
      .getFirstListItem(`email="${TEST_USER_EMAIL}"`);
    return existing;
  } catch {
    const created = await client.collection("users").create({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      passwordConfirm: TEST_USER_PASSWORD,
      name: "Test User",
      verified: true,
    });
    return created;
  }
}

async function upsert(client, collection, filter, data) {
  try {
    const existing = await client.collection(collection).getFirstListItem(filter);
    return await client.collection(collection).update(existing.id, data, { requestKey: null });
  } catch {
    return await client.collection(collection).create(data, { requestKey: null });
  }
}

async function main() {
  const baseUrl = (process.env.POCKETBASE_ADMIN_URL || process.env.NEXT_PUBLIC_POCKETBASE_URL || "").trim();
  assertLocalUrl(baseUrl);

  const email = requiredEnv("POCKETBASE_ADMIN_EMAIL");
  const password = requiredEnv("POCKETBASE_ADMIN_PASSWORD");

  const client = new PocketBase(baseUrl);
  client.autoCancellation(false);
  await client.collection("_superusers").authWithPassword(email, password);

  const user = await ensureTestUser(client);
  const owner = user.id;
  console.log(`✔ test user: ${TEST_USER_EMAIL} / ${TEST_USER_PASSWORD}`);

  // A daily page for today with a couple of todos.
  await upsert(
    client,
    "daily_pages",
    `owner="${owner}" && workspace_id="todo-workspace-main" && date="${todayKey()}"`,
    {
      owner,
      workspace_id: "todo-workspace-main",
      date: todayKey(),
      markdown: "# Today\n\nSeeded local test note.",
      todos_json: [
        { id: "seed-todo-1", text: "Try the local test DB", status: "open", priority: 1 },
        { id: "seed-todo-2", text: "Verify a card at the top of a column saves", status: "open", priority: 2 },
      ],
      updated_at_client: nowIso(),
    },
  );
  console.log("✔ daily page (today) with 2 todos");

  // The single content board with the four canonical columns.
  await upsert(client, "content_boards", `owner="${owner}"`, {
    owner,
    columns_json: CANONICAL_COLUMNS,
    updated_at_client: nowIso(),
  });
  console.log("✔ content board (4 canonical columns)");

  // Two content cards — one at position 0 (the top-of-column bug case) and one below.
  // NOTE: while content_cards.position/title are still `required: true` in the
  // schema, PocketBase rejects position 0 and empty titles with `validation_required`.
  // We warn instead of hard-failing so the rest of the seed stays usable; once the
  // required-field fix is applied to this local DB, both cards seed cleanly.
  try {
    await upsert(client, "content_cards", `owner="${owner}" && card_id="seed-card-top"`, {
      owner,
      card_id: "seed-card-top",
      column_id: "content-column-inbox",
      title: "Top-of-column card (position 0)",
      notes: "If this survives a refresh, the required-field fix worked.",
      position: 0,
      updated_at_client: nowIso(),
    });
    await upsert(client, "content_cards", `owner="${owner}" && card_id="seed-card-second"`, {
      owner,
      card_id: "seed-card-second",
      column_id: "content-column-inbox",
      title: "Second card",
      notes: "",
      position: 1,
      updated_at_client: nowIso(),
    });
    console.log("✔ 2 content cards (incl. a position-0 card)");
  } catch (error) {
    const data = error?.response?.data;
    console.warn(
      "⚠ content cards NOT seeded — PocketBase rejected them:",
      data ? JSON.stringify(data) : error?.message,
    );
    console.warn(
      "  This is the known content_cards required-field bug (position 0 / empty title).",
    );
    console.warn(
      "  Apply the required:false fix to this local DB, then re-run this seed.",
    );
  }

  console.log("\nSeed complete. Log in at http://localhost:5005 with the test user above.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Seed failed: ${message}`);
  process.exitCode = 1;
});
