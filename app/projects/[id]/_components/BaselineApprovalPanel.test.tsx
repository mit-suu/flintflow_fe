"use client";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import BaselineApprovalPanel from "./BaselineApprovalPanel";
import type { Comment } from "@/types/comment";
import type { BaselineSubmission } from "@/types/spine";
import type { BlockingFlag } from "./gate-helpers";

const comment = (id: string, status: Comment["status"] = "open"): Comment => ({
  comment_id: id,
  version: { source: "draft", baseline_id: null, label: "draft" },
  anchor: { section_id: "fixed:2.1", block_index: null, label: "2.1 Actors", excerpt: null },
  author: { _id: "u1", name: "Lead", email: null },
  author_role: "lead",
  text: "Mục này cần viết lại.",
  status,
  cr_id: null,
  handled_by: null,
  handled_at: null,
  resolution: null,
  replies: [],
  created_at: "2026-10-13T10:00:00.000Z",
});

const submission = (over: Partial<BaselineSubmission> = {}): BaselineSubmission => ({
  status: "pending",
  submitted_by: "u2",
  submitted_at: "2026-10-13T10:00:00.000Z",
  spine_version: 7,
  decided_by: null,
  decided_at: null,
  reason: null,
  rejection_comment_ids: [],
  ...over,
});

const props = {
  submission: null as BaselineSubmission | null,
  blocking: 0,
  blockingFlags: [] as BlockingFlag[],
  comments: [] as Comment[],
  busy: false,
  error: null as string | null,
  onSubmit: vi.fn(async () => {}),
  onApprove: vi.fn(async () => {}),
  onReject: vi.fn(async () => {}),
  onOpenComments: vi.fn(),
};

describe("BaselineApprovalPanel", () => {
  it("Viewer không thấy khối chốt baseline", () => {
    const { container } = renderWithIntl(<BaselineApprovalPanel {...props} role="viewer" />);
    expect(container.textContent).not.toContain("Chốt baseline");
  });

  it("Analyst, chưa nộp ⇒ nút Gửi Lead duyệt", () => {
    renderWithIntl(<BaselineApprovalPanel {...props} role="analyst" />);
    expect(screen.getByRole("button", { name: "Gửi Lead duyệt" })).toBeEnabled();
  });

  it("bị chặn ⇒ liệt kê đúng cờ đang chặn và bước phải chạy lại, không nói chung chung", () => {
    const { container } = renderWithIntl(
      <BaselineApprovalPanel
        {...props}
        role="analyst"
        error="Còn cờ đỏ chưa xử lý — chưa thể ghi baseline."
        blockingFlags={[{ id: "F-1", message: "Nội dung §2.1 Actors đang chờ duyệt lại", remediation_step: "S-2.1" }]}
      />
    );
    expect(container.textContent).toContain("Nội dung §2.1 Actors đang chờ duyệt lại");
    expect(container.textContent).toContain("Xử lý ở bước S-2.1");
  });

  it("còn vấn đề chặn ⇒ nút tắt và nói rõ số vấn đề", () => {
    const { container } = renderWithIntl(<BaselineApprovalPanel {...props} role="analyst" blocking={3} />);
    expect(screen.getByRole("button", { name: "Gửi Lead duyệt" })).toBeDisabled();
    expect(container.textContent).toContain("Còn 3 vấn đề cần xử lý trước khi chốt");
  });

  it("Analyst, đang chờ duyệt ⇒ chỉ báo trạng thái, không có nút", () => {
    const { container } = renderWithIntl(<BaselineApprovalPanel {...props} role="analyst" submission={submission()} />);
    expect(container.textContent).toContain("Đã gửi Lead duyệt");
    expect(screen.queryByRole("button", { name: "Gửi Lead duyệt" })).not.toBeInTheDocument();
  });

  it("Lead, đang chờ duyệt ⇒ có Duyệt và Từ chối", () => {
    renderWithIntl(<BaselineApprovalPanel {...props} role="lead" submission={submission()} />);
    expect(screen.getByRole("button", { name: "Duyệt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Từ chối" })).toBeInTheDocument();
  });

  it("Lead, chưa ai nộp ⇒ tự duyệt bằng nút Chốt baseline, nhưng phải xác nhận trước", async () => {
    const onApprove = vi.fn(async () => {});
    renderWithIntl(<BaselineApprovalPanel {...props} role="lead" onApprove={onApprove} />);

    // Ký baseline không thu hồi được ⇒ bấm một nhát chưa được ký ngay
    fireEvent.click(screen.getByRole("button", { name: "Chốt baseline" }));
    expect(onApprove).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("khoá vĩnh viễn");

    fireEvent.click(screen.getByRole("button", { name: "Chốt và khoá" }));
    await waitFor(() => expect(onApprove).toHaveBeenCalled());
  });

  it("huỷ ở hộp xác nhận ⇒ không ký", () => {
    const onApprove = vi.fn(async () => {});
    renderWithIntl(<BaselineApprovalPanel {...props} role="lead" onApprove={onApprove} />);
    fireEvent.click(screen.getByRole("button", { name: "Chốt baseline" }));
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("duyệt bản người khác nộp ⇒ hộp xác nhận nói đúng việc đang làm", () => {
    renderWithIntl(<BaselineApprovalPanel {...props} role="lead" submission={submission()} />);
    fireEvent.click(screen.getByRole("button", { name: "Duyệt" }));
    expect(screen.getByRole("button", { name: "Duyệt và khoá" })).toBeInTheDocument();
  });

  it("bị từ chối ⇒ hiện lý do và số góp ý đã xử lý, Analyst gửi lại được", async () => {
    const onSubmit = vi.fn(async () => {});
    const { container } = renderWithIntl(
      <BaselineApprovalPanel
        {...props}
        role="analyst"
        onSubmit={onSubmit}
        comments={[comment("CM-001"), comment("CM-002", "resolved")]}
        submission={submission({ status: "rejected", reason: "Thiếu luồng huỷ", rejection_comment_ids: ["CM-001", "CM-002"] })}
      />
    );
    expect(container.textContent).toContain("Thiếu luồng huỷ");
    expect(container.textContent).toContain("1/2 góp ý đã xử lý");
    fireEvent.click(screen.getByRole("button", { name: "Gửi lại" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

});
