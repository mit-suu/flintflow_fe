import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFolder, deleteFolder, updateFolder } from "@/lib/api/folders";
import { moveProjectToFolder } from "@/lib/api/projects";
import type { Folder } from "@/types/folder";
import type { Project } from "@/types/project";
import FolderDialogs from "./FolderDialogs";

vi.mock("@/lib/api/folders", () => ({ createFolder: vi.fn(), updateFolder: vi.fn(), deleteFolder: vi.fn() }));
vi.mock("@/lib/api/projects", () => ({ moveProjectToFolder: vi.fn() }));

const ok = { data: null, error: null } as never;
const folder: Folder = { _id: "f1", name: "Khách A", color: "violet", projectCount: 2, createdAt: "", updatedAt: "" };
const project: Project = { _id: "p1", name: "Lumen", status: "active", sourceMode: "fpt_template", folderId: null, createdAt: "", updatedAt: "" };

describe("FolderDialogs", () => {
  beforeEach(() => {
    for (const fn of [createFolder, updateFolder, deleteFolder, moveProjectToFolder]) vi.mocked(fn).mockReset().mockResolvedValue(ok);
  });

  it("tạo: tên đã trim + màu chọn, xong tải lại và đóng", async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    render(<FolderDialogs target={{ kind: "create" }} folders={[]} onClose={onClose} onDone={onDone} />);

    expect(screen.getByRole("button", { name: "Tạo thư mục" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tên thư mục"), { target: { value: "  Khách B " } });
    fireEvent.click(screen.getByRole("radio", { name: "Vàng" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo thư mục" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createFolder).toHaveBeenCalledWith({ name: "Khách B", color: "amber" });
    expect(onDone).toHaveBeenCalled();
  });

  it("sửa: điền sẵn, chưa đổi gì thì khoá nút Lưu", async () => {
    render(<FolderDialogs target={{ kind: "rename", folder }} folders={[folder]} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByLabelText("Tên thư mục")).toHaveValue("Khách A");
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Tên thư mục"), { target: { value: "Khách A2" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(updateFolder).toHaveBeenCalledWith("f1", { name: "Khách A2", color: "blue" }));
  });

  it("xoá: nói rõ dự án bên trong được giữ", async () => {
    render(<FolderDialogs target={{ kind: "delete", folder }} folders={[folder]} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByText(/Mọi dự án bên trong .* vẫn được giữ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xoá thư mục" }));
    await waitFor(() => expect(deleteFolder).toHaveBeenCalledWith("f1"));
  });

  it("chuyển dự án: chọn thư mục ⇒ PATCH folder; chưa đổi thì khoá nút", async () => {
    render(<FolderDialogs target={{ kind: "move", project }} folders={[folder]} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByRole("button", { name: "Chuyển" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Khách A/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chuyển" }));
    await waitFor(() => expect(moveProjectToFolder).toHaveBeenCalledWith("p1", "f1"));
  });

  it("lỗi BE hiện trong dialog, không đóng", async () => {
    vi.mocked(createFolder).mockRejectedValue(new Error("Trùng tên"));
    const onClose = vi.fn();
    render(<FolderDialogs target={{ kind: "create" }} folders={[]} onClose={onClose} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText("Tên thư mục"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo thư mục" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Trùng tên");
    expect(onClose).not.toHaveBeenCalled();
  });
});
