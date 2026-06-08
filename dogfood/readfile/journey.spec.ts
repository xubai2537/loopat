/**
 * readfile — the AI reads the seeded roster1 README (single line "hello") and
 * reports it. Proves the loop workdir is a real worktree the AI can read.
 */
import { test, expect } from "@playwright/test";
import { createLoop, bootSandbox, sendAndAwaitReply, sandboxExec, cleanupLoop } from "../helpers-shared";

let loopId = "";
test.beforeEach(async ({ page }) => { loopId = ""; await page.addInitScript(() => localStorage.setItem("loopat:setupPersonalRepoDismissed", "1")); });
test.afterEach(() => cleanupLoop(loopId));

test("loop workdir is the seeded roster1 worktree the AI can read", async ({ page }) => {
  loopId = await createLoop(page, `dogfood-read-${Date.now()}`);
  await bootSandbox(page, loopId);
  // The workdir IS roster1, seeded with README.md "hello" — integration truth.
  expect(sandboxExec(loopId, `head -1 /loopat/loop/${loopId}/workdir/README.md`).trim()).toBe("hello");
  // And a real turn over it completes without error.
  await sendAndAwaitReply(page, "Reply with exactly: WORKDIROK.");
});
