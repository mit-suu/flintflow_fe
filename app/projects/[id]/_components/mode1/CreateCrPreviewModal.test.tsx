/**
 * Mode 1 v3 (BPMN 3.1): diff của bản xem trước có nút **Tạo CR** thay "Xác nhận" — tạo change request kèm `preview_id` (cùng
 * đường với nút trên thẻ chat), không áp thẳng vào tài liệu. Trước đây nút này chỉ điền lại câu lệnh vào ô chat, không đóng
 * hộp, không tạo CR ⇒ người dùng gửi lại và bị hỏi xác nhận mãi.
 */
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import type { PreviewResult } from "@/types/pipeline";
import CreateCrPreviewModal from "./CreateCrPreviewModal";

const preview = (over: Partial<PreviewResult> = {}): PreviewResult => ({
  ok: true,
  txn: "t1",
  base_version: 3,
  ops: [{ op: "set", path: "actors[id=A03].name", value: "Administrator" } as never],
  changes: [],
  violations: [],
  referrers: [],
  preview_id: "pv-1",
  ...over,
});

describe("CreateCrPreviewModal", () => {
  it("nút Tạo CR (không có Xác nhận) ⇒ tạo CR kèm preview_id", () => {
    const onCreate = vi.fn();
    renderWithIntl(<CreateCrPreviewModal preview={preview()} onCancel={vi.fn()} onCreate={onCreate} />);
    expect(screen.queryByRole("button", { name: "Xác nhận" })).not.toBeInTheDocument();
    expect(screen.getByText(/Tài liệu chỉ đổi khi CR được duyệt/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tạo CR" }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("pv-1");
  });

  it("bản xem trước lỗi (AI dựng op sai) ⇒ vẫn tạo CR từ câu lệnh, không kèm preview_id", () => {
    const onCreate = vi.fn();
    renderWithIntl(
      <CreateCrPreviewModal
        preview={preview({ ok: false, preview_id: undefined, violations: [{ rule: "path_invalid", message: "Selector không hợp lệ" } as never] })}
        onCancel={vi.fn()}
        onCreate={onCreate}
      />
    );
    expect(screen.getByText(/Bản xem trước lỗi - vẫn tạo được change request/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tạo CR (không kèm bản xem trước)" }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("Esc đóng hộp kể cả khi focus chưa vào trong hộp", () => {
    const onCancel = vi.fn();
    renderWithIntl(<CreateCrPreviewModal preview={preview()} onCancel={onCancel} onCreate={vi.fn()} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("op sổ sách của hệ thống (cờ, bước quy trình) không hiện mã nội bộ ở bảng lẫn dòng \"Đang được nhắc tới\"", () => {
    renderWithIntl(
      <CreateCrPreviewModal
        preview={preview({
          changes: [
            { op: "set", path: "actors[id=A03].name", before: "Admin", value: "Administrator" },
            { op: "remove", path: "flags[id=FL005]", before: {}, value: undefined },
            { op: "remove", path: "steps[id=S-5.1@SCR-06]", before: {}, value: undefined },
          ] as never,
          impact: { sections: [], diagrams: [], referrers: [{ path: "steps[id=S-5.2@SCR-06]" }] } as never,
        })}
        onCancel={vi.fn()}
        onCreate={vi.fn()}
      />
    );
    expect(screen.queryByText(/flags\[id=|steps\[id=/)).not.toBeInTheDocument();
    expect(screen.getByText("Gỡ 1 cảnh báo liên quan.")).toBeInTheDocument();
  });
});
