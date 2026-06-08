/**
 * context — loop creation freshness fields. Create through the UI choosing
 * "Cached", read the loop's recorded knowledge sha, then create a snapshot loop
 * pinned to that sha via the API and confirm it lands on the exact same commit.
 * Proves: context field plumbs, versions are recorded, snapshot reproduces.
 */
import { test, expect } from "@playwright/test";
import { cleanupLoop } from "./helpers";

const ids: string[] = [];
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem("loopat:setupPersonalRepoDismissed", "1")); });
test.afterEach(() => ids.splice(0).forEach(cleanupLoop));

test("cached create records versions; snapshot reproduces the same sha", async ({ page }) => {
  await page.goto("/loop");
  await page.getByRole("button", { name: /^\+?\s*New Loop$/i }).first().click();
  await expect(page.getByText("New loop", { exact: true })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("combobox").first().selectOption("roster1");
  await page.getByPlaceholder("refactor-gateway").fill(`dogfood-ctx-${Date.now()}`);
  await page.getByText("Cached", { exact: true }).click(); // pick the cached freshness radio
  const created = page.waitForResponse((r) => r.url().includes("/api/v1/loops") && r.request().method() === "POST");
  await page.getByRole("button", { name: "create", exact: true }).click();
  const a = await (await created).json();
  ids.push(String(a.id).replace(/^loop_/, ""));
  expect(a.versions, "create returns recorded versions").toBeTruthy();
  const kn = a.versions.knowledge;
  expect(kn, "knowledge sha recorded").toBeTruthy();

  // Snapshot: pin the same knowledge sha → must land on the same commit.
  const snap = await (await page.request.post("/api/v1/loops", { data: { name: "snap", repo: "roster1", context: { knowledge: kn } } })).json();
  ids.push(String(snap.id).replace(/^loop_/, ""));
  expect(snap.versions.knowledge, "snapshot reproduces the pinned sha").toBe(kn);
});
