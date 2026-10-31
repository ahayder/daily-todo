import PocketBase from "pocketbase";

import { cleanupLegacyContentPlanner } from "./lib/content-planner-cleanup.mjs";
import { getRequiredEnv, resolveAdminTarget } from "./lib/pocketbase-admin.mjs";

async function main() {
  const baseUrl = await resolveAdminTarget();

  const client = new PocketBase(baseUrl);
  client.autoCancellation(false);
  await client
    .collection("_superusers")
    .authWithPassword(
      getRequiredEnv("POCKETBASE_ADMIN_EMAIL"),
      getRequiredEnv("POCKETBASE_ADMIN_PASSWORD"),
    );

  await cleanupLegacyContentPlanner({
    client,
    confirm: process.argv.includes("--confirm-delete-content-planner"),
    logger: console,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Content planner cleanup failed: ${message}`);
  process.exitCode = 1;
});
