import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PreflightIssue } from "@/types/import";
import PreflightIssues from "./PreflightIssues";

describe("PreflightIssues — lý do từ chối kèm vị trí + cách sửa (I-1, 1.2)", () => {
  it("không có vấn đề ⇒ không render gì", () => {
    const { container } = render(<PreflightIssues issues={[]} fileName="SRS.docx" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mỗi vấn đề: nhãn theo mã, thông điệp BE, vị trí (đoạn + text) và cách sửa", () => {
    const issues: PreflightIssue[] = [
      {
        code: "FOREIGN_TRACK_CHANGE",
        message: "Track Changes của \"Nguyen Van A\" chưa được Accept/Reject",
        location: { block_ord: 5, text: "3.2.5 Create SRS project" },
      },
      { code: "FOREIGN_COMMENT", message: "Comment của \"Tran B\"", location: { block_ord: 12, text: "BR-01: …" } },
    ];
    render(<PreflightIssues issues={issues} fileName="SRS_tracked.docx" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("“SRS_tracked.docx” chưa nhập được — 2 vấn đề cần sửa:");
    const [first, second] = within(alert).getAllByRole("listitem");

    expect(within(first).getByText("Track Changes chưa xử lý")).toBeInTheDocument();
    expect(within(first).getByText(/Nguyen Van A/)).toBeInTheDocument();
    expect(within(first).getByText("Vị trí: đoạn thứ 5 — “3.2.5 Create SRS project”")).toBeInTheDocument();
    expect(within(first).getByText(/Cách sửa: Vào Review → Accept\/Reject tất cả thay đổi/)).toBeInTheDocument();

    expect(within(second).getByText("Comment chưa xử lý")).toBeInTheDocument();
    expect(within(second).getByText("Vị trí: đoạn thứ 12 — “BR-01: …”")).toBeInTheDocument();
    expect(within(second).getByText(/Cách sửa: Vào Review → Delete All Comments/)).toBeInTheDocument();
  });

  it("lỗi cả file (không có vị trí): không hiện dòng vị trí; mã có hướng dẫn thì hiện cách sửa", () => {
    render(
      <PreflightIssues
        issues={[
          { code: "LEGACY_DOC", message: "File .doc", location: null },
          { code: "FILE_ENCRYPTED", message: "Có mật khẩu" },
          { code: "FILE_TOO_LARGE", message: "12MB" },
        ]}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("File chưa nhập được — 3 vấn đề cần sửa:");
    expect(screen.queryByText(/Vị trí:/)).not.toBeInTheDocument();
    expect(screen.getByText("File .doc cũ (Word 97-2003)")).toBeInTheDocument();
    expect(screen.getByText(/Cách sửa: Mở bằng Word, chọn File → Save As/)).toBeInTheDocument();
    expect(screen.getByText("File có mật khẩu")).toBeInTheDocument();
    expect(screen.getByText(/Cách sửa: Bỏ mật khẩu/)).toBeInTheDocument();
    expect(screen.getByText("File quá lớn")).toBeInTheDocument();
    expect(screen.getByText(/Cách sửa: Nén ảnh/)).toBeInTheDocument();
  });

  it("mã không có hướng dẫn sửa (NOT_DOCX, CORRUPT_ZIP, EMPTY_DOCUMENT) chỉ hiện nhãn + thông điệp", () => {
    render(
      <PreflightIssues
        issues={[
          { code: "NOT_DOCX", message: "Không phải zip OOXML" },
          { code: "CORRUPT_ZIP", message: "Zip hỏng" },
          { code: "EMPTY_DOCUMENT", message: "Không có đoạn nào" },
        ]}
      />
    );
    expect(screen.getByText("Không phải file Word .docx")).toBeInTheDocument();
    expect(screen.getByText("File hỏng")).toBeInTheDocument();
    expect(screen.getByText("Tài liệu rỗng")).toBeInTheDocument();
    expect(screen.queryByText(/Cách sửa:/)).not.toBeInTheDocument();
  });
});
