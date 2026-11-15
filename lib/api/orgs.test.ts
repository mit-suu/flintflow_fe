import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiCall } from "./client";
import { onOrganizationChanged, renameOrganization, switchOrganization } from "./orgs";

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

describe("switchOrganization - chọn tổ chức kèm ghi nhớ mặc định", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("không truyền options ⇒ POST /orgs/:id/switch không body", async () => {
    const org = { id: "org-1", name: "Nhóm 1", role: "lead", joinedAt: "2026-09-01T00:00:00Z" };
    vi.mocked(apiCall).mockResolvedValue({
      data: { accessToken: "token-1", organization: org },
      meta: null,
      error: null,
    } as never);

    const res = await switchOrganization("org-1");

    expect(res.organization).toEqual(org);
    expect(apiCall).toHaveBeenCalledWith("/orgs/org-1/switch", { method: "POST" });
  });

  it("truyền rememberAsDefault: true ⇒ gửi body JSON { rememberAsDefault: true }", async () => {
    const org = { id: "org-2", name: "Nhóm 2", role: "viewer", joinedAt: "2026-09-01T00:00:00Z" };
    vi.mocked(apiCall).mockResolvedValue({
      data: { accessToken: "token-2", organization: org },
      meta: null,
      error: null,
    } as never);

    await switchOrganization("org-2", { rememberAsDefault: true });

    expect(apiCall).toHaveBeenCalledWith("/orgs/org-2/switch", {
      method: "POST",
      body: JSON.stringify({ rememberAsDefault: true }),
    });
  });

  it("truyền rememberAsDefault: false ⇒ gửi body JSON { rememberAsDefault: false }", async () => {
    const org = { id: "org-3", name: "Nhóm 3", role: "analyst", joinedAt: "2026-09-01T00:00:00Z" };
    vi.mocked(apiCall).mockResolvedValue({
      data: { accessToken: "token-3", organization: org },
      meta: null,
      error: null,
    } as never);

    await switchOrganization("org-3", { rememberAsDefault: false });

    expect(apiCall).toHaveBeenCalledWith("/orgs/org-3/switch", {
      method: "POST",
      body: JSON.stringify({ rememberAsDefault: false }),
    });
  });
});
