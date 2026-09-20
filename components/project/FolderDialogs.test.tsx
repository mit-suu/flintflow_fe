import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFolder, deleteFolder, moveProjectsToFolder, updateFolder } from "@/lib/api/folders";
import type { Folder } from "@/types/folder";
import type { Project } from "@/types/project";
import FolderDialogs from "./FolderDialogs";

vi.mock("@/lib/api/folders", () => ({ createFolder: vi.fn(), updateFolder: vi.fn(), deleteFolder: vi.fn(), moveProjectsToFolder: vi.fn() }));

const ok = { data: null, error: null } as never;
const folder: Folder = { _id: "f1", name: "Khách A", color: "violet", projectCount: 2, createdAt: "", updatedAt: "" };
const project: Project = { _id: "p1", name: "Lumen", status: "active", mode: "fpt", import_state: null, folderId: null, createdAt: "", updatedAt: "" };

describe("FolderDialogs", () => {
  beforeEach(() => {
    for (const fn of [createFolder, updateFolder, deleteFolder, moveProjectsToFolder]) vi.mocked(fn).mockReset().mockResolvedValue(ok);
  });

  it("tạo: tên đã trim + màu chọn, xong tải lại và đóng", async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    renderWithIntl(<FolderDialogs target={{ kind: "create" }} folders={[]} onClose={onClose} onDone={onDone} />);

    expect(screen.getByRole("button", { name: "Tạo thư mục" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tên thư mục"), { target: { value: "  Khách B " } });
    fireEvent.click(screen.getByRole("radio", { name: "Vàng" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo thư mục" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createFolder).toHaveBeenCalledWith({ name: "Khách B", color: "amber" });
    expect(onDone).toHaveBeenCalled();
  });

  it("sửa: điền sẵn, chưa đổi gì thì khoá nút Lưu", async () => {
    renderWithIntl(<FolderDialogs target={{ kind: "rename", folder }} folders={[folder]} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByLabelText("Tên thư mục")).toHaveValue("Khách A");
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Tên thư mục"), { target: { value: "Khách A2" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(updateFolder).toHaveBeenCalledWith("f1", { name: "Khách A2", color: "blue" }));
  });

  it("xoá: nói rõ dự án bên trong được giữ", async () => {
    renderWithIntl(<FolderDialogs target={{ kind: "delete", folder }} folders={[folder]} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByText(/Mọi dự án bên trong .* vẫn được giữ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xoá thư mục" }));
    await waitFor(() => expect(deleteFolder).toHaveBeenCalledWith("f1"));
  });

  it("chuyển một dự án: chọn thư mục ⇒ gọi chuyển; chưa đổi thì khoá nút", async () => {
    renderWithIntl(<FolderDialogs target={{ kind: "move", projects: [project] }} folders={[folder]} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByRole("button", { name: "Chuyển" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Khách A/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chuyển" }));
    await waitFor(() => expect(moveProjectsToFolder).toHaveBeenCalledWith([project], "f1"));
  });

  it("chuyển nhiều dự án: nói rõ số lượng, chọn “Để ngoài thư mục” ⇒ đích null", async () => {
    const inFolder: Project = { ...project, _id: "p2", name: "Nova", folderId: "f1" };
    renderWithIntl(
      <FolderDialogs target={{ kind: "move", projects: [inFolder, { ...inFolder, _id: "p3" }] }} folders={[folder]} onClose={() => {}} onDone={() => {}} />
    );
    expect(screen.getByText("2 dự án đã chọn")).toBeInTheDocument();
    // Cả nhóm đang ở Khách A ⇒ đích đó bị khoá, phải đổi đích mới chuyển được
    expect(screen.getByRole("button", { name: "Chuyển" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Để ngoài thư mục/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chuyển" }));
    await waitFor(() => expect(moveProjectsToFolder).toHaveBeenCalledWith([inFolder, { ...inFolder, _id: "p3" }], null));
  });

  it("lỗi BE hiện trong dialog, không đóng", async () => {
    vi.mocked(createFolder).mockRejectedValue(new Error("Trùng tên"));
    const onClose = vi.fn();
    renderWithIntl(<FolderDialogs target={{ kind: "create" }} folders={[]} onClose={onClose} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText("Tên thư mục"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo thư mục" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Trùng tên");
    expect(onClose).not.toHaveBeenCalled();
  });
});
