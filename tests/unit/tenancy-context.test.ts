import { describe, it, expect } from "vitest";
import {
  tenant,
  tenantMember,
  tenantPlanEnum,
  tenantRegionEnum,
  memberRoleEnum,
  memberScopeEnum,
} from "@/lib/db/schema";
import { resolveTenantId } from "@/lib/tenancy/context";

describe("tenancy schema", () => {
  it("exports tenant table", () => {
    expect(tenant).toBeDefined();
  });

  it("exports tenantMember table", () => {
    expect(tenantMember).toBeDefined();
  });

  it("exports all four tenancy enums", () => {
    expect(tenantPlanEnum).toBeDefined();
    expect(tenantRegionEnum).toBeDefined();
    expect(memberRoleEnum).toBeDefined();
    expect(memberScopeEnum).toBeDefined();
  });
});

describe("resolveTenantId", () => {
  it("returns claim from x-supabase-jwt-claims header", async () => {
    const req = new Request("http://x", {
      headers: {
        "x-supabase-jwt-claims": JSON.stringify({
          active_tenant_id: "00000000-0000-0000-0000-0000000000aa",
        }),
      },
    });
    expect(await resolveTenantId(req)).toBe("00000000-0000-0000-0000-0000000000aa");
  });

  it("throws when active_tenant_id claim is absent", async () => {
    const req = new Request("http://x");
    await expect(resolveTenantId(req)).rejects.toThrow(/active_tenant_id/);
  });
});
