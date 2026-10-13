"use client";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import RejectBaselineModal from "./RejectBaselineModal";
import type { Comment } from "@/types/comment";

const comment = (id: string): Comment => ({
  comment_id: id,
  version: { source: "draft", baseline_id: null, label: "draft" },
  anchor: { section_id: "fixed:2.1", block_index: null, label: "2.1 Actors", excerpt: null },
  author: { _id: "u1", name: "Lead", email: null },
  author_role: "lead",
  text: `Góp ý ${id}`,
  status: "open",
  cr_id: null,
  handled_by: null,
  handled_at: null,
  resolution: null,
  replies: [],
  created_at: "2026-10-13T10:00:00.000Z",
});

const props = {
  open: true,
  onClose: vi.fn(),
  busy: false,
  onReject: vi.fn(async () => {}),
  onOpenComments: vi.fn(),
};

describe("RejectBaselineModal", () => {
  it("chưa ghim góp ý nào ⇒ không cho từ chối, chỉ đường đi ghim", () => {
    renderWithIntl(<RejectBaselineModal {...props} openComments={[]} />);
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
    // Modal render qua portal ra body ⇒ đọc body, không đọc container của render root
    expect(document.body.textContent).toContain("Từ chối phải kèm góp ý");
    expect(screen.getByRole("button", { name: "Mở Góp ý" })).toBeInTheDocument();
  });

  it("có góp ý nhưng chưa chọn / chưa nhập lý do ⇒ nút Từ chối tắt", async () => {
    renderWithIntl(<RejectBaselineModal {...props} openComments={[comment("CM-001")]} />);
    const send = screen.getByRole("button", { name: "Từ chối" });
    expect(send).toBeDisabled();

    // Chỉ có lý do, chưa chọn góp ý ⇒ vẫn tắt (business-flow §3.5 đòi cả hai)
    fireEvent.change(screen.getByLabelText("Lý do từ chối"), { target: { value: "Thiếu luồng huỷ" } });
    expect(send).toBeDisabled();
  });

  it("đủ lý do và ít nhất một góp ý ⇒ gửi đúng mã đã chọn", async () => {
    const onReject = vi.fn(async () => {});
    renderWithIntl(<RejectBaselineModal {...props} onReject={onReject} openComments={[comment("CM-001"), comment("CM-002")]} />);

    fireEvent.change(screen.getByLabelText("Lý do từ chối"), { target: { value: "Thiếu luồng huỷ" } });
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Từ chối" }));

    await waitFor(() => expect(onReject).toHaveBeenCalledWith("Thiếu luồng huỷ", ["CM-002"]));
  });

  it("nói trước hệ quả: xử lý góp ý sẽ mở lại bước đã duyệt", () => {
    renderWithIntl(<RejectBaselineModal {...props} openComments={[comment("CM-001")]} />);
    expect(document.body.textContent).toContain("bước đã duyệt sở hữu mục đó sẽ mở lại");
  });
});
