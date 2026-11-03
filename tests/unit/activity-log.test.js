import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let repo;
let tmp;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "activity-"));
  process.env.DATA_DIR = tmp;
  repo = await import("@/lib/db/repos/activityRepo.js");
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const add = (type, n = 0) => repo.insertActivity({ type, actor: "master", target: `t${n}`, summary: `s${n}`, meta: { n } });

describe("activityRepo", () => {
  it("inserts, lists newest first, parses meta", async () => {
    await repo.clearActivity();
    await add("key.created", 1);
    await add("provider.added", 2);
    const { events, hasMore } = await repo.listActivity();
    expect(hasMore).toBe(false);
    expect(events.map((e) => e.type)).toEqual(["provider.added", "key.created"]);
    expect(events[0]).toMatchObject({ actor: "master", target: "t2", summary: "s2", meta: { n: 2 } });
    expect(typeof events[0].ts).toBe("number");
  });

  it("filters by exact type and prefix", async () => {
    await repo.clearActivity();
    await add("key.created"); await add("key.deleted"); await add("combo.created");
    expect((await repo.listActivity({ type: "key" })).events).toHaveLength(2);
    expect((await repo.listActivity({ type: "key.deleted" })).events).toHaveLength(1);
    expect((await repo.listActivity({ type: "ke" })).events).toHaveLength(0);
  });

  it("paginates with limit/beforeId/hasMore", async () => {
    await repo.clearActivity();
    for (let i = 0; i < 5; i++) await add("key.created", i);
    const p1 = await repo.listActivity({ limit: 2 });
    expect(p1.events).toHaveLength(2);
    expect(p1.hasMore).toBe(true);
    const p2 = await repo.listActivity({ limit: 2, beforeId: p1.events[1].id });
    expect(p2.events[0].id).toBeLessThan(p1.events[1].id);
    const p3 = await repo.listActivity({ limit: 2, beforeId: p2.events[1].id });
    expect(p3.events).toHaveLength(1);
    expect(p3.hasMore).toBe(false);
  });

  it("prunes to newest N and clears", async () => {
    await repo.clearActivity();
    for (let i = 0; i < 10; i++) await add("key.created", i);
    await repo.pruneActivity(3);
    const { events } = await repo.listActivity();
    expect(events.map((e) => e.target)).toEqual(["t9", "t8", "t7"]);
    await repo.clearActivity();
    expect((await repo.listActivity()).events).toEqual([]);
  });
});

describe("secrets", () => {
  it("describeSettingsChange records key names only, never values", async () => {
    const { describeSettingsChange, recordActivity } = await import("@/lib/activity.js");
    const SECRET = "s3cr3t-PLANTED-value-xyz";
    const c = describeSettingsChange({ password: SECRET, oidcClientSecret: SECRET, comboStrategy: SECRET, newPassword: SECRET });
    await repo.clearActivity();
    recordActivity({ type: "settings.updated", actor: "master", summary: c.summary, target: c.target, meta: c.meta });
    let events = [];
    for (let i = 0; i < 50 && !events.length; i++) {
      await new Promise((r) => setTimeout(r, 20));
      events = (await repo.listActivity()).events;
    }
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0])).not.toContain(SECRET);
    expect(events[0].meta.keys).toContain("comboStrategy");
  });

  it("recordActivity never throws on bad input", async () => {
    const { recordActivity } = await import("@/lib/activity.js");
    expect(() => recordActivity({})).not.toThrow();
    expect(() => recordActivity(undefined)).not.toThrow();
  });
});
