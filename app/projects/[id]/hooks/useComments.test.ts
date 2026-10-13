import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listComments = vi.fn();
const createComment = vi.fn();
const resolveComment = vi.fn();

vi.mock("@/lib/api/comments", () => ({
  listComments: (...args: unknown[]) => listComments(...args),
  createComment: (...args: unknown[]) => createComment(...args),
  resolveComment: (...args: unknown[]) => resolveComment(...args),
}));

import { useComments } from "./useComments";
import type { Comment } from "@/types/comment";

const comment = (id: string, sectionId = "fixed:2.1", status: Comment["status"] = "open"): Comment => ({
  comment_id: id,
  version: { source: "draft", baseline_id: null, label: "draft" },
  anchor: { section_id: sectionId, block_index: null, label: "2.1 Actors", excerpt: null },
  author: null,
  author_role: "lead",
  text: `Góp ý ${id}`,
  status,
  cr_id: null,
  handled_by: null,
  handled_at: null,
  resolution: null,
  replies: [],
  created_at: "2026-10-13T10:00:00.000Z",
});

beforeEach(() => {
  listComments.mockReset().mockResolvedValue({ data: [] });
  createComment.mockReset();
  resolveComment.mockReset();
});

describe("useComments", () => {
  it("tải danh sách khi có spine_version, đếm góp ý đang mở theo mục", async () => {
    listComments.mockResolvedValue({
      data: [comment("CM-001"), comment("CM-002"), comment("CM-003", "fixed:3.1"), comment("CM-004", "fixed:2.1", "resolved")],
    });
    const { result } = renderHook(() => useComments("p1", 7));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // `status=all` để panel lọc tại chỗ, khỏi gọi lại BE mỗi lần đổi tab
    expect(listComments).toHaveBeenCalledWith("p1", "all");
    expect(result.current.comments).toHaveLength(4);
    // Đã xử lý không tính vào chấm số trên tài liệu
    expect(result.current.openCountBySection.get("fixed:2.1")).toBe(2);
    expect(result.current.openCountBySection.get("fixed:3.1")).toBe(1);
  });

  it("chưa có spine_version ⇒ chưa gọi BE", () => {
    renderHook(() => useComments("p1", null));
    expect(listComments).not.toHaveBeenCalled();
  });

  it("ghim góp ý mới ⇒ thêm vào danh sách tại chỗ", async () => {
    const created = comment("CM-009", "fixed:4.1");
    createComment.mockResolvedValue({ data: created });
    const { result } = renderHook(() => useComments("p1", 7));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.create({ version: { source: "draft" }, anchor: { section_id: "fixed:4.1" }, text: "Xem lại" });
    });
    expect(result.current.comments.map((c) => c.comment_id)).toContain("CM-009");
    expect(result.current.openCountBySection.get("fixed:4.1")).toBe(1);
  });

  it("đánh dấu đã xử lý ⇒ thay bản ghi cũ bằng bản BE trả", async () => {
    listComments.mockResolvedValue({ data: [comment("CM-001")] });
    resolveComment.mockResolvedValue({ data: comment("CM-001", "fixed:2.1", "resolved") });
    const { result } = renderHook(() => useComments("p1", 7));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resolve("CM-001", { kind: "fixed" });
    });
    expect(result.current.comments[0].status).toBe("resolved");
    expect(result.current.openCountBySection.size).toBe(0);
  });

  it("ghim thất bại (chỗ ghim không còn) ⇒ báo lỗi, đọc lại danh sách, không nuốt lỗi", async () => {
    createComment.mockRejectedValue(new Error("COMMENT_ANCHOR_NOT_FOUND"));
    const { result } = renderHook(() => useComments("p1", 7));
    await waitFor(() => expect(result.current.loading).toBe(false));
    listComments.mockClear();

    await act(async () => {
      await expect(
        result.current.create({ version: { source: "draft" }, anchor: { section_id: "fixed:9.9" }, text: "Xem lại" })
      ).rejects.toThrow();
    });
    expect(result.current.error).not.toBeNull();
    expect(listComments).toHaveBeenCalled();
  });
});
