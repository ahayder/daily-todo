// Prints a long-lived impersonation token for one DailyTodo user, for the
// Content Planner MCP server (POCKETBASE_USER_TOKEN). Uses the superuser login
// only to mint the token; the token itself is limited to that user's records.
// The token goes to stdout and everything else to stderr, so it can be piped
// straight into Coolify without being shown.
//
// Usage: pnpm -s mcp:token:prod [email] [days=365]   (or mcp:token:local)
import { connectAdminClient } from "./lib/pocketbase-admin.mjs";

const [email, daysArg] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const days = Number(daysArg ?? 365);

const { client } = await connectAdminClient();
const users = email
  ? [await client.collection("users").getFirstListItem(client.filter("email = {:email}", { email }))]
  : await client.collection("users").getFullList();

if (users.length !== 1) {
  console.error(`Found ${users.length} users; pass the email of the one to use.`);
  process.exit(1);
}

const impersonated = await client.collection("users").impersonate(users[0].id, days * 24 * 60 * 60);
console.error(`Token for user ${users[0].id}, valid ${days} days.`);
process.stdout.write(impersonated.authStore.token);
