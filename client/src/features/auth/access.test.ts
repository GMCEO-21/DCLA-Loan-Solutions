import { describe, expect, it } from "vitest";
import { canManageSavings, getDefaultRouteForRole } from "./access";

describe("canManageSavings", () => {
  it("matches the backend mutation authorization without expanding routes", () => {
    expect(canManageSavings("loan processor")).toBe(false);
    expect(canManageSavings("manager")).toBe(false);
    expect(canManageSavings("cashier")).toBe(true);
    expect(canManageSavings("admin")).toBe(true);
  });

  it("keeps verified users on the existing role-specific startup route", () => {
    expect(getDefaultRouteForRole("admin")).toBe("/dashboard");
    expect(getDefaultRouteForRole("loan processor")).toBe("/member-management");
  });
});
