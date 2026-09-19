import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Folder } from "@/types/folder";
import FolderCard, { NewFolderTile } from "./FolderCard";
import ProjectCover, { coverVariant } from "./ProjectCover";

const folder: Folder = {
  _id: "f1",
  name: "Khách A",
  color: "blue",
  projectCount: 3,
  createdAt: "2026-09-19T00:00:00Z",
  updatedAt: "2026-09-19T00:00:00Z",
};

describe("FolderCard", () => {
  it("hiện tên, số dự án, màu theo color; bấm mở thư mục", () => {
    const onOpen = vi.fn();
    const { container } = render(<FolderCard folder={folder} onOpen={onOpen} onRename={() => {}} onDelete={() => {}} />);

    expect(screen.getByText("3 dự án")).toBeInTheDocument();
    expect(container.querySelector(".from-info-soft")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Khách A/ }));
    expect(onOpen).toHaveBeenCalledWith(folder);
  });

  it("menu ⋮: Đổi tên, Xoá thư mục — không mở thư mục", () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(<FolderCard folder={folder} onOpen={onOpen} onRename={() => {}} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Tuỳ chọn cho thư mục Khách A" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Xoá thư mục" }));
    expect(onDelete).toHaveBeenCalledWith(folder);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("ô + Thư mục mới gọi onCreate", () => {
    const onCreate = vi.fn();
    render(<NewFolderTile onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /Thư mục mới/ }));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});

describe("ProjectCover", () => {
  it("biến thể cố định theo id, các id khác nhau có thể khác bìa", () => {
    expect(coverVariant("650000000000000000000001")).toBe(coverVariant("650000000000000000000001"));
    const variants = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(coverVariant));
    expect(variants.size).toBeGreaterThan(1);
  });

  it("nền theo tone của mode", () => {
    const { container } = render(<ProjectCover seed="p1" tone="info" />);
    expect(container.firstElementChild?.className).toContain("from-info-border");
    expect(container.querySelectorAll("span")).toHaveLength(3);
  });
});
