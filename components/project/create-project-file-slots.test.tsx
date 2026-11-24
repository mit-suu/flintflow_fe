import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { ReferenceSlot, type ReferenceFile } from "./create-project-file-slots";

const ref = (name: string): ReferenceFile => ({ key: name, file: new File(["x"], name), precheck: null });

const renderSlot = (files: ReferenceFile[], locale: "vi" | "en" = "vi") =>
  renderWithIntl(
    <ReferenceSlot files={files} hasSrs={false} onAdd={vi.fn()} onRemove={vi.fn()} onKeep={vi.fn()} onMoveToSrs={vi.fn()} onClear={vi.fn()} />,
    locale,
  );

describe("ReferenceSlot - cảnh báo PDF trước khi tải (FLF-449, AC-21.2)", () => {
  it("file .pdf ⇒ cảnh báo bảng nhiều cột / PDF scan ngay trên dòng file; file khác không có", () => {
    renderSlot([ref("Bien ban.PDF"), ref("email.docx")]);
    const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;
    expect(row("Bien ban.PDF")).toHaveTextContent(/bảng nhiều cột có thể bị đọc lộn thứ tự, PDF scan không đọc được chữ/);
    expect(row("email.docx")).not.toHaveTextContent(/PDF scan/);
  });

  it("bản tiếng Anh", () => {
    renderSlot([ref("minutes.pdf")], "en");
    expect(screen.getByText(/scanned PDFs have no readable text/)).toBeInTheDocument();
  });
});
