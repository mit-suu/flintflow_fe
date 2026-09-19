import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/layout/AppShell";
import { getProgress } from "@/lib/api/pipeline";
import { createProject, listProjects, moveProjectToFolder } from "@/lib/api/projects";
import { listFolders } from "@/lib/api/folders";
import { ProjectsProvider } from "@/lib/hooks/use-projects";
import type { Project } from "@/types/project";
import HomePage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/home" }));
vi.mock("@/lib/api/projects", () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
  moveProjectToFolder: vi.fn(async () => ({ data: null, error: null })),
}));
vi.mock("@/lib/api/folders", () => ({ listFolders: vi.fn() }));
vi.mock("@/lib/api/pipeline", () => ({ getProgress: vi.fn(async () => ({ data: null, error: null })) }));
vi.mock("@/lib/api/billing", () => ({ fetchBalance: vi.fn(async () => ({ balance: 10, planLabel: "Free" })) }));

const project = (id: string, over: Partial<Project> = {}): Project => ({
  _id: id,
  name: `Dự án ${id}`,
  status: "active",
  mode: "fpt",
  import_state: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  ...over,
});

const renderPage = () =>
  render(
    <ProjectsProvider>
      <AppShell sidebar={null}>
        <HomePage />
      </AppShell>
    </ProjectsProvider>
  );

const ok = (data: unknown) => ({ data, error: null }) as never;

/** Chọn một mục trong bộ lọc (FilterSelect tự dựng): mở combobox rồi chọn option theo nhãn. */
const pickFilter = (name: string, option: string) => {
  fireEvent.click(screen.getByRole("combobox", { name }));
  fireEvent.mouseDown(screen.getByRole("option", { name: option }));
};

