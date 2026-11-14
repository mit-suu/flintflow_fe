import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiCall } from "./client";
import { changeMemberRole, onOrganizationChanged, renameOrganization } from "./orgs";

vi.mock("./client", () => ({ apiCall: vi.fn() }));

describe("renameOrganization - phát sự kiện đổi tổ chức", () => {
  const listener = vi.fn();
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribe = onOrganizationChanged(listener);
  });
  afterEach(() => unsubscribe());

  it("đổi tên thành công ⇒ PATCH /orgs/:id rồi phát sự kiện đúng một lần", async () => {
    const org = { id: "org-a", name: "Nhóm Mới", role: "lead", joinedAt: "2026-09-01T00:00:00Z" };
    vi.mocked(apiCall).mockResolvedValue({ data: org, meta: null, error: null } as never);

    await expect(renameOrganization("org-a", "Nhóm Mới")).resolves.toEqual(org);
    expect(apiCall).toHaveBeenCalledWith("/orgs/org-a", { method: "PATCH", body: JSON.stringify({ name: "Nhóm Mới" }) });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("BE từ chối ⇒ ném lỗi, không phát sự kiện", async () => {
    vi.mocked(apiCall).mockRejectedValue(new Error("VALIDATION_ERROR"));

    await expect(renameOrganization("org-a", "")).rejects.toThrow("VALIDATION_ERROR");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("changeMemberRole - phát sự kiện đổi tổ chức", () => {
  const listener = vi.fn();
  let unsubscribe: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribe = onOrganizationChanged(listener);
  });
  afterEach(() => unsubscribe());

  it("đổi vai trò thành công ⇒ PATCH /orgs/:orgId/members/:userId/role rồi phát sự kiện đúng một lần", async () => {
    const updated = {
      userId: "u-1",
      email: "u1@flintflow.test",
      name: "An",
      role: "analyst",
      joinedAt: "2026-09-01T00:00:00Z",
    };
    vi.mocked(apiCall).mockResolvedValue({ data: updated, meta: null, error: null } as never);

    await expect(changeMemberRole("org-a", "u-1", "analyst")).resolves.toEqual(updated);
    expect(apiCall).toHaveBeenCalledWith("/orgs/org-a/members/u-1/role", {
      method: "PATCH",
      body: JSON.stringify({ role: "analyst" }),
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("BE từ chối ⇒ ném lỗi, không phát sự kiện", async () => {
    vi.mocked(apiCall).mockRejectedValue(new Error("LAST_LEAD"));

    await expect(changeMemberRole("org-a", "u-1", "analyst")).rejects.toThrow("LAST_LEAD");
    expect(listener).not.toHaveBeenCalled();
  });
});
