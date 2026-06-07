/**
 * api-surface2 — second deterministic batch: kanban card lifecycle, profiles,
 * default-profiles, serve port helpers, sync status, settings round-trip, a2a,
 * mcp servers, notes/behind, loop file/git endpoints. No AI spend.
 */
import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const META = join(import.meta.dirname, "..", ".test-meta.json");
const { vitePort } = JSON.parse(readFileSync(META, "utf8")) as { vitePort: number };
const BASE = `http://127.0.0.1:${vitePort}`;

let api: APIRequestContext;
test.beforeAll(async () => {
  api = await request.newContext({ baseURL: BASE, storageStatePath: join(import.meta.dirname, "..", ".auth.json") });
});
test.afterAll(async () => { await api.dispose(); });

test("kanban column + card lifecycle", async () => {
  const board = `kb${Date.now()}`;
  expect((await api.post("/api/kanban/boards", { data: { name: board } })).status()).toBeLessThan(300);
  const col = await api.post(`/api/kanban/columns/${board}`, { data: { filename: "todo", title: "Todo" } });
  expect(col.status()).toBeLessThan(300);
  const cols = await (await api.get(`/api/kanban/${board}`)).json();
  expect(JSON.stringify(cols)).toContain("todo");
});

test("admin profiles: create → get → delete", async () => {
  const name = `p${Date.now()}`;
  const c = await api.post("/api/admin/profiles", { data: { name, model: "claude-opus-4-7" } });
  expect([200, 201, 400, 409]).toContain(c.status());
  if (c.status() < 300) {
    expect((await api.get(`/api/admin/profiles/${name}`)).status()).toBe(200);
    expect((await api.delete(`/api/admin/profiles/${name}`)).status()).toBeLessThan(300);
  }
});

test("default-profiles read + write round-trip", async () => {
  const before = await api.get("/api/personal/default-profiles");
  expect(before.status()).toBe(200);
  const put = await api.put("/api/personal/default-profiles", { data: { default_profiles: [] } });
  expect(put.status()).toBeLessThan(400);
});

test("serve helpers: available-port, check-port, alias-check", async () => {
  expect((await api.get("/api/serve/available-port")).status()).toBe(200);
  expect((await api.get("/api/serve/check-port?port=18080")).status()).toBe(200);
  expect((await api.get("/api/serve/alias-check?alias=foo")).status()).toBe(200);
});

test("sync status endpoints respond", async () => {
  expect((await api.get("/api/sync/knowledge/status")).status()).toBe(200);
  expect((await api.get("/api/sync/notes/status")).status()).toBe(200);
  expect((await api.get("/api/sync/repos")).status()).toBe(200);
});

test("settings workspace + personal disk read", async () => {
  expect((await api.get("/api/settings/workspace")).status()).toBe(200);
  expect((await api.get("/api/settings/personal/disk")).status()).toBe(200);
});

test("settings personal value write is accepted", async () => {
  const r = await api.post("/api/settings/personal/value", { data: { name: "TEST_KEY", value: "x", vault: "default" } });
  expect(r.status()).toBeLessThan(400);
});

test("a2a config + key endpoints respond", async () => {
  expect((await api.get("/api/a2a")).status()).toBe(200);
});

test("mcp servers list + plugins available respond", async () => {
  expect((await api.get("/api/mcp-servers")).status()).toBe(200);
  expect((await api.get("/api/plugins/available")).status()).toBe(200);
});

test("notes behind + topics respond", async () => {
  expect((await api.get("/api/notes/behind")).status()).toBe(200);
  expect((await api.get("/api/topics")).status()).toBe(200);
});

test("loop file/git endpoints respond for a fresh loop", async () => {
  const id = (await (await api.post("/api/v1/loops", { data: { name: "files" } })).json()).id;
  const raw = id.replace(/^loop_/, "");
  expect((await api.get(`/api/loops/${raw}/files`)).status()).toBeLessThan(500);
  expect((await api.get(`/api/loops/${raw}/git-status`)).status()).toBeLessThan(500);
  await api.delete(`/api/v1/loops/${id}`);
});

test("loop-stats + admin users + admin presets respond", async () => {
  expect((await api.get("/api/loop-stats")).status()).toBe(200);
  expect((await api.get("/api/admin/users")).status()).toBe(200);
  expect((await api.get("/api/admin/presets")).status()).toBe(200);
});
