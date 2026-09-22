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

  it("bản xem trước lỗi / không có preview_id ⇒ nút Tạo CR bị khoá", () => {
    renderWithIntl(<CreateCrPreviewModal projectId="p1" preview={preview({ preview_id: undefined })} instruction="x" onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tạo CR" })).toBeDisabled();
  });
});
