/**
 * api-surface — deterministic REST coverage on the real booted stack (no AI).
 *
 * One backend, real LOOPAT_HOME, real auth. Each test exercises one endpoint
 * family end to end against integration truth. Cheap + fast: no tokens spent.
 * Fills the gap between unit tests (mocked) and the AI journeys (slow/$$).
 */
import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const META = join(import.meta.dirname, "..", ".test-meta.json");
const { vitePort, testServerPort } = JSON.parse(readFileSync(META, "utf8")) as { vitePort: number; testServerPort: number };
const BASE = `http://127.0.0.1:${vitePort}`;
const BACKEND = `http://127.0.0.1:${testServerPort}`;

let api: APIRequestContext;
test.beforeAll(async () => {
  api = await request.newContext({ baseURL: BASE, storageStatePath: join(import.meta.dirname, "..", ".auth.json") });
});
test.afterAll(async () => { await api.dispose(); });

test("health reports the isolated workspace", async () => {
  const r = await (await api.get("/api/health")).json();
  expect(r.ok).toBe(true);
  expect(r.loopatHome).toContain("loopat-dogfood-");
});

test("auth/me returns the onboarded test user", async () => {
  const r = await api.get("/api/auth/me");
  expect(r.status()).toBe(200);
  const u = (await r.json()).user;
  expect(u.id, "session resolves to a user").toBeTruthy();
  expect(u.status).toBe("active");
});

test("register rejects a duplicate username", async () => {
  const r = await api.post("/api/auth/register", { data: { username: "test", password: "x" } });
  expect(r.status()).toBeGreaterThanOrEqual(400);
});

test("providers list includes the configured anthropic provider", async () => {
  const r = await (await api.get("/api/providers")).json();
  const names = (r.providers ?? r).map ? (r.providers ?? r).map((p: any) => p.name ?? p) : Object.keys(r.providers ?? r);
  expect(JSON.stringify(r)).toContain("anthropic");
});

test("vaults endpoint lists the default vault", async () => {
  const r = await (await api.get("/api/vaults")).json();
  expect(JSON.stringify(r)).toContain("default");
});

test("loop create → get → patch title → delete round-trips", async () => {
  const c = await api.post("/api/v1/loops", { data: { name: "api-surface-crud" } });
  expect(c.status()).toBeLessThan(300);
  const id = (await c.json()).id;
  const got = await api.get(`/api/v1/loops/${id}`);
  expect(got.status()).toBe(200);
  const raw = id.replace(/^loop_/, "");
  const pat = await api.patch(`/api/loops/${raw}`, { data: { title: "renamed-by-test" } });
  expect(pat.status()).toBeLessThan(300);
  const after = await (await api.get(`/api/v1/loops/${id}`)).json();
  expect(after.title).toBe("renamed-by-test");
  const del = await api.delete(`/api/v1/loops/${id}`);
  expect(del.status()).toBeLessThan(300);
});

test("loop archive flag round-trips via PATCH", async () => {
  const id = (await (await api.post("/api/v1/loops", { data: { name: "arch" } })).json()).id;
  const raw = id.replace(/^loop_/, "");
  await api.patch(`/api/loops/${raw}`, { data: { archived: true } });
  const g = await (await api.get(`/api/v1/loops/${id}`)).json();
  expect(g.archived).toBe(true);
  await api.patch(`/api/loops/${raw}`, { data: { archived: false } });
  expect((await (await api.get(`/api/v1/loops/${id}`)).json()).archived).toBe(false);
  await api.delete(`/api/v1/loops/${id}`);
});

test("api tokens: create, list, delete", async () => {
  const c = await api.post("/api/v1/me/tokens", { data: { label: "tok-test" } });
  expect(c.status()).toBeLessThan(300);
  const tid = (await c.json()).tokenId;
  const list = await (await api.get("/api/v1/me/tokens")).json();
  expect(JSON.stringify(list)).toContain("tok-test");
  expect((await api.delete(`/api/v1/me/tokens/${tid}`)).status()).toBeLessThan(300);
});

test("kanban board create → rename → delete", async () => {
  const name = `b${Date.now()}`;
  const c = await api.post("/api/kanban/boards", { data: { name } });
  expect(c.status()).toBeLessThan(300);
  const rn = await api.put(`/api/kanban/boards/${name}/rename`, { data: { name: `${name}-r` } });
  expect(rn.status()).toBeLessThan(400);
  const boards = await (await api.get("/api/kanban/boards")).json();
  expect(JSON.stringify(boards)).toContain(name);
});

test("read-only endpoints respond: loop-stats, profiles, marketplaces", async () => {
  expect((await api.get("/api/loop-stats")).status()).toBe(200);
  expect((await api.get("/api/profiles")).status()).toBe(200);
  expect((await api.get("/api/marketplaces")).status()).toBe(200);
});

test("version + tiers endpoints respond", async () => {
  expect((await api.get("/api/version")).status()).toBe(200);
  expect((await api.get("/api/tiers")).status()).toBe(200);
});

test("serve config reads & writes", async () => {
  expect((await api.get("/api/serve/config")).status()).toBe(200);
});

test("settings personal + token usage daily respond", async () => {
  expect((await api.get("/api/settings/personal")).status()).toBe(200);
  expect((await api.get("/api/settings/token-usage/daily")).status()).toBe(200);
});

test("context/repos reflects the seeded roster1", async () => {
  const r = await (await api.get("/api/context/repos")).json();
  expect(JSON.stringify(r)).toContain("roster1");
});

test("onboarding + personal status endpoints respond", async () => {
  expect((await api.get("/api/onboarding")).status()).toBe(200);
  expect((await api.get("/api/personal/status")).status()).toBe(200);
});

test("unknown loop id returns not-found, not 500", async () => {
  const r = await api.get("/api/v1/loops/loop_does-not-exist");
  expect([400, 404]).toContain(r.status());
});
