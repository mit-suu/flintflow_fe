import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isActiveOrgNotFoundEndpoint,
  isLostOrgError,
  recoverFromLostOrgAccess,
  resetOrgAccessRecoveryForTests,
} from "./org-access-lost";

describe("isActiveOrgNotFoundEndpoint", () => {
  it("khớp đúng /orgs/:activeOrgId và các đường dẫn con của nó", () => {
    expect(isActiveOrgNotFoundEndpoint("/orgs/org-a", "org-a")).toBe(true);
    expect(isActiveOrgNotFoundEndpoint("/orgs/org-a/members", "org-a")).toBe(true);
    expect(isActiveOrgNotFoundEndpoint("/orgs/org-a?include=count", "org-a")).toBe(true);
    expect(isActiveOrgNotFoundEndpoint("/orgs/org-a/members?page=2", "org-a")).toBe(true);
  });

  it("không khớp org khác, prefix gần giống, hoặc khi thiếu activeOrgId", () => {
    expect(isActiveOrgNotFoundEndpoint("/orgs/org-ab", "org-a")).toBe(false);
    expect(isActiveOrgNotFoundEndpoint("/orgs/org-other/switch", "org-a")).toBe(false);
    expect(isActiveOrgNotFoundEndpoint("/orgs", "org-a")).toBe(false);
    expect(isActiveOrgNotFoundEndpoint("/projects/p1", "org-a")).toBe(false);
    expect(isActiveOrgNotFoundEndpoint("/orgs/org-a/members", null)).toBe(false);
    expect(isActiveOrgNotFoundEndpoint("/orgs/org-a/members", "")).toBe(false);
  });
});

describe("isLostOrgError", () => {
  it("nhận diện 403 ORG_FORBIDDEN, 409 NO_ACTIVE_ORG, và 404 ORG_NOT_FOUND của active org", () => {
    expect(isLostOrgError(403, "ORG_FORBIDDEN", "/projects", "org-a")).toBe(true);
    expect(isLostOrgError(409, "NO_ACTIVE_ORG", "/projects", null)).toBe(true);
    expect(isLostOrgError(404, "ORG_NOT_FOUND", "/orgs/org-a/members", "org-a")).toBe(true);
  });

  it("bỏ qua 404 ORG_NOT_FOUND của org khác và các mã lỗi quyền/tài nguyên khác", () => {
    expect(isLostOrgError(404, "ORG_NOT_FOUND", "/orgs/org-other/switch", "org-a")).toBe(false);
    expect(isLostOrgError(403, "ORG_ROLE_FORBIDDEN", "/orgs/org-a/invitations", "org-a")).toBe(false);
    expect(isLostOrgError(403, "ACCOUNT_SUSPENDED", "/users/me", "org-a")).toBe(false);
    expect(isLostOrgError(404, "PROJECT_NOT_FOUND", "/projects/p1", "org-a")).toBe(false);
    expect(isLostOrgError(409, "LAST_LEAD", "/orgs/org-a/members/me", "org-a")).toBe(false);
  });
});

describe("recoverFromLostOrgAccess", () => {
  const originalLocation = window.location;

  const setPathname = (pathname: string) => {
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, pathname, replace: vi.fn() },
      writable: true,
      configurable: true,
    });
  };

  beforeEach(() => {
    resetOrgAccessRecoveryForTests();
    setPathname("/home");
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it("còn >= 1 org ⇒ chuyển hướng sang /home/organizations", async () => {
    const refresh = vi.fn(async () => "ok" as const);
    const fetchOrgsCount = vi.fn(async () => 2);
    const redirect = vi.fn();

    await recoverFromLostOrgAccess({ refresh, fetchOrgsCount, redirect });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchOrgsCount).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/home/organizations");
  });

  it("hết org (0) ⇒ chuyển hướng sang /home/onboarding", async () => {
    const refresh = vi.fn(async () => "ok" as const);
    const fetchOrgsCount = vi.fn(async () => 0);
    const redirect = vi.fn();

    await recoverFromLostOrgAccess({ refresh, fetchOrgsCount, redirect });

    expect(redirect).toHaveBeenCalledWith("/home/onboarding");
  });

  it("lỗi tạm thời khi đọc danh sách org ⇒ vẫn chuyển sang /home/organizations", async () => {
    const refresh = vi.fn(async () => "ok" as const);
    const fetchOrgsCount = vi.fn(async () => {
      throw new Error("503");
    });
    const redirect = vi.fn();

    await recoverFromLostOrgAccess({ refresh, fetchOrgsCount, redirect });

    expect(redirect).toHaveBeenCalledWith("/home/organizations");
  });

  it("refresh bị từ chối (rejected) ⇒ dừng, không gọi fetchOrgsCount hay redirect", async () => {
    const refresh = vi.fn(async () => "rejected" as const);
    const fetchOrgsCount = vi.fn(async () => 1);
    const redirect = vi.fn();

    await recoverFromLostOrgAccess({ refresh, fetchOrgsCount, redirect });

    expect(fetchOrgsCount).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("fetchOrgsCount trả null (vd ACCOUNT_SUSPENDED đã tự chuyển về /login) ⇒ không redirect đè", async () => {
    const refresh = vi.fn(async () => "ok" as const);
    const fetchOrgsCount = vi.fn(async () => null);
    const redirect = vi.fn();

    await recoverFromLostOrgAccess({ refresh, fetchOrgsCount, redirect });

    expect(redirect).not.toHaveBeenCalled();
  });

  it("chống gọi trùng khi nhiều request song song cùng kích hoạt", async () => {
    let resolveRefresh: (value: "ok") => void = () => undefined;
    const refresh = vi.fn(
      () =>
        new Promise<"ok">((resolve) => {
          resolveRefresh = resolve;
        })
    );
    const fetchOrgsCount = vi.fn(async () => 1);
    const redirect = vi.fn();

    const p1 = recoverFromLostOrgAccess({ refresh, fetchOrgsCount, redirect });
    const p2 = recoverFromLostOrgAccess({ refresh, fetchOrgsCount, redirect });
    resolveRefresh("ok");
    await Promise.all([p1, p2]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchOrgsCount).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it.each([
    "/home/onboarding",
    "/home/organizations",
    "/login",
    "/register",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
    "/admin",
    "/admin/users",
  ])("đang đứng ở %s ⇒ bỏ qua, không chuyển trang lặp", async (pathname) => {
    setPathname(pathname);
    const refresh = vi.fn(async () => "ok" as const);
    const fetchOrgsCount = vi.fn(async () => 1);
    const redirect = vi.fn();

    await recoverFromLostOrgAccess({ refresh, fetchOrgsCount, redirect });

    expect(refresh).not.toHaveBeenCalled();
    expect(fetchOrgsCount).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
