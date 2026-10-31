import type { Page } from "@playwright/test";

export const DEV_STATE_KEY = "dailytodo.dev-workspace.state";

/** Opens a route in the local dev workspace with an empty, fresh state. */
export async function openFresh(page: Page, route: string) {
  await page.goto(`${route}?devWorkspace=1`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${route}?devWorkspace=1`);
}

/** Reads the dev workspace state the app saved to localStorage. */
export async function readDevState<T = Record<string, unknown>>(page: Page): Promise<T> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), DEV_STATE_KEY);
}
