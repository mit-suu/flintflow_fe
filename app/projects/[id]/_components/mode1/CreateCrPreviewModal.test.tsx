/**
 * Mode 1 v3 (BPMN 3.1): diff của panel "Sửa tài liệu có xem trước" có nút **Tạo CR** thay "Xác nhận" — điền sẵn lệnh +
 * `preview_id` vào khung chat của trang đang mở (nguồn gợi ý yêu cầu miệng), không áp thẳng vào tài liệu.
 *
 * FLF-480 (B12): trước đây `router.push` về chính trang đang mở nên trang không mount lại, hộp không đóng, form
 * không mở — sửa thành gọi `onCreate(draft)` do page truyền xuống.
 */
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  it("nút Tạo CR (không có Xác nhận) ⇒ gọi onCreate với câu lệnh + preview_id, nguồn yêu cầu miệng", () => {
    const onCreate = vi.fn();
    renderWithIntl(
      <CreateCrPreviewModal
        preview={preview()}
        instruction={"Đổi tên actor A03 thành Administrator\nvì khách yêu cầu"}
        onCancel={vi.fn()}
        onCreate={onCreate}
      />
    );
    expect(screen.queryByRole("button", { name: "Xác nhận" })).not.toBeInTheDocument();
    expect(screen.getByText(/Tài liệu chỉ đổi khi CR được duyệt/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tạo CR" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      text: "Đổi tên actor A03 thành Administrator\nĐổi tên actor A03 thành Administrator\nvì khách yêu cầu",
      source: "verbal",
      preview_id: "pv-1",
    });
  });

  it("bản xem trước lỗi (AI dựng op sai) ⇒ vẫn gọi onCreate với câu lệnh, không kèm preview_id", () => {
    const onCreate = vi.fn();
    renderWithIntl(
      <CreateCrPreviewModal
        preview={preview({ ok: false, preview_id: undefined, violations: [{ rule: "path_invalid", message: "Selector không hợp lệ" } as never] })}
        instruction="Đổi tầm nhìn sản phẩm"
        onCancel={vi.fn()}
        onCreate={onCreate}
      />
    );
    expect(screen.getByText(/Bản xem trước lỗi - vẫn tạo được change request/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tạo CR (không kèm bản xem trước)" }));
    expect(onCreate).toHaveBeenCalledWith({ text: "Đổi tầm nhìn sản phẩm", source: "verbal", preview_id: undefined });
  });
});
