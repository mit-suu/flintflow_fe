"use client";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import CommentsPanel from "./CommentsPanel";
import type { Comment } from "@/types/comment";

const comment = (id: string, over: Partial<Comment> = {}): Comment => ({
  comment_id: id,
  version: { source: "draft", baseline_id: null, label: "draft" },
  anchor: { section_id: "fixed:2.1", block_index: null, label: "2.1 Actors", excerpt: "Founder manages…" },
  author: { _id: "u1", name: "Quỳnh", email: null },
  author_role: "lead",
  text: `Góp ý ${id}`,
  status: "open",
  cr_id: null,
  handled_by: null,
  handled_at: null,
  resolution: null,
  replies: [],
  created_at: "2026-10-13T10:00:00.000Z",
  ...over,
});

const props = {
  comments: [] as Comment[],
  loading: false,
  error: null as string | null,
  busy: false,
  canResolve: true,
  pendingAnchor: null,
  onCancelPending: vi.fn(),
  onSubmit: vi.fn(async () => {}),
  onResolve: vi.fn(async () => {}),
  onClose: vi.fn(),
};

describe("CommentsPanel", () => {
  it("chưa có góp ý ⇒ hiện trạng thái rỗng kèm cách ghim", () => {
    const { container } = renderWithIntl(<CommentsPanel {...props} />);
    expect(container.textContent).toContain("Chưa có góp ý nào đang mở");
    expect(container.textContent).toContain("Bấm “Góp ý” trên một mục");
  });

  it("mặc định chỉ hiện góp ý đang mở; chuyển sang Tất cả thì thấy cả đã xử lý", async () => {
    const { container } = renderWithIntl(
      <CommentsPanel {...props} comments={[comment("CM-001"), comment("CM-002", { status: "resolved" })]} />
    );
    expect(container.textContent).toContain("Góp ý CM-001");
    expect(container.textContent).not.toContain("Góp ý CM-002");

    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    expect(container.textContent).toContain("Góp ý CM-002");
    expect(container.textContent).toContain("Đã xử lý");
  });

  it("không có quyền ⇒ không có nút xử lý góp ý", () => {
    renderWithIntl(<CommentsPanel {...props} canResolve={false} comments={[comment("CM-001")]} />);
    expect(screen.queryByRole("button", { name: "Đã sửa" })).not.toBeInTheDocument();
  });

  it("Đã xử lý gọi đúng mã góp ý", async () => {
    const onResolve = vi.fn(async () => {});
    renderWithIntl(<CommentsPanel {...props} onResolve={onResolve} comments={[comment("CM-001")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Đã sửa" }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith("CM-001", { kind: "fixed" }));
  });

  it("Giữ nguyên bắt nhập lý do mới cho lưu, và gửi đúng nhánh kept", async () => {
    const onResolve = vi.fn(async () => {});
    renderWithIntl(<CommentsPanel {...props} onResolve={onResolve} comments={[comment("CM-001")]} />);

    fireEvent.click(screen.getByRole("button", { name: "Giữ nguyên" }));
    // Lý do là thứ duy nhất Lead có để hiểu vì sao không sửa ⇒ quá ngắn thì không lưu được
    fireEvent.change(screen.getByLabelText("Vì sao giữ nguyên?"), { target: { value: "ok" } });
    expect(screen.getByRole("button", { name: "Lưu lý do" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Vì sao giữ nguyên?"), {
      target: { value: "  Khách đã xác nhận giữ cách gọi này.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu lý do" }));
    await waitFor(() =>
      expect(onResolve).toHaveBeenCalledWith("CM-001", { kind: "kept", reason: "Khách đã xác nhận giữ cách gọi này." })
    );
  });

  it("đã xử lý rồi ⇒ hiện kết luận để Lead đọc khi duyệt lại", async () => {
    const { container } = renderWithIntl(
      <CommentsPanel
        {...props}
        comments={[comment("CM-001", { status: "resolved", resolution: { kind: "kept", reason: "Khách chốt giữ nguyên." } })]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    expect(container.textContent).toContain("Giữ nguyên — Khách chốt giữ nguyên.");
  });

  it("góp ý đã thành CR ⇒ hiện mã CR, không có nút xử lý góp ý", async () => {
    const { container } = renderWithIntl(
      <CommentsPanel {...props} comments={[comment("CM-001", { status: "converted", cr_id: "CR-012" })]} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Tất cả" }));
    expect(container.textContent).toContain("CR-012");
    expect(screen.queryByRole("button", { name: "Đã sửa" })).not.toBeInTheDocument();
  });

  it("lọc theo góp ý của lượt từ chối ⇒ chỉ hiện đúng các mã đó, kể cả đã xử lý", () => {
    const { container } = renderWithIntl(
      <CommentsPanel
        {...props}
        comments={[comment("CM-001"), comment("CM-002", { status: "resolved" }), comment("CM-003")]}
        focusCommentIds={["CM-001", "CM-002"]}
      />
    );
    expect(container.textContent).toContain("Góp ý của lượt Lead từ chối baseline");
    expect(container.textContent).toContain("Góp ý CM-001");
    expect(container.textContent).toContain("Góp ý CM-002");
    expect(container.textContent).not.toContain("Góp ý CM-003");
  });

  it("đang ghim một chỗ ⇒ mở ô soạn, gửi đúng nội dung đã gõ", async () => {
    const onSubmit = vi.fn(async () => {});
    renderWithIntl(
      <CommentsPanel {...props} onSubmit={onSubmit} pendingAnchor={{ sectionId: "fixed:2.1", label: "2.1 Actors" }} />
    );
    expect(screen.getByRole("button", { name: "Ghim góp ý" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nội dung góp ý"), { target: { value: "  Cần nói rõ ai huỷ  " } });
    fireEvent.click(screen.getByRole("button", { name: "Ghim góp ý" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Cần nói rõ ai huỷ"));
  });
});
