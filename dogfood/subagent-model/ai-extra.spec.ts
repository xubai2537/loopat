/**
 * ai-extra — a single real turn, then exercise the turn-dependent endpoints
 * (chat-history export, restart-session) against integration truth. Runs on the
 * subagent-model idealab stack so one cheap opus-4-6 turn covers several APIs.
 */
import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const META = join(import.meta.dirname, "..", ".test-meta.json");
const { vitePort, loopatHome } = JSON.parse(readFileSync(META, "utf8")) as { vitePort: number; loopatHome: string };
const BASE = `http://127.0.0.1:${vitePort}`;

let api: APIRequestContext;
test.beforeAll(async () => { api = await request.newContext({ baseURL: BASE, storageStatePath: join(import.meta.dirname, "..", ".auth.json") }); });
test.afterAll(async () => { await api.dispose(); });

test("one turn → chat-history exports, restart-session restarts, messages persist", async () => {
  const id = (await (await api.post("/api/v1/loops", { data: { name: "ai-extra" } })).json()).id;
  const raw = id.replace(/^loop_/, "");
  const send = await api.post(`/api/v1/loops/${id}/messages`, { data: { content: "Reply with exactly: PONG" } });
  expect(send.status()).toBeLessThan(300);

  // Real turn lands on disk — poll the loop's transcript for an assistant reply.
  await expect.poll(() => {
    const p = join(loopatHome, "loops", raw, "messages.jsonl");
    return existsSync(p) ? readFileSync(p, "utf8") : "";
  }, { timeout: 120_000, intervals: [2_000, 3_000, 5_000] }).toContain("assistant");

  const hist = await api.get(`/api/loops/${raw}/chat-history`);
  expect(hist.status()).toBe(200);
  expect((await hist.text()).length).toBeGreaterThan(0);

  expect((await api.post(`/api/loops/${raw}/restart-session`, { data: {} })).status()).toBeLessThan(400);

  await api.delete(`/api/v1/loops/${id}`);
});
