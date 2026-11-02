import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiCall } from "./client";
import { onOrganizationChanged, renameOrganization } from "./orgs";

vi.mock("./client", () => ({ apiCall: vi.fn() }));

describe("renameOrganization — phát sự kiện đổi tổ chức", () => {
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
