"use client";

import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import ChatEditCard from "./ChatEditCard";
import { ApiClientError } from "@/lib/api/client";
import { conflictOf, type ChangeConflict } from "../hooks/useChanges";

const conflict: ChangeConflict = {
  instruction: "Sửa định nghĩa No-show trong thuật ngữ",
  previewId: "pv-1",
  items: [
    {
      path: "glossary[id=G07]",
      section_id: "fixed:5.5",
      label: "No-show",
      at_proposal: "Khách không đến.",
      current: "Khách không đến và không báo trước.",
      proposal: "Khách đặt lịch nhưng không đến.",
      changed_by: "Bình",
      changed_at: "2026-11-17T09:05:00.000Z",
      proposed_at: "2026-11-17T09:00:00.000Z",
    },
  ],
};

const base = {
  instruction: conflict.instruction,
  previewing: false,
  applying: false,
  clarification: null,
  error: null,
  preview: null,
  applied: null,
  onShowDetail: vi.fn(),
  onApply: vi.fn(),
  onCancel: vi.fn(),
  onDismiss: vi.fn(),
};

describe("ChatEditCard - hai người sửa cùng lúc (P12)", () => {
  it("người khác sửa đúng chữ ⇒ màn 3 cột, chỉ 'AI soạn lại' và 'Bỏ yêu cầu', không có nút Áp dụng / ghi đè", () => {
    const onRedraft = vi.fn();
    const onDropRequest = vi.fn();
    renderWithIntl(
      <ChatEditCard {...base} conflict={conflict} sectionName={() => "5.5 Thuật ngữ"} onRedraft={onRedraft} onDropRequest={onDropRequest} />
    );
    expect(screen.getByText(/① Lúc AI soạn/)).toBeInTheDocument();
    expect(screen.getByText(/② Hiện tại \(Bình/)).toBeInTheDocument();
    expect(screen.getByText("③ Đề xuất của bạn")).toBeInTheDocument();
    expect(screen.getByText(/5\.5 Thuật ngữ - No-show/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Áp dụng" })).not.toBeInTheDocument();
    expect(screen.queryByText(/glossary|G07/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "AI soạn lại trên nội dung hiện tại" }));
    fireEvent.click(screen.getByRole("button", { name: "Bỏ yêu cầu" }));
    expect(onRedraft).toHaveBeenCalledTimes(1);
    expect(onDropRequest).toHaveBeenCalledTimes(1);
  });

  it("người khác đã sửa giống ⇒ dòng 'Đã được Bình sửa giống đề xuất của bạn'", () => {
    renderWithIntl(
      <ChatEditCard {...base} applied={{ instruction: "x", count: 0, version: 9 }} alreadyApplied={[{ section_id: "fixed:5.5", label: "No-show", changed_by: "Bình" }]} />
    );
    expect(screen.getByText("Đã được Bình sửa giống đề xuất của bạn - không ghi lại.")).toBeInTheDocument();
  });

  it("conflictOf: chỉ 409 SPINE_VERSION_CONFLICT có meta.conflicts mới là màn so sánh; 409 trơn vẫn là 'tài liệu vừa đổi'", () => {
    const withMeta = new ApiClientError(409, "SPINE_VERSION_CONFLICT", "Bình vừa sửa", { conflicts: conflict.items, preview_id: "pv-1", instruction: "lệnh" });
    expect(conflictOf(withMeta, "khác")).toEqual({ instruction: "lệnh", previewId: "pv-1", items: conflict.items });
    expect(conflictOf(new ApiClientError(409, "SPINE_VERSION_CONFLICT", "x"), "lệnh")).toBeNull();
  });
});
