import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBalance } from "@/lib/api/billing";
import { listProjectsPage } from "@/lib/api/projects";
import { useProjectQuota } from "./use-project-quota";

vi.mock("@/lib/api/billing", () => ({ fetchBalance: vi.fn() }));
vi.mock("@/lib/api/projects", () => ({ listProjectsPage: vi.fn() }));

const page = (total: number) => ({ items: [], meta: { page: 1, limit: 1, total, totalPages: total } }) as never;

beforeEach(() => {
  vi.mocked(fetchBalance).mockReset().mockResolvedValue({ planLabel: "Free", planLimits: { maxProjects: 3, maxMembers: 3, monthlyCredits: 0 } } as never);
  vi.mocked(listProjectsPage).mockReset().mockResolvedValue(page(2));
});

describe("useProjectQuota (UC-16)", () => {
  it("trần từ planLimits của /billing/balance, số đã dùng = tổng dự án đang làm", async () => {
    const { result } = renderHook(() => useProjectQuota());
    await waitFor(() => expect(result.current.quota).toEqual({ used: 2, max: 3, planLabel: "Free" }));
    expect(listProjectsPage).toHaveBeenCalledWith({ page: 1, limit: 1, status: "active" });
  });

  it("BE cũ chưa có planLimits hoặc gọi lỗi ⇒ null (hộp vẫn cho bấm, BE vẫn chặn)", async () => {
    vi.mocked(fetchBalance).mockResolvedValueOnce({ planLabel: "Free" } as never);
    const first = renderHook(() => useProjectQuota());
    await waitFor(() => expect(fetchBalance).toHaveBeenCalled());
    expect(first.result.current.quota).toBeNull();

    vi.mocked(listProjectsPage).mockRejectedValueOnce(new Error("offline"));
    const second = renderHook(() => useProjectQuota());
    await waitFor(() => expect(listProjectsPage).toHaveBeenCalledTimes(2));
    expect(second.result.current.quota).toBeNull();
  });

  it("reload đọc lại số dự án", async () => {
    const { result } = renderHook(() => useProjectQuota());
    await waitFor(() => expect(result.current.quota?.used).toBe(2));
    vi.mocked(listProjectsPage).mockResolvedValue(page(3));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.quota?.used).toBe(3));
  });
});
