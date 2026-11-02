import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { CreditEstimate, ImportedDocument } from "@/types/import";
import StartImportCard from "./StartImportCard";

const DOC = {
  id: "i1",
  project_id: "p1",
  original_name: "SRS.docx",
  size: 10,
  sha256: "a".repeat(64),
  status: "extracting",
  preflight: { status: "accepted", issues: [] },
  stamp: null,
  confirmed_latest_at: null,
  paused: null,
  extract_cursor: null,
  created_at: "2026-10-30T00:00:00.000Z",
  updated_at: "2026-10-30T00:00:00.000Z",
} as ImportedDocument;
const EST: CreditEstimate = { text_batches: 4, diagram_images: 0, check_calls: 2, ai_calls: 6, credits: 14, available_credits: 100 };

describe("StartImportCard (FLF-343)", () => {
  it("file chưa xác nhận ⇒ hỏi bản mới nhất (tick sẵn); Bắt đầu gửi confirmLatest = true", () => {
    const onStart = vi.fn();
    renderWithIntl(<StartImportCard doc={DOC} estimate={EST} credits={100} onStart={onStart} onPickAnother={vi.fn()} />);
    expect(screen.getByText(/~6 lượt AI/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(onStart).toHaveBeenCalledWith(true);
  });

  it("mẫu tổ chức / file có stamp (đã xác nhận) ⇒ không hỏi; Bắt đầu gửi false", () => {
    const onStart = vi.fn();
    renderWithIntl(<StartImportCard doc={{ ...DOC, confirmed_latest_at: "2026-10-30T00:00:00.000Z" }} estimate={EST} credits={100} onStart={onStart} onPickAnother={vi.fn()} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu" }));
    expect(onStart).toHaveBeenCalledWith(false);
  });

  it("bỏ tick ⇒ khoá Bắt đầu + câu từ chối + chọn file khác; số dư < ước tính ⇒ khoá + nạp credit", () => {
    const onPick = vi.fn();
    const { unmount } = renderWithIntl(<StartImportCard doc={DOC} estimate={EST} credits={100} onStart={vi.fn()} onPickAnother={onPick} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Chọn file khác" }));
    expect(onPick).toHaveBeenCalled();
    unmount();
    renderWithIntl(<StartImportCard doc={DOC} estimate={{ ...EST, available_credits: 3 }} credits={100} onStart={vi.fn()} onPickAnother={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Bắt đầu" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Nạp credit" })).toHaveAttribute("href", "/home/billing");
  });
});
