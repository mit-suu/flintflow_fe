import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProjectsPage, type ListProjectsPageParams } from "@/lib/api/projects";
import type { Project } from "@/types/project";
import { ProjectsProvider, useProjects } from "./use-projects";

vi.mock("@/lib/api/projects", () => ({ listProjectsPage: vi.fn() }));
vi.mock("@/lib/api/folders", () => ({ listFolders: vi.fn(async () => ({ data: [], error: null })) }));

import { listFolders } from "@/lib/api/folders";

const project = (id: string): Project => ({ _id: id, name: `Dự án ${id}`, status: "active", mode: "fpt", import_state: null, folderId: null, createdAt: "", updatedAt: "" });
const page = (items: Project[], total: number) => ({ items, meta: { page: 1, limit: 3, total, totalPages: 1 } });

/** BE giả: lời gọi "gần đây" (status=active, sort=updated) và lời gọi "có dự án nào không" (limit 1, không lọc). */
const answer = (recent: Project[], activeTotal: number, anyTotal: number) =>
  vi.mocked(listProjectsPage).mockImplementation(async (params: ListProjectsPageParams) =>
    params.status === "active" ? page(recent, activeTotal) : page(recent.slice(0, 1), anyTotal)
  );

function Probe() {
  const { loading, error, foldersError, recentProjects, activeCount, hasProjects, reload } = useProjects();
  return (
    <>
      <p>{loading ? "loading" : error ?? `[${recentProjects.map((p) => p._id).join(",")}] · ${activeCount} đang làm · ${hasProjects ? "có" : "chưa có"}`}</p>
      {foldersError && <p>folders: {foldersError}</p>}
      <button type="button" onClick={() => void reload()}>
        reload
      </button>
    </>
  );
}

const renderProbe = () =>
  renderWithIntl(
    <ProjectsProvider>
      <Probe />
    </ProjectsProvider>
  );

// Thân hàm có ngoặc: `mockReset()` trả lại chính mock, vitest sẽ tưởng là hàm dọn dẹp và gọi nó
beforeEach(() => {
  vi.mocked(listProjectsPage).mockReset();
});

describe("ProjectsProvider (FLF-404: tóm tắt, không tải mọi dự án)", () => {
  it("3 dự án sửa gần nhất + số đang làm + có dự án hay chưa; reload tải lại", async () => {
    answer([project("a"), project("b"), project("c")], 40, 52);
    renderProbe();

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("[a,b,c] · 40 đang làm · có")).toBeInTheDocument();
    expect(listProjectsPage).toHaveBeenCalledWith({ page: 1, limit: 3, status: "active", sort: "updated" });
    expect(listProjectsPage).toHaveBeenCalledWith({ page: 1, limit: 1 });

    answer([], 0, 0);
    fireEvent.click(screen.getByRole("button", { name: "reload" }));
    expect(await screen.findByText("[] · 0 đang làm · chưa có")).toBeInTheDocument();
  });

  it("chỉ có dự án lưu trữ ⇒ vẫn là có dự án (không hiện màn bắt đầu)", async () => {
    answer([], 0, 2);
    renderProbe();
    expect(await screen.findByText("[] · 0 đang làm · có")).toBeInTheDocument();
  });

  it("lỗi tải ⇒ error có thông điệp", async () => {
    vi.mocked(listProjectsPage).mockRejectedValue(new Error("BE sập"));
    renderProbe();
    await waitFor(() => expect(screen.getByText("BE sập")).toBeInTheDocument());
  });

  it("chỉ thư mục lỗi ⇒ dự án vẫn hiện, lỗi thư mục tách riêng", async () => {
    answer([project("p1")], 1, 1);
    vi.mocked(listFolders).mockRejectedValueOnce(new Error("folders sập"));
    renderProbe();

    expect(await screen.findByText("[p1] · 1 đang làm · có")).toBeInTheDocument();
    expect(screen.getByText("folders: folders sập")).toBeInTheDocument();
  });
});
