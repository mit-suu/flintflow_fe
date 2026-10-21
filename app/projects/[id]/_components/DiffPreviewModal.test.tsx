"use client";

import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import DiffPreviewModal from "./DiffPreviewModal";
import type { PreviewResult } from "@/types/pipeline";
import type { Spine } from "@/types/spine";

const basePreview: PreviewResult = {
  ok: true,
  txn: "preview-1",
  base_version: 4,
  ops: [{ op: "set", path: "actors[id=A03].name", value: "Administrator" }],
  changes: [{ op: "set", path: "actors[id=A03].name", before: "Admin", value: "Administrator", reason: "typo" }],
  violations: [],
  referrers: [],
  preview_id: "pv1",
};

describe("DiffPreviewModal", () => {
  it("hiện bảng phần thay đổi (tên, không phải path) / trước / sau từ preview.changes", () => {
    renderWithIntl(<DiffPreviewModal preview={basePreview} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText("Tác nhân A03 — Tên")).toHaveAttribute("title", "actors[id=A03].name");
    expect(screen.getByRole("columnheader", { name: "Phần thay đổi" })).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });

  it("FLF-294: sau baseline phải có người yêu cầu + nguồn + lý do mới bấm được; onConfirm nhận change request", () => {
    const onConfirm = vi.fn();
    renderWithIntl(<DiffPreviewModal preview={{ ...basePreview, branch: "post_baseline" }} onCancel={vi.fn()} onConfirm={onConfirm} />);
    const confirm = screen.getByRole("button", { name: "Xác nhận" });

    fireEvent.change(screen.getByLabelText("Lý do thay đổi"), { target: { value: "Khách đổi tên vai trò" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Người yêu cầu"), { target: { value: "Chị Lan" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nguồn"), { target: { value: "meeting_minutes" } });
    fireEvent.change(screen.getByLabelText("Tham chiếu nguồn (tuỳ chọn)"), { target: { value: "Biên bản 15/10" } });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("Khách đổi tên vai trò", {
      requester: "Chị Lan",
      source: { kind: "meeting_minutes", ref: "Biên bản 15/10" },
    });
  });

  it("FLF-294: trước baseline không hỏi change request, onConfirm không kèm gì", () => {
    const onConfirm = vi.fn();
    renderWithIntl(<DiffPreviewModal preview={{ ...basePreview, branch: "dependent" }} onCancel={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.queryByLabelText("Người yêu cầu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    expect(onConfirm).toHaveBeenCalledWith(undefined, undefined);
  });

  it("có violations thì hiện danh sách vi phạm và khoá nút Xác nhận", () => {
    const preview: PreviewResult = {
      ...basePreview,
      violations: [{ rule: "invariant_3_dead_reference", message: "Tham chiếu chết", path: "screens[id=S14].feature_id" }],
    };
    renderWithIntl(<DiffPreviewModal preview={preview} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    // mã luật lạ ⇒ không in; path ⇒ tên phần tử
    expect(screen.queryByText(/invariant_3_dead_reference/)).not.toBeInTheDocument();
    expect(screen.getByText("Tham chiếu chết", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Màn hình S14 — Tính năng/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
  });

  it("không có preview_id thì khoá nút Xác nhận", () => {
    renderWithIntl(<DiffPreviewModal preview={{ ...basePreview, preview_id: undefined }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
  });

  it("preview hợp lệ (ok, không vi phạm, có preview_id) thì bấm Xác nhận gọi onConfirm", () => {
    const onConfirm = vi.fn();
    renderWithIntl(<DiffPreviewModal preview={basePreview} onCancel={vi.fn()} onConfirm={onConfirm} />);

    const confirmBtn = screen.getByRole("button", { name: "Xác nhận" });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("bấm Huỷ gọi onCancel", () => {
    const onCancel = vi.fn();
    renderWithIntl(<DiffPreviewModal preview={basePreview} onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("hiện phạm vi ảnh hưởng: section / diagram / referrers", () => {
    const preview: PreviewResult = {
      ...basePreview,
      impact: {
        fields: ["actors[id=A03].name"],
        sections: [{ id: "fixed:2.1", relation: "owner" }],
        diagrams: ["D01"],
        referrers: [{ path: "use_cases[id=UC01].actor_ids", id: "A03" }],
      },
    };
    renderWithIntl(<DiffPreviewModal preview={preview} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText("2.1 Actors", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Sơ đồ sẽ vẽ lại: 1")).toBeInTheDocument();
    expect(screen.getByText(/Đang được nhắc tới ở: Use case UC01 — Tác nhân/)).toBeInTheDocument();
    expect(screen.queryByText(/fixed:|\[id=/)).not.toBeInTheDocument();
  });

  it("không có thay đổi nào thì hiện thông báo trống", () => {
    renderWithIntl(<DiffPreviewModal preview={{ ...basePreview, changes: [] }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Không có thay đổi nào.")).toBeInTheDocument();
  });
});

describe("DiffPreviewModal — FLF-177", () => {
  it("BUG-27: diff rỗng thì KHÔNG có nút Xác nhận", () => {
    const empty: PreviewResult = { ...basePreview, ops: [], changes: [] };
    renderWithIntl(<DiffPreviewModal preview={empty} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText("Không có thay đổi nào.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác nhận/ })).not.toBeInTheDocument();
  });

  it("BUG-16: hoà giải không có gì cần đổi vẫn xác nhận được để gỡ cờ", () => {
    const onConfirm = vi.fn();
    const noChange: PreviewResult = { ...basePreview, ops: [], changes: [], no_change: true, notes: "2 section vẫn đúng nội dung" };
    renderWithIntl(<DiffPreviewModal preview={noChange} onCancel={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText("2 section vẫn đúng nội dung")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận không đổi" }));
    expect(onConfirm).toHaveBeenCalled();
  });

  describe("FLF-297 — thêm use case", () => {
    const spine = {
      actors: [{ id: "A01", name: "Lecturer", kind: "human", description: "" }],
      functions: [{ id: "F01", name: "Take Attendance" }],
    } as unknown as Spine;
    const addUc = (value: Record<string, unknown>): PreviewResult => ({
      ...basePreview,
      changes: [{ op: "add", path: "use_cases[]", before: null, value, reason: null }],
    });

    it("hiện tên tác nhân thay vì mã; chưa gắn chức năng ⇒ cảnh báo, vẫn cho áp dụng", () => {
      renderWithIntl(
        <DiffPreviewModal
          preview={addUc({ id: "UC27", name: "Send Absence Warning", actor_ids: ["A01"], function_ids: [] })}
          spine={spine}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      );
      expect(screen.getByText(/Tác nhân: Lecturer;/)).toBeInTheDocument();
      expect(screen.queryByText(/Tác nhân: A01/)).not.toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("“Send Absence Warning” chưa gắn chức năng nào");
      expect(screen.getByRole("button", { name: "Xác nhận" })).toBeEnabled();
    });

    it("đã gắn chức năng ⇒ không cảnh báo, chức năng hiện tên; mã lạ giữ nguyên", () => {
      renderWithIntl(
        <DiffPreviewModal
          preview={addUc({ name: "Send Absence Warning", actor_ids: ["A09"], function_ids: ["F01"] })}
          spine={spine}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      );
      expect(screen.getByText(/Tác nhân: A09; Chức năng liên quan: Take Attendance/)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("sửa field tham chiếu: trước / sau đều hiện tên", () => {
      const preview: PreviewResult = {
        ...basePreview,
        changes: [{ op: "set", path: "use_cases[id=UC27].function_ids", before: ["F01"], value: [], reason: null }],
      };
      renderWithIntl(<DiffPreviewModal preview={preview} spine={spine} onCancel={vi.fn()} onConfirm={vi.fn()} />);
      expect(screen.getByText("Take Attendance")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("“UC27” chưa gắn chức năng nào");
    });
  });
});
