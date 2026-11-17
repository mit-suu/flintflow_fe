/**
 * BF §3.2 "Người khác mở chỗ đó thấy dòng *<ai> có bản sửa chưa xác nhận ở mục này*": sau baseline đọc CR chưa đóng,
 * trước baseline đọc bản xem trước sửa qua chat chưa áp của người khác (contract #8c).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePendingSections } from "./usePendingSections";

const api = vi.hoisted(() => ({ cr: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/api/change-requests", async (orig) => ({ ...(await orig<object>()), getPendingSections: api.cr }));
vi.mock("@/lib/api/spine", async (orig) => ({ ...(await orig<object>()), getPreviewPendingSections: api.preview }));

beforeEach(() => {
  api.cr.mockReset().mockResolvedValue({ data: [{ section_id: "fixed:1", title: "1 Overview", items: [{ cr_id: "CR-003", who: "Bình" }] }] });
  api.preview.mockReset().mockResolvedValue({ data: [{ section_id: "fixed:2.1", items: [{ who: "Bình" }] }] });
});

describe("usePendingSections", () => {
  it("sau baseline (cr) ⇒ đọc CR chưa đóng", async () => {
    const { result } = renderHook(() => usePendingSections("p1", true, 0, "cr"));
    await waitFor(() => expect(result.current.get("fixed:1")?.items).toEqual([{ cr_id: "CR-003", who: "Bình" }]));
    expect(api.preview).not.toHaveBeenCalled();
  });

  it("trước baseline (preview) ⇒ đọc bản xem trước chưa áp của người khác, item không có mã CR", async () => {
    const { result } = renderHook(() => usePendingSections("p1", true, 0, "preview"));
    await waitFor(() => expect(result.current.get("fixed:2.1")?.items).toEqual([{ who: "Bình" }]));
    expect(api.cr).not.toHaveBeenCalled();
  });
});
