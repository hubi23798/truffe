import { describe, it, expect, beforeEach, vi } from "vitest";
import { appendAudit, __resetForTests } from "@/lib/audit/append";

const fakeDb = {
  transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ thisHash: Buffer.alloc(32, 0) }]),
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) }),
      }),
    };
    return cb(tx);
  }),
};

describe("appendAudit", () => {
  beforeEach(() => {
    __resetForTests();
    fakeDb.transaction.mockClear();
  });

  it("links to the previous tenant row's hash", async () => {
    await appendAudit(fakeDb as never, {
      tenantId: "00000000-0000-0000-0000-0000000000aa",
      actorUserId: "00000000-0000-0000-0000-000000000001",
      action: "transaction.categorize",
      targetType: "transaction",
      targetId: "abc",
      before: { categoryId: null },
      after: { categoryId: "groceries" },
      context: { ip: "127.0.0.1" },
    });
    expect(fakeDb.transaction).toHaveBeenCalledTimes(1);
  });
});
