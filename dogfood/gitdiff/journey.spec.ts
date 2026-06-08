/**
 * gitdiff — AI edits a file; the git-status API reflects the dirty worktree.
 * Verifies the diff/status endpoint over a real AI-driven change, not a mock.
 */
import { test, expect } from "@playwright/test";
import { createLoop, bootSandbox, sendAndAwaitReply, cleanupLoop } from "../helpers-shared";

let loopId = "";
test.beforeEach(async ({ page }) => { loopId = ""; await page.addInitScript(() => localStorage.setItem("loopat:setupPersonalRepoDismissed", "1")); });
test.afterEach(() => cleanupLoop(loopId));

test("git-status API shows the AI's uncommitted change", async ({ page }) => {
  loopId = await createLoop(page, `dogfood-diff-${Date.now()}`);
  await bootSandbox(page, loopId);
  await sendAndAwaitReply(page, "Create a file DIRTY.txt with content X in the workdir. Do NOT commit. Reply done.");
  await expect.poll(async () => {
    const r = await page.request.get(`/api/loops/${loopId}/git-status`);
    return r.ok() ? await r.text() : "";
  }, { timeout: 60_000, intervals: [1_000, 2_000, 3_000] }).toContain("DIRTY.txt");
});
