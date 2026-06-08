/**
 * restart — after a turn, restart the session; the loop still replies and keeps
 * its prior history. Proves restart-session recovers without data loss.
 */
import { test, expect } from "@playwright/test";
import { createLoop, bootSandbox, sendAndAwaitReply, cleanupLoop } from "../helpers-shared";

let loopId = "";
test.beforeEach(async ({ page }) => { loopId = ""; await page.addInitScript(() => localStorage.setItem("loopat:setupPersonalRepoDismissed", "1")); });
test.afterEach(() => cleanupLoop(loopId));

test("loop survives a session restart and still replies", async ({ page }) => {
  loopId = await createLoop(page, `dogfood-rst-${Date.now()}`);
  await bootSandbox(page, loopId);
  await sendAndAwaitReply(page, "Reply with exactly: FIRSTRUN.");
  expect((await page.request.post(`/api/loops/${loopId}/restart-session`, { data: {} })).status()).toBeLessThan(400);
  await page.reload();
  await expect.poll(async () => (await page.locator('[data-role="assistant"]').allInnerTexts()).join("\n"),
    { timeout: 30_000, intervals: [1_000, 2_000] }).toContain("FIRSTRUN");
  expect(await sendAndAwaitReply(page, "Reply with exactly: SECONDRUN.")).toContain("SECONDRUN");
});
