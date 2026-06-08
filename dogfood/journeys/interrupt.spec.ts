/** interrupt — a turn can be interrupted; loop recovers and replies again. */
import { test, expect } from "@playwright/test";
import { createLoop, bootSandbox, sendAndAwaitReply, cleanupLoop } from "./helpers";
let loopId = "";
test.beforeEach(async ({ page }) => { loopId = ""; await page.addInitScript(() => localStorage.setItem("loopat:setupPersonalRepoDismissed", "1")); });
test.afterEach(() => cleanupLoop(loopId));
test("a turn interrupted mid-flight leaves the loop usable", async ({ page }) => {
  loopId = await createLoop(page, `dogfood-int-${Date.now()}`);
  await bootSandbox(page, loopId);
  const composer = page.getByRole("textbox", { name: "Message input" });
  await composer.click(); await composer.fill("Count slowly from 1 to 50, one number per line.");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.waitForTimeout(2000);
  await page.request.post(`/api/v1/loops/${loopId}/interrupt`, { data: {} });
  // Loop still healthy: a fresh turn replies.
  expect(await sendAndAwaitReply(page, "Reply with exactly: RECOVERED.")).toContain("RECOVERED");
});
