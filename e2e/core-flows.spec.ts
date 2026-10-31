import { expect, test } from "@playwright/test";
import { DEV_STATE_KEY, openFresh, readDevState } from "./helpers";

type DevState = {
  dailyPages: Record<string, { date: string; todos: Array<{ text: string; status: string }> }>;
  uiState: { selectedDailyDate: string };
};

test("add a task in the Journal and finish it", async ({ page }) => {
  await openFresh(page, "/todos");

  await page.getByRole("textbox", { name: "Add a critical task…" }).fill("Ship CI");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Ship CI", exact: true })).toBeVisible();

  // pending → ongoing → done
  const status = page.getByRole("button", { name: "Status for Ship CI" });
  await status.click();
  await status.click();
  await expect(page.getByText("Ship CI", { exact: true })).toHaveClass(/task-text--done/);

  await page.reload();
  await expect(page.getByText("Ship CI", { exact: true })).toHaveClass(/task-text--done/);
});

test("an unfinished task carries over to the next day", async ({ page }) => {
  await openFresh(page, "/todos");
  await page.getByRole("textbox", { name: "Add a critical task…" }).fill("Renew passport");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Renew passport", exact: true })).toBeVisible();

  // Pretend that page was yesterday's: move it back one day, then reopen the app.
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    const [today] = Object.keys(state.dailyPages);
    const day = new Date(`${today}T12:00:00`);
    day.setDate(day.getDate() - 1);
    const yesterday = day.toISOString().slice(0, 10);
    state.dailyPages[yesterday] = { ...state.dailyPages[today], date: yesterday };
    delete state.dailyPages[today];
    state.uiState.selectedDailyDate = yesterday;
    localStorage.setItem(key, JSON.stringify(state));
  }, DEV_STATE_KEY);
  await page.reload();

  await expect(page.getByRole("button", { name: "Renew passport", exact: true })).toBeVisible();
  const state = await readDevState<DevState>(page);
  const pages = Object.values(state.dailyPages).toSorted((a, b) => a.date.localeCompare(b.date));
  expect(pages).toHaveLength(2);
  // Yesterday keeps its task (daily pages are never emptied), today has the carried copy.
  expect(pages.map((dailyPage) => dailyPage.todos.map((todo) => todo.text))).toEqual([
    ["Renew passport"],
    ["Renew passport"],
  ]);
});

test("a note keeps its text after a reload", async ({ page }) => {
  await openFresh(page, "/notes");

  const editor = page.locator("main [contenteditable='true']").first();
  await editor.click();
  await page.keyboard.type("Visa checklist for Portugal");
  await expect(editor).toContainText("Visa checklist for Portugal");

  // Give the debounced save a moment, then reload.
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator("main [contenteditable='true']").first()).toContainText(
    "Visa checklist for Portugal",
  );
});

test("a captured idea moves from Ideas to Develop", async ({ page }) => {
  await openFresh(page, "/content-planner");

  await page.getByRole("textbox", { name: "Capture a thought" }).fill("Why I left my local job");
  await page.keyboard.press("Enter");

  const ideas = page.getByRole("region", { name: "Ideas" });
  await expect(ideas.getByRole("button", { name: /Why I left my local job/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "Develop this" }).click();

  const develop = page.getByRole("region", { name: "Develop" });
  await expect(develop.getByRole("button", { name: /Why I left my local job/ }).first()).toBeVisible();
  await expect(ideas.getByRole("button", { name: /Why I left my local job/ })).toHaveCount(0);
});
