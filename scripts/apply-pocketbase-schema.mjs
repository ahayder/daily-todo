import { connectAdminClient } from "./lib/pocketbase-admin.mjs";
import {
  applyPocketBaseSchema,
  formatSchemaSummary,
  hasSchemaFailures,
} from "./lib/pocketbase-schema.mjs";

async function main() {
  const { client } = await connectAdminClient();

  const summary = await applyPocketBaseSchema({ client, logger: console });
  console.log("");
  console.log(formatSchemaSummary(summary));

  if (hasSchemaFailures(summary)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`PocketBase schema apply failed: ${message}`);
  process.exitCode = 1;
});
