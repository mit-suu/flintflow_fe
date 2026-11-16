import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addProjectsToFolder } from "@/lib/api/folders";
import { listProjects } from "@/lib/api/projects";
import type { Folder } from "@/types/folder";
import type { Project } from "@/types/project";
import AddToFolderDialog from "./AddToFolderDialog";

vi.mock("@/lib/api/folders", () => ({ addProjectsToFolder: vi.fn() }));
// FLF-404: dialog tự tải dự án đang làm khi mở (dashboard chỉ giữ các trang đã cuộn tới)
vi.mock("@/lib/api/projects", () => ({ listProjects: vi.fn() }));

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
    vi.mocked(listProjects).mockReset().mockResolvedValue({ data: PROJECTS.filter((p) => p.status === "active"), error: null } as never);
  });

  it("tự tải dự án đang làm; chỉ liệt kê dự án chưa ở thư mục này; tìm lọc danh sách", async () => {
    renderWithIntl(<AddToFolderDialog folder={folder} folderIds={new Set(["f1"])} onClose={() => {}} onAdded={() => {}} />);

    expect(await screen.findAllByRole("checkbox")).toHaveLength(2);
    expect(listProjects).toHaveBeenCalledWith("active");
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm dự án để thêm" }), { target: { value: "dự án b" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("chọn nhiều ⇒ một request, tải lại rồi đóng", async () => {
    const onAdded = vi.fn();
    const onClose = vi.fn();
    renderWithIntl(<AddToFolderDialog folder={folder} folderIds={new Set(["f1"])} onClose={onClose} onAdded={onAdded} />);

    expect(await screen.findByRole("button", { name: "Thêm vào thư mục" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Dự án a/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Dự án b/ }));
    expect(screen.getByText("Đã chọn 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thêm vào thư mục" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(addProjectsToFolder).toHaveBeenCalledWith("f1", ["a", "b"]);
    expect(onAdded).toHaveBeenCalled();
  });

  it("thư mục đã chứa hết dự án đang làm ⇒ chỉ dẫn sang lối tạo dự án mới", async () => {
    vi.mocked(listProjects).mockResolvedValue({ data: [project("in", { folderId: "f1" })], error: null } as never);
    renderWithIntl(<AddToFolderDialog folder={folder} folderIds={new Set(["f1"])} onClose={() => {}} onAdded={() => {}} />);

    expect(await screen.findByText(/Dùng “Dự án mới”/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("tải danh sách lỗi ⇒ báo lỗi thay vì nói thư mục đã chứa hết", async () => {
    vi.mocked(listProjects).mockRejectedValue(new Error("down"));
    renderWithIntl(<AddToFolderDialog folder={folder} folderIds={new Set(["f1"])} onClose={() => {}} onAdded={() => {}} />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Dùng “Dự án mới”/)).not.toBeInTheDocument();
  });
});
