import { describe, it, expect, vi, beforeEach } from "vitest";

const insertActivity = vi.fn(async () => {});
vi.mock("@/lib/db/repos/activityRepo.js", () => ({ insertActivity }));

const { maskSecrets, recordSystemActivity } = await import("../../src/lib/activity.js");

describe("system activity events", () => {
  beforeEach(() => insertActivity.mockClear());

  it("masks keys and bearer tokens in upstream error text", () => {
    const out = maskSecrets("Incorrect API key sk-abcdef1234567890 and Bearer abc.def.ghi123456 token=SuperSecret99");
    expect(out).not.toMatch(/abcdef1234567890|abc\.def\.ghi123456|SuperSecret99/);
    expect(out).toContain("[redacted]");
  });

  it("records once per dedupe key inside the window and never stores a planted secret", async () => {
    const evt = { type: "request.error", summary: "openai failed [401]: bad key sk-PLANTEDSECRET123456", dedupeKey: "t|1" };
    recordSystemActivity(evt);
    recordSystemActivity(evt);
    await new Promise((r) => setTimeout(r, 20));
    expect(insertActivity).toHaveBeenCalledTimes(1);
    const saved = insertActivity.mock.calls[0][0];
    expect(saved.actor).toBe("system");
    expect(JSON.stringify(saved)).not.toContain("PLANTEDSECRET123456");
  });
});
