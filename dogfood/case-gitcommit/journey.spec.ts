/**
 * gitcommit — AI edits a tracked file and commits; sandbox git log proves the
 * commit landed. End-to-end UI + AI + real git in the worktree.
 */
import { test, expect } from "@playwright/test";
import { createLoop, bootSandbox, sendAndAwaitReply, sandboxExec, cleanupLoop } from "../helpers-shared";

let loopId = "";
test.beforeEach(async ({ page }) => { loopId = ""; await page.addInitScript(() => localStorage.setItem("loopat:setupPersonalRepoDismissed", "1")); });
test.afterEach(() => cleanupLoop(loopId));

test("AI commits a change the worktree git log proves", async ({ page }) => {
  loopId = await createLoop(page, `dogfood-git-${Date.now()}`);
  await bootSandbox(page, loopId);
  await sendAndAwaitReply(page, "Create NOTE.txt with the single line GITDOGFOOD, then git add and git commit -m 'dogfood note'. Use your tools. Report the hash.");
  await expect.poll(() => {
    try { return sandboxExec(loopId, `git -C /loopat/loop/${loopId}/workdir log --oneline -1`).trim(); } catch { return ""; }
  }, { timeout: 60_000, intervals: [1_000, 2_000, 3_000] }).toContain("dogfood note");
  expect(sandboxExec(loopId, `git -C /loopat/loop/${loopId}/workdir ls-files NOTE.txt`).trim()).toBe("NOTE.txt");
});