describe("Project Dashboard", () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(listProjects).mockReset();
    vi.mocked(createProject).mockReset();
    vi.mocked(listFolders).mockReset().mockResolvedValue(ok([]));
  });

  it("đang tải ⇒ skeleton, không hiện trạng thái rỗng", () => {
    vi.mocked(listProjects).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getAllByTestId("project-skeleton")).toHaveLength(6);
    expect(screen.queryByText("Bắt đầu dự án SRS đầu tiên")).toBeNull();
    expect(screen.queryByText("Không có dự án khớp bộ lọc")).toBeNull();
  });

  it("chưa có dự án ⇒ 3 thẻ mode + ô tên ngay trên trang; tạo xong tải lại và vào route theo mode", async () => {
    vi.mocked(listProjects).mockResolvedValue(ok([]));
    vi.mocked(createProject).mockResolvedValue(ok(project("p9")));
    renderPage();

    expect(await screen.findByText("Bắt đầu dự án SRS đầu tiên")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);

    // Template khách đang "Sắp có": không chọn được; Upload SRS (mode 1) chọn được
    expect(screen.getByRole("radio", { name: /Có template của khách/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: /Upload SRS có sẵn/ })).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("radio", { name: /Chưa có template/ }));
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/p9"));
    expect(createProject).toHaveBeenCalledWith("Dự án chưa đặt tên", "fpt", undefined);
    expect(listProjects).toHaveBeenCalledTimes(2);
  });

  it("có dự án ⇒ lưới đúng số card; lọc theo nguồn và trạng thái", async () => {
    vi.mocked(listProjects).mockResolvedValue(
      ok([project("a", { mode: "import" }), project("b"), project("c", { status: "archived" })])
    );
    renderPage();

    expect(await screen.findByRole("link", { name: /Dự án a/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dự án b/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dự án c/ })).toBeNull();
    await waitFor(() => expect(getProgress).toHaveBeenCalled());

    pickFilter("Nguồn", "SRS có sẵn");
    expect(screen.queryByRole("link", { name: /Dự án b/ })).toBeNull();

    pickFilter("Nguồn", "Tất cả");
    pickFilter("Trạng thái", "Lưu trữ");
    expect(screen.getByRole("link", { name: /Dự án c/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dự án a/ })).toBeNull();
  });

  it("lọc ra rỗng ⇒ empty state riêng, Xoá bộ lọc đưa về danh sách", async () => {
    vi.mocked(listProjects).mockResolvedValue(ok([project("a")]));
    renderPage();
    await screen.findByRole("link", { name: /Dự án a/ });

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm dự án theo tên" }), { target: { value: "không khớp" } });
    expect(screen.getByText("Không có dự án khớp bộ lọc")).toBeInTheDocument();
    expect(screen.queryByText("Bắt đầu dự án SRS đầu tiên")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xoá bộ lọc" }));
    expect(screen.getByRole("link", { name: /Dự án a/ })).toBeInTheDocument();
  });

  it("chỉ còn dự án lưu trữ ⇒ không hiện onboarding nhưng có sẵn form tạo dự án, vẫn mở được lưu trữ", async () => {
    vi.mocked(listProjects).mockResolvedValue(ok([project("c", { status: "archived" })]));
    renderPage();

    expect(await screen.findByText("Chưa có dự án đang làm")).toBeInTheDocument();
    expect(screen.queryByText("Bắt đầu dự án SRS đầu tiên")).toBeNull();
    // Chọn cách bắt đầu ngay trong vùng trống, không phải mở dialog
    expect(screen.getByRole("radiogroup", { name: "Bạn bắt đầu từ đâu?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem lưu trữ" }));
    expect(screen.getByRole("link", { name: /Dự án c/ })).toBeInTheDocument();
  });

  it("hàng Thư mục: bấm thư mục ⇒ chỉ dự án bên trong, breadcrumb đổi, quay lại được", async () => {
    vi.mocked(listProjects).mockResolvedValue(ok([project("a", { folderId: "f1" }), project("b")]));
    vi.mocked(listFolders).mockResolvedValue(
      ok([{ _id: "f1", name: "Khách A", color: "blue", projectCount: 1, createdAt: "", updatedAt: "" }])
    );
    renderPage();

    const folders = await screen.findByRole("region", { name: /Thư mục/ });
    expect(within(folders).getByRole("button", { name: /Thư mục mới/ })).toBeInTheDocument();
    fireEvent.click(within(folders).getByRole("button", { name: /^Khách A/ }));

    expect(screen.getByRole("link", { name: /Dự án a/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dự án b/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /^Thư mục/ })).toBeNull();
    expect(screen.getByText("Khách A", { selector: "[aria-current='page']" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả dự án" }));
    expect(screen.getByRole("link", { name: /Dự án b/ })).toBeInTheDocument();
  });

  it("tab Tất cả ẩn dự án trong thư mục; tab Dự án hiện tất cả kèm chip thư mục, chia vùng thời gian", async () => {
    const now = new Date().toISOString();
    vi.mocked(listProjects).mockResolvedValue(
      ok([project("a", { folderId: "f1", updatedAt: now }), project("b", { updatedAt: "2020-01-01T00:00:00Z" })])
    );
    vi.mocked(listFolders).mockResolvedValue(
      ok([{ _id: "f1", name: "Khách A", color: "blue", projectCount: 1, createdAt: "", updatedAt: "" }])
    );
    renderPage();

    expect(await screen.findByRole("link", { name: /Dự án b/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dự án a/ })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /^Dự án/ }));
    expect(screen.getByRole("link", { name: /Dự án a/ })).toHaveTextContent("Khách A");
    expect(screen.getByRole("heading", { name: "Hôm nay" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cũ hơn" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Thư mục/ })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Sắp xếp" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^Thư mục/ }));
    expect(screen.queryByRole("link", { name: /Dự án/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Khách A/ })).toBeInTheDocument();
  });

  it("thả card dự án vào thẻ thư mục ⇒ chuyển rồi tải lại", async () => {
    vi.mocked(listProjects).mockResolvedValue(ok([project("a")]));
    vi.mocked(listFolders).mockResolvedValue(ok([{ _id: "f1", name: "Khách A", color: "blue", projectCount: 0, createdAt: "", updatedAt: "" }]));
    renderPage();
    await screen.findByRole("link", { name: /Dự án a/ });

    const folder = screen.getByRole("button", { name: /^Khách A/ }).closest("article") as HTMLElement;
    const dataTransfer = { types: ["application/x-flintflow-project"], getData: () => "a", dropEffect: "none" };
    fireEvent.dragOver(folder, { dataTransfer });
    fireEvent.drop(folder, { dataTransfer });

    await waitFor(() => expect(moveProjectToFolder).toHaveBeenCalledWith("a", "f1"));
    await waitFor(() => expect(listProjects).toHaveBeenCalledTimes(2));
  });

  it('"+ Dự án mới" mở dialog chứa cùng picker; Huỷ không tạo gì', async () => {
    vi.mocked(listProjects).mockResolvedValue(ok([project("a")]));
    renderPage();
    await screen.findByRole("link", { name: /Dự án a/ });

    fireEvent.click(screen.getByRole("button", { name: /Dự án mới|Mới/ }));
    const dialog = screen.getByRole("dialog", { name: "Tạo dự án mới" });
    expect(within(dialog).getAllByRole("radio")).toHaveLength(3);

    fireEvent.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(createProject).not.toHaveBeenCalled();
  });
});
