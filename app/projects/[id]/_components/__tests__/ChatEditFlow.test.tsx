import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChatEditCard from "../ChatEditCard";
import EditHistory from "../EditHistory";
import ChatInput from "../ChatInput";
import { describeChange, describeTarget } from "../describe-change";
import type { PreviewResult } from "@/types/pipeline";
import type { Change } from "@/types/spine";

vi.mock("../../../../../lib/api/chat", () => ({ estimateActionCost: vi.fn(() => Promise.resolve({ data: { cost: 3 } })) }));

const preview = (over: Partial<PreviewResult> = {}): PreviewResult => ({
  ok: true,
  txn: "t1",
  base_version: 10,
  ops: [],
  changes: [
    { op: "set", path: "actors[id=A03].name", before: "Admin", value: "Administrator", reason: null },
    { op: "add", path: "glossary[]", before: null, value: "SLA", reason: null },
  ],
  violations: [],
  referrers: [],
  preview_id: "pv1",
  impact: { fields: [], sections: [{ id: "fixed:2.1", relation: "owner" }], diagrams: [], referrers: [] },
  ...over,
});

const cardProps = {
  instruction: "Đổi tên actor A03 thành Administrator",
  previewing: false,
  applying: false,
  clarification: null,
  error: null,
  preview: null,
  applied: null,
  onShowDetail: vi.fn(),
  onApply: vi.fn(),
  onCancel: vi.fn(),
  onUndo: vi.fn(),
  onDismiss: vi.fn(),
};

describe("describe-change", () => {
  it("đổi path thô thành câu đọc được", () => {
    expect(describeTarget({ op: "set", path: "actors[id=A03].name", before: null, value: null })).toBe("Sửa Actor A03 · name");
    expect(describeChange({ op: "set", path: "actors[id=A03].name", before: "Admin", value: "Administrator" })).toBe(
      "Sửa Actor A03 · name: Admin → Administrator"
    );
    expect(describeChange({ op: "remove", path: "use_cases[id=UC04]", before: {}, value: null })).toBe("Xoá Use case UC04");
  });
});

describe("ChatEditCard", () => {
  it("đang xem trước ⇒ báo đang tìm, không có nút áp dụng", () => {
    render(<ChatEditCard {...cardProps} previewing />);
    expect(screen.getByText("Đang tìm những chỗ cần sửa…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Áp dụng" })).toBeNull();
  });

  it("có bản xem trước ⇒ tóm tắt số chỗ đổi + câu dễ đọc; Áp dụng / Xem chi tiết / Huỷ", () => {
    const onApply = vi.fn();
    const onShowDetail = vi.fn();
    render(<ChatEditCard {...cardProps} preview={preview()} onApply={onApply} onShowDetail={onShowDetail} />);

    expect(screen.getByText(/Sẽ thay đổi 2 chỗ · ảnh hưởng 1 mục/)).toBeInTheDocument();
    expect(screen.getByText(/Sửa Actor A03 · name: Admin → Administrator/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onShowDetail).toHaveBeenCalledTimes(1);
  });

  it("bản xem trước vi phạm ⇒ nói lý do, không cho áp dụng", () => {
    render(<ChatEditCard {...cardProps} preview={preview({ ok: false, violations: [{ rule: "dead_reference", message: "UC01 còn trỏ tới A03" }] })} />);
    expect(screen.getByText(/UC01 còn trỏ tới A03/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Áp dụng" })).toBeNull();
  });

  it("mode 1 ⇒ nút chính là Tạo change request", () => {
    render(<ChatEditCard {...cardProps} preview={preview()} requiresCr />);
    expect(screen.getByRole("button", { name: "Tạo change request" })).toBeInTheDocument();
  });

  it("đã áp dụng ⇒ báo số thay đổi + Hoàn tác", () => {
    const onUndo = vi.fn();
    render(<ChatEditCard {...cardProps} applied={{ instruction: "x", count: 3, version: 12 }} onUndo={onUndo} />);
    expect(screen.getByText("Đã áp dụng 3 thay đổi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("lệnh mơ hồ ⇒ hiện câu hỏi làm rõ", () => {
    render(<ChatEditCard {...cardProps} clarification="Bạn muốn đổi actor nào?" />);
    expect(screen.getByText("Bạn muốn đổi actor nào?")).toBeInTheDocument();
  });
});

describe("EditHistory", () => {
  it("tải khi mở; mới nhất trước; viết thành câu", () => {
    const onLoad = vi.fn();
    const change = (seq: number, path: string, step: string | null): Change => ({
      projectId: "p1",
      seq,
      txn: `t${seq}`,
      op: "set",
      path,
      before: "a",
      value: "b",
      reason: null,
      at: "2026-09-23T10:00:00.000Z",
      by: "u1",
      step_id: step,
    });
    render(<EditHistory history={[change(1, "actors[id=A01].name", "S-3.1"), change(2, "actors[id=A02].name", null)]} loading={false} onLoad={onLoad} />);

    expect(onLoad).toHaveBeenCalledTimes(1);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Sửa Actor A02");
    expect(items[0]).toHaveTextContent("lệnh sửa");
    expect(items[1]).toHaveTextContent("bước S-3.1");
  });
});

describe("ChatInput — chip Sửa tài liệu & thu gọn", () => {
  const inputProps = {
    inputMessage: "",
    setInputMessage: vi.fn(),
    onSendMessage: vi.fn(),
    sending: false,
    pendingAttachments: [],
    onSelectAttachment: vi.fn(),
    onRemoveAttachment: vi.fn(),
    actionType: "chat" as const,
  };

  it("chip bật/tắt chế độ sửa; bị khoá kèm lý do khi step đang chạy", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ChatInput {...inputProps} onToggleEditMode={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Sửa tài liệu" }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<ChatInput {...inputProps} onToggleEditMode={onToggle} editDisabledReason="Bước đang chạy" />);
    const chip = screen.getByRole("button", { name: "Sửa tài liệu" });
    expect(chip).toBeDisabled();
    expect(chip).toHaveAttribute("title", "Bước đang chạy");
  });

  it("thu gọn (có thẻ câu hỏi) ⇒ một dòng, không chip sửa, vẫn hiện số credit còn lại", () => {
    render(<ChatInput {...inputProps} compact creditBalance={812} onToggleEditMode={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Sửa tài liệu" })).toBeNull();
    expect(screen.getByText("812 credit")).toBeInTheDocument();
  });
});
