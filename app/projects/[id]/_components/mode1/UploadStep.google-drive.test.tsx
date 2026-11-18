/**
 * UploadStep + Google Drive: chỉ có lựa chọn Drive khi màn truyền `onGoogleImport` (import đầu, không phải tải lại); chọn file
 * ⇒ thẻ "Đã chọn" + Tiếp tục mới import, ✕ bỏ chọn.
 */
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { PickedGoogleFile } from "@/lib/google-picker";

const picked: PickedGoogleFile = { id: "doc-1", name: "SRS Bán Vé", mimeType: "application/vnd.google-apps.document" };

vi.mock("@/components/integrations/GoogleDrivePickButton", () => ({
  default: ({ onPicked }: { onPicked: (f: PickedGoogleFile) => void }) => (
    <button type="button" onClick={() => onPicked(picked)}>
      pick-from-drive
    </button>
  ),
}));

const { default: UploadStep } = await import("./UploadStep");

describe("UploadStep - chọn từ Google Drive", () => {
  it("không truyền onGoogleImport (màn tải lại) ⇒ không có nút Drive", () => {
    renderWithIntl(<UploadStep onUpload={vi.fn()} />);
    expect(screen.queryByText("pick-from-drive")).not.toBeInTheDocument();
  });

  it("chọn file ⇒ thẻ Đã chọn (Google Docs); Tiếp tục ⇒ onGoogleImport; ✕ ⇒ quay lại nút chọn", () => {
    const onGoogleImport = vi.fn();
    renderWithIntl(<UploadStep onUpload={vi.fn()} onGoogleImport={onGoogleImport} />);

    fireEvent.click(screen.getByText("pick-from-drive"));
    expect(screen.getByText("SRS Bán Vé")).toBeInTheDocument();
    expect(screen.getByText("(Google Docs)")).toBeInTheDocument();
    expect(onGoogleImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(onGoogleImport).toHaveBeenCalledWith(picked);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ file đã chọn" }));
    expect(screen.getByText("pick-from-drive")).toBeInTheDocument();
  });

  it("đang import (busy) ⇒ không bấm lại được Tiếp tục / ✕", () => {
    const { rerender } = renderWithIntl(<UploadStep onUpload={vi.fn()} onGoogleImport={vi.fn()} />);
    fireEvent.click(screen.getByText("pick-from-drive"));
    rerender(<UploadStep onUpload={vi.fn()} onGoogleImport={vi.fn()} busy />);
    expect(screen.getByRole("button", { name: "Bỏ file đã chọn" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Tiếp tục/ })).toBeDisabled();
  });
});
