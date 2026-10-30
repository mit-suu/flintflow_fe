import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { libraryMatches } from "@/lib/api/org-library";
import type { LibraryMatch } from "@/types/org-library";
import { useLibraryMatches } from "./useLibraryMatches";

vi.mock("@/lib/api/org-library", () => ({ libraryMatches: vi.fn() }));

const entry = { id: "E1", title: "Bảo mật", blocks: [{ kind: "paragraph", text: "Dữ liệu được mã hoá." }], updated_at: "2026-10-29T00:00:00.000Z" };
const MATCHES = [
  { custom_section_id: "CT_01", heading: "Bảo mật", empty: true, entry },
  { custom_section_id: "CT_02", heading: "Phụ lục", empty: false, entry: { ...entry, id: "E2", title: "Phụ lục" } },
] as LibraryMatch[];

beforeEach(() => {
  vi.mocked(libraryMatches).mockReset();
  vi.mocked(libraryMatches).mockResolvedValue(MATCHES);
});

describe("useLibraryMatches (FLF-278)", () => {
  it("tra theo id mục của tài liệu; nhóm mục còn trống riêng cho nút áp tất cả", async () => {
    const { result } = renderHook(() => useLibraryMatches("p1", true, 0));
    await waitFor(() => expect(result.current.matches).toHaveLength(2));
    expect(libraryMatches).toHaveBeenCalledWith("p1");
    expect(result.current.matchOf("custom:CT_01")?.entry.id).toBe("E1");
    expect(result.current.matchOf("CT_01")).toBeUndefined();
    expect(result.current.emptyMatches.map((m) => m.custom_section_id)).toEqual(["CT_01"]);
  });

  it("không phải dự án mẫu bắt buộc ⇒ không gọi BE, không gợi ý", () => {
    const { result } = renderHook(() => useLibraryMatches("p1", false, 0));
    expect(libraryMatches).not.toHaveBeenCalled();
    expect(result.current.matches).toEqual([]);
    expect(result.current.emptyMatches).toEqual([]);
  });

  it("tải lại khi tài liệu đổi hoặc gọi reload; lỗi tải ⇒ không gợi ý", async () => {
    const { result, rerender } = renderHook(({ token }) => useLibraryMatches("p1", true, token), { initialProps: { token: 0 } });
    await waitFor(() => expect(result.current.matches).toHaveLength(2));

    vi.mocked(libraryMatches).mockRejectedValue(new Error("down"));
    rerender({ token: 1 });
    await waitFor(() => expect(result.current.matches).toEqual([]));

    vi.mocked(libraryMatches).mockResolvedValue(MATCHES.slice(0, 1));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    expect(libraryMatches).toHaveBeenCalledTimes(3);
  });
});
