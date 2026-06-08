/**
 * twoloops — two independent loops each get a real reply; their histories don't
 * cross-contaminate. Proves loop isolation through the browser + real AI.
 */
import { test, expect } from "@playwright/test";
import { createLoop, bootSandbox, sendAndAwaitReply, cleanupLoop } from "../helpers-shared";

const ids: string[] = [];
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("loopat:setupPersonalRepoDismissed", "1")); });
test.afterEach(() => ids.splice(0).forEach(cleanupLoop));

test("two loops stay isolated, each replies independently", async ({ page }) => {
  const a = await createLoop(page, `dogfood-2a-${Date.now()}`); ids.push(a);
  await bootSandbox(page, a);
  expect(await sendAndAwaitReply(page, "Reply with exactly: ALPHAONE.")).toContain("ALPHAONE");
  const b = await createLoop(page, `dogfood-2b-${Date.now()}`); ids.push(b);
  await bootSandbox(page, b);
  const reply = await sendAndAwaitReply(page, "Reply with exactly: BETATWO.");
  expect(reply).toContain("BETATWO");
  expect(reply, "B's loop must not show A's answer").not.toContain("ALPHAONE");
});
