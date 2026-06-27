import { describe, it, expect } from "vitest";
import {
  tenant,
  tenantMember,
  tenantPlanEnum,
  tenantRegionEnum,
  memberRoleEnum,
  memberScopeEnum,
} from "@/lib/db/schema";

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
