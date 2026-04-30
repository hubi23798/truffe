import { describe, expect, it, vi } from "vitest";
import { recordAudit } from "@/lib/audit";

describe("recordAudit", () => {
  it("inserts a row with the entry fields set", async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    const fakeDb = { insert: insertMock } as unknown as Parameters<typeof recordAudit>[0];

    await recordAudit(fakeDb, {
      actor: "user",
      action: "session.create",
      userId: "00000000-0000-0000-0000-000000000001",
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledTimes(1);
    const valuesArg = valuesMock.mock.calls[0]![0];
    expect(valuesArg.actor).toBe("user");
    expect(valuesArg.action).toBe("session.create");
    expect(valuesArg.userId).toBe("00000000-0000-0000-0000-000000000001");
  });
});
