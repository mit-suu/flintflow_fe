import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import DocumentVersionCard from "./DocumentVersionCard";
import type { DocumentVersionCandidate } from "@/types/document";

const V1: DocumentVersionCandidate = { id: "d1", name: "SRS_KhachHang_v1.docx", doc_code: 1, reason: "same_name", similarity: 0.42 };
const DRAFT: DocumentVersionCandidate = { id: "d2", name: "Draft.docx", doc_code: 2, reason: "similar_content", similarity: 0.83 };

describe("DocumentVersionCard (FLF-398 — có thể là bản mới của tài liệu đã có)", () => {
  it("một ứng viên: hiện tên + mã + lý do; Thay bản cũ / Giữ cả hai / Bỏ qua gọi đúng lựa chọn", () => {
    const onChoose = vi.fn();
    renderWithIntl(<DocumentVersionCard fileName="SRS_KhachHang_v2.docx" candidates={[V1]} onChoose={onChoose} />);
    expect(screen.getByRole("dialog", { name: "Có thể là bản mới của tài liệu đã có" })).toBeInTheDocument();
    expect(screen.getByText("SRS_KhachHang_v2.docx có vẻ là bản mới của một tài liệu đã có")).toBeInTheDocument();
    expect(screen.getByText(/SRS_KhachHang_v1\.docx \(D1\)/)).toBeInTheDocument();
    expect(screen.getByText(/cùng tên/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thay bản cũ" }));
    expect(onChoose).toHaveBeenLastCalledWith({ replaceDocumentId: "d1" });
    fireEvent.click(screen.getByRole("button", { name: "Giữ cả hai" }));
    expect(onChoose).toHaveBeenLastCalledWith({ keepBoth: true });
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua file này" }));
    expect(onChoose).toHaveBeenLastCalledWith(null);
  });

  it("nhiều ứng viên: chọn bản cần thay (mặc định ứng viên đầu)", () => {
    const onChoose = vi.fn();
    renderWithIntl(<DocumentVersionCard fileName="Final.docx" candidates={[V1, DRAFT]} onChoose={onChoose} />);
    expect(screen.getByText("· nội dung giống 83%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Draft\.docx/ }));
    fireEvent.click(screen.getByRole("button", { name: "Thay bản cũ" }));
    expect(onChoose).toHaveBeenCalledWith({ replaceDocumentId: "d2" });
  });

  it("đang xử lý ⇒ khoá các nút", () => {
    renderWithIntl(<DocumentVersionCard fileName="a.docx" candidates={[V1]} onChoose={vi.fn()} busy />);
    for (const name of ["Thay bản cũ", "Giữ cả hai", "Bỏ qua file này"]) expect(screen.getByRole("button", { name })).toBeDisabled();
  });
});
