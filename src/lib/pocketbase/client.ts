import PocketBase from "pocketbase";

let pocketBaseClient: PocketBase | null = null;
let pocketBaseUrl: string | null = null;

function getConfiguredUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_POCKETBASE_URL for PocketBase.");
  }

  return baseUrl;
}

export function getPocketBaseClient(): PocketBase {
  const baseUrl = getConfiguredUrl();

  if (!pocketBaseClient || pocketBaseUrl !== baseUrl) {
    pocketBaseClient = new PocketBase(baseUrl);
    pocketBaseClient.autoCancellation(false);
    pocketBaseUrl = baseUrl;
  }

  return pocketBaseClient;
}
