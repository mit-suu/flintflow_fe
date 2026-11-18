import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitOrganizationChanged, fetchOrganization } from "@/lib/api/orgs";
import { getActiveOrgId } from "@/lib/api/token-store";
import { clearActiveOrgCache, readActiveOrgCache, writeActiveOrgCache } from "@/lib/active-org-cache";
import { resetActiveOrganizationStore, useActiveOrganization, useActiveOrganizationState } from "./use-active-org";

// Sự kiện đổi tổ chức giữ bản thật — test kiểm hook nghe đúng sự kiện mà `renameOrganization` phát
vi.mock("@/lib/api/orgs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/orgs")>();
  return { fetchOrganization: vi.fn(), emitOrganizationChanged: actual.emitOrganizationChanged, onOrganizationChanged: actual.onOrganizationChanged };
});
vi.mock("@/lib/api/token-store", () => ({ getActiveOrgId: vi.fn() }));

// Store dùng chung cả app (biến cấp module) + bản nhớ ở cookie ⇒ mỗi test bắt đầu từ trạng thái chưa đọc gì
beforeEach(() => {
  vi.clearAllMocks();
  resetActiveOrganizationStore();
  clearActiveOrgCache();
});

const DETAIL = { id: "org-1", name: "Nhóm A", role: "analyst" as const, joinedAt: "2026-10-01T00:00:00Z", memberCount: 2 };

describe("bản nhớ tổ chức + store dùng chung", () => {
  it("tải xong thì nhớ vào cookie; lần sau trả ngay bản nhớ (loading: false) rồi đọc lại ngầm", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    vi.mocked(fetchOrganization).mockResolvedValue(DETAIL);
    const first = renderHook(() => useActiveOrganizationState());
    await waitFor(() => expect(first.result.current.org?.name).toBe("Nhóm A"));
    expect(readActiveOrgCache()).toEqual({ id: "org-1", name: "Nhóm A", role: "analyst" });
    first.unmount();

    // Như tải lại trang: store trong bộ nhớ mất, chỉ còn bản nhớ
    resetActiveOrganizationStore();
    vi.mocked(fetchOrganization).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useActiveOrganizationState());
    expect(result.current).toEqual({ org: { id: "org-1", name: "Nhóm A", role: "analyst" }, loading: false, error: false });
    expect(fetchOrganization).toHaveBeenCalledTimes(2);
  });

  it("bản nhớ của tổ chức khác (đã đổi tổ chức) thì bỏ qua, coi như đang tải", () => {
    writeActiveOrgCache({ id: "org-cu", name: "Nhóm cũ", role: "lead" });
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    vi.mocked(fetchOrganization).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useActiveOrganizationState());
    expect(result.current).toEqual({ org: null, loading: true, error: false });
  });

  it("BE lỗi mà còn bản nhớ ⇒ giữ bản nhớ, không báo lỗi", async () => {
    writeActiveOrgCache({ id: "org-1", name: "Nhóm A", role: "lead" });
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    vi.mocked(fetchOrganization).mockRejectedValue(new Error("mất mạng"));
    const { result } = renderHook(() => useActiveOrganizationState());
    await waitFor(() => expect(fetchOrganization).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toEqual({ org: { id: "org-1", name: "Nhóm A", role: "lead" }, loading: false, error: false }));
  });

  it("nhiều chỗ dùng cùng lúc (thanh bên, menu, trang) ⇒ chỉ một request", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    vi.mocked(fetchOrganization).mockResolvedValue(DETAIL);
    const { result } = renderHook(() => [useActiveOrganizationState(), useActiveOrganizationState(), useActiveOrganization()] as const);
    await waitFor(() => expect(result.current[2]?.name).toBe("Nhóm A"));
    expect(result.current[0].org).toBe(result.current[1].org);
    expect(fetchOrganization).toHaveBeenCalledTimes(1);
  });
});

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

describe("useActiveOrganizationState", () => {
  it("có orgId trong token ⇒ ban đầu loading: true, tải xong ⇒ trả org và loading: false", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    let resolveOrg!: (value: Awaited<ReturnType<typeof fetchOrganization>>) => void;
    vi.mocked(fetchOrganization).mockReturnValue(
      new Promise((resolve) => {
        resolveOrg = resolve;
      })
    );
    const { result } = renderHook(() => useActiveOrganizationState());
    expect(result.current).toEqual({ org: null, loading: true, error: false });

    await act(async () => {
      resolveOrg({
        id: "org-1",
        name: "Nhóm A",
        role: "analyst",
        joinedAt: "2026-10-01T00:00:00Z",
        memberCount: 2,
      });
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        org: { id: "org-1", name: "Nhóm A", role: "analyst" },
        loading: false,
        error: false,
      })
    );
  });

  it("fetchOrganization lỗi ⇒ settled về org: null, loading: false, error: true (fail closed)", async () => {
    vi.mocked(getActiveOrgId).mockReturnValue("org-1");
    vi.mocked(fetchOrganization).mockRejectedValue(new Error("mất mạng"));
    const { result } = renderHook(() => useActiveOrganizationState());
    expect(result.current).toEqual({ org: null, loading: true, error: false });
    await waitFor(() => expect(result.current).toEqual({ org: null, loading: false, error: true }));
  });

  it("chưa có orgId trong token ⇒ trả ngay org: null, loading: false, error: false và không gọi BE", () => {
    vi.mocked(getActiveOrgId).mockReturnValue(null);
    const { result } = renderHook(() => useActiveOrganizationState());
    expect(result.current).toEqual({ org: null, loading: false, error: false });
    expect(fetchOrganization).not.toHaveBeenCalled();
  });
});
