import { describe, expect, it } from "vitest";
import { resolvePostAuthDestination } from "./post-auth-redirect";

describe("resolvePostAuthDestination", () => {
  it("role admin luôn về /admin/metrics bất kể tổ chức hay onboarding", () => {
    expect(resolvePostAuthDestination({ role: "admin" })).toBe("/admin/metrics");
    expect(resolvePostAuthDestination({ role: "admin", needsOnboarding: true })).toBe("/admin/metrics");
    expect(resolvePostAuthDestination({ role: "admin", organizations: [] })).toBe("/admin/metrics");
    expect(
      resolvePostAuthDestination({
        role: "admin",
        organizations: [{ id: "o1" }, { id: "o2" }],
        activeOrgId: null,
      })
    ).toBe("/admin/metrics");
  });

  it("needsOnboarding: true ⇒ về /home/onboarding", () => {
    expect(resolvePostAuthDestination({ role: "user", needsOnboarding: true })).toBe("/home/onboarding");
  });

  it("chưa có tổ chức (organizations: []) ⇒ về /home/onboarding", () => {
    expect(resolvePostAuthDestination({ role: "user", organizations: [] })).toBe("/home/onboarding");
  });

  it("có đúng 1 tổ chức ⇒ về /home", () => {
    expect(
      resolvePostAuthDestination({
        role: "user",
        organizations: [{ id: "o1" }],
        activeOrgId: null,
      })
    ).toBe("/home");
  });

  it("có từ 2 tổ chức trở lên nhưng chưa có activeOrgId ⇒ về /home/organizations", () => {
    expect(
      resolvePostAuthDestination({
        role: "user",
        organizations: [{ id: "o1" }, { id: "o2" }],
        activeOrgId: null,
      })
    ).toBe("/home/organizations");
  });

  it("có từ 2 tổ chức và đã có activeOrgId ⇒ về /home", () => {
    expect(
      resolvePostAuthDestination({
        role: "user",
        organizations: [{ id: "o1" }, { id: "o2" }],
        activeOrgId: "o1",
      })
    ).toBe("/home");
  });

  it("mặc định khi không có thông tin tổ chức ⇒ về /home", () => {
    expect(resolvePostAuthDestination({})).toBe("/home");
    expect(resolvePostAuthDestination({ role: "user" })).toBe("/home");
  });
});
