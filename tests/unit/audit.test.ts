import { describe, expect, it, vi } from "vitest";
import { recordAudit } from "@/lib/audit";

describe("recordAudit", () => {
  it("inserts a row with the entry fields set", async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
    const limitMock = vi.fn().mockResolvedValue([]);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    const selectMock = vi.fn().mockReturnValue({ from: fromMock });
    const transactionMock = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = { select: selectMock, insert: insertMock };
      return cb(tx);
    });
    const fakeDb = { transaction: transactionMock } as unknown as Parameters<typeof recordAudit>[0];

    await recordAudit(fakeDb, {
      actor: "user",
      action: "session.create",
      userId: "00000000-0000-0000-0000-000000000001",
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(valuesMock).toHaveBeenCalledTimes(1);
    const valuesArg = valuesMock.mock.calls[0]![0];
    expect(valuesArg.actorUserId).toBe("00000000-0000-0000-0000-000000000001");
    expect(valuesArg.action).toBe("session.create");
    expect(valuesArg.context).toEqual({ actor: "user" });
  });
});
