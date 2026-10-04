import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import { useActiveOrganization } from "./use-active-org";

vi.mock("@/lib/api/orgs", () => ({ fetchOrganization: vi.fn() }));
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
});
