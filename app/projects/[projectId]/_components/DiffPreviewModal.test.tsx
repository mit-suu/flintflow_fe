"use client";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DiffPreviewModal from "./DiffPreviewModal";
import type { PreviewResult } from "@/types/pipeline";

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
  it("hiện bảng path / before / value từ preview.changes", () => {
    render(<DiffPreviewModal preview={basePreview} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText("actors[id=A03].name")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
  });

  it("có violations thì hiện danh sách vi phạm và khoá nút Xác nhận", () => {
    const preview: PreviewResult = {
      ...basePreview,
      violations: [{ rule: "invariant_3_dead_reference", message: "Tham chiếu chết", path: "screens[id=S14].feature_id" }],
    };
    render(<DiffPreviewModal preview={preview} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText("invariant_3_dead_reference")).toBeInTheDocument();
    expect(screen.getByText("Tham chiếu chết", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
  });

  it("không có preview_id thì khoá nút Xác nhận", () => {
    render(<DiffPreviewModal preview={{ ...basePreview, preview_id: undefined }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
  });

  it("preview hợp lệ (ok, không vi phạm, có preview_id) thì bấm Xác nhận gọi onConfirm", () => {
    const onConfirm = vi.fn();
    render(<DiffPreviewModal preview={basePreview} onCancel={vi.fn()} onConfirm={onConfirm} />);

    const confirmBtn = screen.getByRole("button", { name: "Xác nhận" });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("bấm Huỷ gọi onCancel", () => {
    const onCancel = vi.fn();
    render(<DiffPreviewModal preview={basePreview} onCancel={onCancel} onConfirm={vi.fn()} />);
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
    render(<DiffPreviewModal preview={preview} onCancel={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText("fixed:2.1", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("D01", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/use_cases\[id=UC01\]\.actor_ids→A03/)).toBeInTheDocument();
  });

  it("không có thay đổi nào thì hiện thông báo trống", () => {
    render(<DiffPreviewModal preview={{ ...basePreview, changes: [] }} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText("Không có thay đổi nào.")).toBeInTheDocument();
  });
});
