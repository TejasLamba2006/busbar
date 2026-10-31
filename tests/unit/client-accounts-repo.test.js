import { describe, it, expect, beforeEach } from "vitest";
import {
  createApiKey,
  getApiKeyById,
  getApiKeyByKey,
  updateApiKey,
  deleteApiKey,
  authenticateClientKey,
} from "../../src/lib/db/repos/apiKeysRepo.js";

describe("apiKeysRepo client accounts & tokenSaverSettings", () => {
  const createdIds = [];

  beforeEach(async () => {
    while (createdIds.length) {
      const id = createdIds.pop();
      await deleteApiKey(id).catch(() => {});
    }
  });

  it("stores and updates clientEmail and tokenSaverSettings on an API key", async () => {
    const key = await createApiKey("Client Alice", "machine-test-12345678", [], {
      clientEmail: "alice@example.com",
    });
    createdIds.push(key.id);

    expect(key.clientEmail).toBe("alice@example.com");
    expect(key.tokenSaverSettings).toEqual({});

    const updated = await updateApiKey(key.id, {
      clientEmail: "alice2@example.com",
      tokenSaverSettings: {
        rtkEnabled: true,
        cavemanEnabled: true,
        cavemanLevel: "ultra",
        ponytailEnabled: false,
      },
    });

    expect(updated.clientEmail).toBe("alice2@example.com");
    expect(updated.tokenSaverSettings).toEqual({
      rtkEnabled: true,
      cavemanEnabled: true,
      cavemanLevel: "ultra",
      ponytailEnabled: false,
    });

    const byKey = await getApiKeyByKey(key.key);
    expect(byKey.clientEmail).toBe("alice2@example.com");
    expect(byKey.tokenSaverSettings.cavemanLevel).toBe("ultra");
  });

  it("authenticates a client key by API key password (and optional email match)", async () => {
    const key = await createApiKey("Client Bob", "machine-test-12345678", [], {
      clientEmail: "bob@example.com",
    });
    createdIds.push(key.id);

    // Match with email + key
    const authWithEmail = await authenticateClientKey("bob@example.com", key.key);
    expect(authWithEmail?.id).toBe(key.id);

    // Match with key alone when email omitted
    const authKeyOnly = await authenticateClientKey("", key.key);
    expect(authKeyOnly?.id).toBe(key.id);

    // Wrong email fails
    const wrongEmail = await authenticateClientKey("wrong@example.com", key.key);
    expect(wrongEmail).toBeNull();

    // Inactive key fails
    await updateApiKey(key.id, { isActive: false });
    const inactiveAuth = await authenticateClientKey("bob@example.com", key.key);
    expect(inactiveAuth).toBeNull();
  });
});
