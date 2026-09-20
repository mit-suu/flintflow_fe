import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addProjectsToFolder } from "@/lib/api/folders";
import type { Folder } from "@/types/folder";
import type { Project } from "@/types/project";
import AddToFolderDialog from "./AddToFolderDialog";

vi.mock("@/lib/api/folders", () => ({ addProjectsToFolder: vi.fn() }));

const folder: Folder = { _id: "f1", name: "Khách A", color: "blue", projectCount: 1, createdAt: "", updatedAt: "" };
const project = (id: string, over: Partial<Project> = {}): Project => ({
  _id: id,
  name: `Dự án ${id}`,
  status: "active",
  mode: "fpt",
  import_state: null,
  folderId: null,
  createdAt: "",
  updatedAt: "",
  ...over,
});
const PROJECTS = [project("a"), project("b"), project("in", { folderId: "f1" }), project("old", { status: "archived" })];

describe("AddToFolderDialog", () => {
  beforeEach(() => {
    vi.mocked(addProjectsToFolder).mockReset().mockResolvedValue({ data: { moved: 2 }, error: null } as never);
  });

  it("chỉ liệt kê dự án đang làm chưa ở thư mục này; tìm lọc danh sách", () => {
    renderWithIntl(<AddToFolderDialog folder={folder} projects={PROJECTS} folderIds={new Set(["f1"])} onClose={() => {}} onAdded={() => {}} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm dự án để thêm" }), { target: { value: "dự án b" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("chọn nhiều ⇒ một request, tải lại rồi đóng", async () => {
    const onAdded = vi.fn();
    const onClose = vi.fn();
    renderWithIntl(<AddToFolderDialog folder={folder} projects={PROJECTS} folderIds={new Set(["f1"])} onClose={onClose} onAdded={onAdded} />);

    expect(screen.getByRole("button", { name: "Thêm vào thư mục" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Dự án a/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Dự án b/ }));
    expect(screen.getByText("Đã chọn 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào thư mục" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addProjectsToFolder).toHaveBeenCalledWith("f1", ["a", "b"]);
    expect(onAdded).toHaveBeenCalled();
  });

  it("thư mục đã chứa hết dự án đang làm ⇒ chỉ dẫn sang lối tạo dự án mới", () => {
    renderWithIntl(<AddToFolderDialog folder={folder} projects={[project("in", { folderId: "f1" })]} folderIds={new Set(["f1"])} onClose={() => {}} onAdded={() => {}} />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(/Dùng “Dự án mới”/)).toBeInTheDocument();
  });
});
