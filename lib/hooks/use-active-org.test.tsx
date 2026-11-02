import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitOrganizationChanged, fetchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import { useActiveOrganization } from "./use-active-org";

// Sự kiện đổi tổ chức giữ bản thật — test kiểm hook nghe đúng sự kiện mà `renameOrganization` phát
vi.mock("@/lib/api/orgs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/orgs")>();
  return { fetchOrganization: vi.fn(), emitOrganizationChanged: actual.emitOrganizationChanged, onOrganizationChanged: actual.onOrganizationChanged };
});
vi.mock("@/lib/api/token-store", () => ({ getActiveOrgId: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("useActiveOrganization", () => {
  it("trả tên và vai trò của tổ chức đang mở", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    vi.mocked(fetchOrganization).mockResolvedValue({
      id: "org-1",
      name: "Nhóm A",
      role: "analyst",
      joinedAt: "2026-10-01T00:00:00Z",
      memberCount: 2,
    });
    const { result } = renderHook(() => useActiveOrganization());
    await waitFor(() => expect(result.current).toEqual({ id: "org-1", name: "Nhóm A", role: "analyst" }));
  });

  it("chưa có tổ chức thì null và không gọi BE", () => {
    vi.mocked(getActiveOrgId).mockReturnValue(null);
    const { result } = renderHook(() => useActiveOrganization());
    expect(result.current).toBeNull();
    expect(fetchOrganization).not.toHaveBeenCalled();
  });

  it("BE lỗi thì vẫn null, không ném lỗi", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    vi.mocked(fetchOrganization).mockRejectedValue(new Error("mất mạng"));
    const { result } = renderHook(() => useActiveOrganization());
    await waitFor(() => expect(fetchOrganization).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("tổ chức đổi tên (sự kiện org-changed) ⇒ đọc lại và trả tên mới", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    const detail = { id: "org-1", name: "Nhóm A", role: "lead" as const, joinedAt: "2026-10-01T00:00:00Z", memberCount: 2 };
    vi.mocked(fetchOrganization).mockResolvedValueOnce(detail).mockResolvedValueOnce({ ...detail, name: "Nhóm B" });
    const { result } = renderHook(() => useActiveOrganization());
    await waitFor(() => expect(result.current?.name).toBe("Nhóm A"));
    act(() => emitOrganizationChanged());
    await waitFor(() => expect(result.current?.name).toBe("Nhóm B"));
    expect(fetchOrganization).toHaveBeenCalledTimes(2);
  });
});
