"use client";

import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import ChatEditCard from "./ChatEditCard";
import type { PreviewResult } from "@/types/pipeline";

const preview = (extra: Partial<PreviewResult> = {}): PreviewResult => ({
  ok: true,
  txn: "t1",
  base_version: 3,
  ops: [],
  changes: [{ op: "set", path: "actors[id=A01].description", before: "a", value: "b", reason: null }],
  violations: [],
  referrers: [],
  preview_id: "pv-1",
  ...extra,
});

const base = {
  instruction: "Đổi mô tả actor A01",
  previewing: false,
  applying: false,
  clarification: null,
  error: null,
  applied: null,
  onShowDetail: vi.fn(),
  onApply: vi.fn(),
  onCancel: vi.fn(),
  onDismiss: vi.fn(),
};

describe("ChatEditCard - cảnh báo, cờ đỏ dự báo, tự áp dụng", () => {
  it("warning ⇒ hiện lý do + nút 'Vẫn làm' thay cho 'Áp dụng', bấm là xác nhận như thường", () => {
    const onApply = vi.fn();
    renderWithIntl(<ChatEditCard {...base} onApply={onApply} preview={preview({ warning: "Xoá actor này làm mất 3 use case." })} />);
    expect(screen.getByText(/Xoá actor này làm mất 3 use case\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Áp dụng" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vẫn làm" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("predicted_red_flags ⇒ dòng 'Sửa này sẽ chặn baseline' + tên luật + câu của BE; không lộ mã mục", () => {
    renderWithIntl(
      <ChatEditCard
        {...base}
        sectionName={() => "4.1 Yêu cầu chức năng"}
        preview={preview({
          predicted_red_flags: [
            { rule_id: "duplicate_name", section_id: "fixed:4.1", target_id: "FR-02", message: "Tên trùng ở fixed:4.1" },
            { rule_id: "rule_chua_biet", section_id: "fixed:4.1", target_id: null, message: "Câu riêng của BE" },
          ],
        })}
      />
    );
    expect(screen.getByText("Sửa này sẽ chặn baseline")).toBeInTheDocument();
    expect(screen.getByText(/Tên bị trùng/)).toBeInTheDocument();
    expect(screen.getByText(/Tên trùng ở 4\.1 Yêu cầu chức năng/)).toBeInTheDocument();
    expect(screen.getByText(/Câu riêng của BE/)).toBeInTheDocument();
    expect(screen.queryByText(/fixed:4\.1/)).not.toBeInTheDocument();
  });

  it("op rõ + câu hỏi ⇒ thẻ xem trước vẫn còn nút Áp dụng cùng câu hỏi cho phần chưa rõ", () => {
    renderWithIntl(<ChatEditCard {...base} clarification="Bạn muốn sửa màn nào?" preview={preview({ clarification: "Bạn muốn sửa màn nào?" })} />);
    expect(screen.getByText(/Bạn muốn sửa màn nào\?/)).toBeInTheDocument();
    expect(screen.getByText(/Còn một ý chưa rõ/)).toBeInTheDocument();
    expect(screen.getByText(/Sẽ thay đổi 1 chỗ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Áp dụng" })).toBeInTheDocument();
  });

  it("confirm_reason ⇒ dòng mờ giải thích vì sao cần xác nhận; assumptions không có hộp riêng", () => {
    renderWithIntl(
      <ChatEditCard {...base} preview={preview({ confirm_reason: "bạn đang ở mức duyệt Mọi bước", assumptions: [{ statement: "Assume X" }] })} />
    );
    expect(screen.getByText("Cần bạn xác nhận vì: bạn đang ở mức duyệt Mọi bước")).toBeInTheDocument();
    expect(screen.queryByText(/Assume X|Giả định/)).not.toBeInTheDocument();
  });

  it("tự áp dụng ⇒ thẻ 'Đã áp dụng' có Hoàn tác, không có nút xác nhận", () => {
    const onUndo = vi.fn();
    renderWithIntl(<ChatEditCard {...base} preview={null} applied={{ instruction: base.instruction, count: 2, version: 6, auto: true }} onUndo={onUndo} />);
    expect(screen.getByText("Đã áp dụng 2 thay đổi")).toBeInTheDocument();
    expect(screen.getByText(/Đã tự áp dụng theo mức duyệt/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Áp dụng|Vẫn làm)$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
