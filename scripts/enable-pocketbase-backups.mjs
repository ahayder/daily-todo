import { connectAdminClient } from "./lib/pocketbase-admin.mjs";

// Daily at 03:00 server time, keeping the last 7. Backups are zip files in the
// server's pb_data/backups folder, downloadable from the PocketBase dashboard.
const BACKUP_CRON = "0 3 * * *";
const BACKUP_MAX_KEEP = 7;

async function main() {
  const { client, baseUrl } = await connectAdminClient();
  const settings = await client.settings.getAll();
  const current = settings.backups ?? {};

  if (current.cron === BACKUP_CRON && current.cronMaxKeep === BACKUP_MAX_KEEP) {
    console.log(`UNCHANGED: daily backups already on for ${baseUrl}`);
    return;
  }

  await client.settings.update({
    backups: { ...current, cron: BACKUP_CRON, cronMaxKeep: BACKUP_MAX_KEEP },
  });
  console.log(`UPDATED: daily backups on for ${baseUrl} (cron "${BACKUP_CRON}", keep ${BACKUP_MAX_KEEP})`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Enabling PocketBase backups failed: ${message}`);
  process.exitCode = 1;
});
