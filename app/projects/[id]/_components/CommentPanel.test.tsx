import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl as render } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import CommentPanel, { type CommentTab } from "./CommentPanel";
import { readChatCrDraft } from "./mode1/prefill";
import type { SrsComment } from "@/types/comment";
import type { OrgRole } from "@/types/organization";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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
  resolution: null,
  replies: [],
  created_at: "2026-10-08T03:00:00.000Z",
  ...over,
});

const renderPanel = (props: {
  role: OrgRole | null;
  comments?: SrsComment[];
  canCreateCr?: boolean;
  anchorExists?: boolean;
  blocked?: string | null;
  tab?: CommentTab;
}) => {
  const onResolve = vi.fn(async () => {});
  const onReply = vi.fn(async () => {});
  const onLocate = vi.fn();
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
      onReply={onReply}
      onResolve={onResolve}
      onLocate={onLocate}
    />
  );
  return { onResolve, onReply, onLocate, onTabChange, card: screen.queryAllByRole("listitem")[0] };
};

/** Mở menu ✓ (xử lý) của thẻ, trả về menu vừa mở. */
const openResolveMenu = (card: HTMLElement) => {
  fireEvent.click(within(card).getByRole("button", { name: "Xử lý comment" }));
  return screen.getByRole("menu");
};

describe("CommentPanel (UC-49)", () => {
  it("Viewer chỉ có ô trả lời - không nút xử lý, không menu thêm (Tạo CR)", () => {
    const { card } = renderPanel({ role: "viewer" });
    expect(within(card).getByRole("textbox", { name: "Trả lời…" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Xử lý comment" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Thêm thao tác" })).not.toBeInTheDocument();
  });

  it("ô trả lời: bấm vào mới hiện Gửi, gửi đúng comment rồi thu lại", async () => {
    const { card, onReply } = renderPanel({ role: "viewer" });
    const box = within(card).getByRole("textbox", { name: "Trả lời…" });
    expect(within(card).queryByRole("button", { name: "Gửi" })).not.toBeInTheDocument();
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "Đồng ý" } });
    fireEvent.click(within(card).getByRole("button", { name: "Gửi" }));
    expect(onReply).toHaveBeenCalledWith("CM-001", "Đồng ý");
    expect(await within(card).findByRole("textbox", { name: "Trả lời…" })).toHaveValue("");
  });

  it("Analyst: menu xử lý ⇒ Đã sửa gửi nhánh fixed; Giữ nguyên bắt lý do rồi gửi nhánh kept", async () => {
    const { card, onResolve } = renderPanel({ role: "analyst" });
    fireEvent.click(within(openResolveMenu(card)).getByRole("menuitem", { name: "Đã sửa" }));
    expect(onResolve).toHaveBeenCalledWith("CM-001", { kind: "fixed" });
    // Nút ✓ khoá trong lúc đang gửi; chờ lượt trước xong mới mở lại menu
    await waitFor(() => expect(within(card).getByRole("button", { name: "Xử lý comment" })).toBeEnabled());

    fireEvent.click(within(openResolveMenu(card)).getByRole("menuitem", { name: "Giữ nguyên…" }));
    const save = within(card).getByRole("button", { name: "Lưu lý do" });
    expect(save).toBeDisabled();
    fireEvent.change(within(card).getByLabelText("Vì sao giữ nguyên?"), { target: { value: "Khách chốt giữ nguyên." } });
    fireEvent.click(save);
    expect(onResolve).toHaveBeenLastCalledWith("CM-001", { kind: "kept", reason: "Khách chốt giữ nguyên." });
  });

  it("Tạo CR (menu ⋯) mở form điền sẵn nguồn Viewer comment, người yêu cầu = tác giả, comment_id", () => {
    push.mockClear();
    const { card } = renderPanel({ role: "analyst" });
    fireEvent.click(within(card).getByRole("button", { name: "Thêm thao tác" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Tạo CR từ comment" }));
    const href = push.mock.calls[0][0] as string;
    expect(href.startsWith("/projects/p1?")).toBe(true);
    const prefill = readChatCrDraft(new URL(href, "http://x").searchParams);
    expect(prefill).toMatchObject({
      source: "viewer_comment",
      ref: "CM-001",
      requester: "Viewer Lan",
      comment_id: "CM-001",
    });
    expect(prefill?.text.split("\n")[0]).toBe("CM-001: 3.2.4 Cancel booking › Block 1");
    expect(prefill?.text).toContain("Cần nói rõ ai được huỷ.");
    expect(prefill?.text).toContain("3.2.4 Cancel booking › Block 1 (bản 1.0)");
  });

  it("chưa có baseline / dự án không có luồng CR ⇒ Lead chỉ có nút xử lý, không có menu thêm", () => {
    const { card } = renderPanel({ role: "lead", canCreateCr: false });
    expect(within(card).getByRole("button", { name: "Xử lý comment" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Thêm thao tác" })).not.toBeInTheDocument();
  });

  it("comment đã thành CR: badge mang mã CR, không còn nút xử lý; chỗ ghim mất ở bản này thì báo", () => {
    const { card } = renderPanel({ role: "lead", comments: [comment({ status: "converted", cr_id: "CR-005" })], anchorExists: false, tab: "closed" });
    expect(card.textContent).toContain("Đã thành CR-005");
    expect(card.textContent).toContain("Nội dung được ghim không còn trong phiên bản này.");
    expect(within(card).queryByRole("button", { name: "Xử lý comment" })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Thêm thao tác" })).not.toBeInTheDocument();
  });

  it("bấm vào thẻ ⇒ cuộn tới chỗ ghim; bấm nút bên trong thẻ thì không", () => {
    const { card, onLocate } = renderPanel({ role: "lead", canCreateCr: false });
    fireEvent.click(within(card).getByText("Cần nói rõ ai được huỷ."));
    expect(onLocate).toHaveBeenCalledTimes(1);
    fireEvent.click(within(card).getByRole("button", { name: "Xử lý comment" }));
    expect(onLocate).toHaveBeenCalledTimes(1);
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
