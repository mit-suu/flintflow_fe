import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CommentPanel, { type CommentTab } from "./CommentPanel";
import { readCrPrefill } from "./mode1/prefill";
import type { SrsComment } from "@/types/comment";
import type { OrgRole } from "@/types/organization";

const comment = (over: Partial<SrsComment> = {}): SrsComment => ({
  comment_id: "CM-001",
  version: { source: "baseline", baseline_id: "650000000000000000000001", label: "1.0" },
  anchor: { section_id: "feature:F2", block_index: 0, label: "3.2.4 Cancel booking › Block 1", excerpt: "The customer cancels a booking." },
  author: { _id: "u1", name: "Viewer Lan", email: "lan@example.com" },
  author_role: "viewer",
  text: "Cần nói rõ ai được huỷ.",
  status: "open",
  cr_id: null,
  handled_by: null,
  handled_at: null,
  replies: [],
  created_at: "2026-10-08T03:00:00.000Z",
  ...over,
});

const renderPanel = (props: { role: OrgRole | null; comments?: SrsComment[]; canCreateCr?: boolean; anchorExists?: boolean; blocked?: string | null; tab?: CommentTab }) => {
  const onResolve = vi.fn(async () => {});
  const onTabChange = vi.fn();
  render(
    <CommentPanel
      projectId="p1"
      comments={props.comments ?? [comment()]}
      role={props.role}
      canCreateCr={props.canCreateCr ?? true}
      commentBlockedReason={props.blocked ?? null}
      versionLabel="1.0"
      anchorExists={() => props.anchorExists ?? true}
      target={null}
      focus={null}
      highlightId={null}
      tab={props.tab ?? "open"}
      onTabChange={onTabChange}
      onClearFocus={() => {}}
      onCancelTarget={() => {}}
      onPost={async () => {}}
      onReply={async () => {}}
      onResolve={onResolve}
    />
  );
  return { onResolve, onTabChange, card: screen.queryAllByRole("listitem")[0] };
};

describe("CommentPanel (UC-49)", () => {
  it("Viewer chỉ thấy Trả lời — không Resolve, không Tạo CR", () => {
    const { card } = renderPanel({ role: "viewer" });
    expect(within(card).getByRole("button", { name: "Trả lời" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Đánh dấu đã xử lý" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: "Tạo CR từ comment" })).not.toBeInTheDocument();
  });

  it("Analyst: Resolve gọi onResolve; Tạo CR mở form điền sẵn nguồn Viewer comment, người yêu cầu = tác giả, comment_id", () => {
    const { card, onResolve } = renderPanel({ role: "analyst" });
    fireEvent.click(within(card).getByRole("button", { name: "Đánh dấu đã xử lý" }));
    expect(onResolve).toHaveBeenCalledWith("CM-001");

    const href = within(card).getByRole("link", { name: "Tạo CR từ comment" }).getAttribute("href")!;
    expect(href.startsWith("/projects/p1?")).toBe(true);
    const prefill = readCrPrefill(new URL(href, "http://x").searchParams);
    expect(prefill).toMatchObject({
      source: "viewer_comment",
      ref: "CM-001",
      requester: "Viewer Lan",
      comment_id: "CM-001",
      title: "CM-001: 3.2.4 Cancel booking › Block 1",
    });
    expect(prefill?.description).toContain("Cần nói rõ ai được huỷ.");
    expect(prefill?.description).toContain("3.2.4 Cancel booking › Block 1 (bản 1.0)");
  });

  it("chưa có baseline / dự án không có luồng CR ⇒ Lead chỉ có Resolve", () => {
    const { card } = renderPanel({ role: "lead", canCreateCr: false });
    expect(within(card).getByRole("button", { name: "Đánh dấu đã xử lý" })).toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: "Tạo CR từ comment" })).not.toBeInTheDocument();
  });

  it("comment đã thành CR: badge mang mã CR, không còn nút xử lý; chỗ ghim mất ở bản này thì báo", () => {
    const { card } = renderPanel({ role: "lead", comments: [comment({ status: "converted", cr_id: "CR-005" })], anchorExists: false, tab: "closed" });
    expect(card.textContent).toContain("Đã thành CR-005");
    expect(card.textContent).toContain("Nội dung được ghim không còn trong phiên bản này.");
    expect(within(card).queryByRole("button", { name: "Đánh dấu đã xử lý" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: "Tạo CR từ comment" })).not.toBeInTheDocument();
  });

  it("hai tab Đang mở / Đã đóng có đếm số; mỗi tab chỉ hiện comment của nó", () => {
    const comments = [
      comment(),
      comment({ comment_id: "CM-002", status: "resolved" }),
      comment({ comment_id: "CM-003", status: "converted", cr_id: "CR-001" }),
    ];
    const { onTabChange } = renderPanel({ role: "lead", comments });
    expect(screen.getByRole("tab", { name: "Đang mở (1)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual(["Comment CM-001"]);

    fireEvent.click(screen.getByRole("tab", { name: "Đã đóng (2)" }));
    expect(onTabChange).toHaveBeenCalledWith("closed");
  });

  it("tab Đã đóng chỉ hiện comment đã xử lý / đã thành CR", () => {
    renderPanel({ role: "lead", comments: [comment(), comment({ comment_id: "CM-002", status: "resolved" })], tab: "closed" });
    expect(screen.getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual(["Comment CM-002"]);
  });

  it("không viết được ở bản đang đọc ⇒ hiện lý do", () => {
    renderPanel({ role: "viewer", blocked: "Viewer chỉ comment được trên phiên bản đã phát hành." });
    expect(screen.getByText("Viewer chỉ comment được trên phiên bản đã phát hành.")).toBeInTheDocument();
  });
});
