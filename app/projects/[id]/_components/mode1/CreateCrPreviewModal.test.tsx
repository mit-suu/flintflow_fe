/**
 * Mode 1 v3 (BPMN 3.1): diff của panel "Sửa tài liệu có xem trước" có nút **Tạo CR** thay "Xác nhận" — mở form 3.1 điền
 * sẵn lệnh + `preview_id` (nguồn gợi ý yêu cầu miệng), không áp thẳng vào tài liệu.
 */
import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PreviewResult } from "@/types/pipeline";
import CreateCrPreviewModal from "./CreateCrPreviewModal";
import { readCrPrefill } from "./prefill";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

beforeEach(() => push.mockReset());

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
  it("nút Tạo CR (không có Xác nhận) ⇒ sang form 3.1 điền sẵn lệnh + preview_id, nguồn yêu cầu miệng", () => {
    renderWithIntl(<CreateCrPreviewModal projectId="p1" preview={preview()} instruction={"Đổi tên actor A03 thành Administrator\nvì khách yêu cầu"} onCancel={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Xác nhận" })).not.toBeInTheDocument();
    expect(screen.getByText(/Tài liệu chỉ đổi khi CR được duyệt/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tạo CR" }));
    expect(push).toHaveBeenCalledTimes(1);
    const href = push.mock.calls[0][0] as string;
    expect(href.startsWith("/projects/p1/change-requests?")).toBe(true);
    expect(readCrPrefill(new URLSearchParams(href.split("?")[1]))).toEqual({
      title: "Đổi tên actor A03 thành Administrator",
      description: "Đổi tên actor A03 thành Administrator\nvì khách yêu cầu",
      source: "verbal",
      ref: undefined,
      preview_id: "pv-1",
    });
  });

  it("bản xem trước lỗi (AI dựng op sai) ⇒ vẫn tạo CR từ câu lệnh, không kèm preview_id", () => {
    renderWithIntl(
      <CreateCrPreviewModal
        projectId="p1"
        preview={preview({ ok: false, preview_id: undefined, violations: [{ rule: "path_invalid", message: "Selector không hợp lệ" } as never] })}
        instruction="Đổi tầm nhìn sản phẩm"
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/Bản xem trước lỗi — vẫn tạo được change request/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tạo CR (không kèm bản xem trước)" }));
    const href = push.mock.calls[0][0] as string;
    expect(readCrPrefill(new URLSearchParams(href.split("?")[1]))).toMatchObject({ description: "Đổi tầm nhìn sản phẩm", source: "verbal", preview_id: undefined });
  });
});
