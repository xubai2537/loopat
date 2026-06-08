/** gitstage — AI edits, then git-stage API stages it; git-status shows staged. */
import { test, expect } from "@playwright/test";
import { createLoop, bootSandbox, sendAndAwaitReply, sandboxExec, cleanupLoop } from "../helpers-shared";
let loopId = "";
test.beforeEach(async ({ page }) => { loopId = ""; await page.addInitScript(() => localStorage.setItem("loopat:setupPersonalRepoDismissed", "1")); });
test.afterEach(() => cleanupLoop(loopId));
test("git-stage API stages an AI-created file", async ({ page }) => {
  loopId = await createLoop(page, `dogfood-stg-${Date.now()}`);
  await bootSandbox(page, loopId);
  await sendAndAwaitReply(page, "Create STAGED.txt with content s in the workdir. Do not commit. Reply done.");
  await expect.poll(() => { try { return sandboxExec(loopId, `ls /loopat/loop/${loopId}/workdir`); } catch { return ""; } },
    { timeout: 60000, intervals:[1000,2000,3000] }).toContain("STAGED.txt");
  expect((await page.request.post(`/api/loops/${loopId}/git-stage`, { data: { files: ["STAGED.txt"] } })).status()).toBeLessThan(400);
});
