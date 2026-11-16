import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/layout/AppShell";
import { getProgress } from "@/lib/api/pipeline";
import { createProjectFrom, listProjectsPage, moveProjectToFolder, type ListProjectsPageParams } from "@/lib/api/projects";
import { listFolders, moveProjectsToFolder } from "@/lib/api/folders";
import { ProjectsProvider } from "@/lib/hooks/use-projects";
import type { Project } from "@/types/project";
import HomePage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/home" }));
vi.mock("@/lib/api/projects", () => ({
  listProjectsPage: vi.fn(),
  createProjectFrom: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
  setDocumentLanguage: vi.fn(),
  moveProjectToFolder: vi.fn(async () => ({ data: null, error: null })),
}));
vi.mock("@/lib/api/folders", () => ({ listFolders: vi.fn(), moveProjectsToFolder: vi.fn(async () => undefined) }));
vi.mock("@/lib/api/pipeline", () => ({ getProgress: vi.fn(async () => ({ data: null, error: null })) }));
// Vai trò trong tổ chức đang mở — mặc định chưa biết (null) ⇒ trang coi như được soạn
const activeOrg = vi.hoisted(() => ({ current: null as { id: string; name: string; role: "lead" | "analyst" | "viewer" } | null }));
vi.mock("@/lib/hooks/use-active-org", () => ({ useActiveOrganization: () => activeOrg.current }));
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
  renderWithIntl(
    <ProjectsProvider>
      <AppShell user={{ name: "Test", email: "test@flintflow.test", isAdmin: false }} sidebar={null}>
        <HomePage />
      </AppShell>
    </ProjectsProvider>
  );

const ok = (data: unknown) => ({ data, error: null }) as never;

/**
 * BE giả cho `GET /projects?page=…` (FLF-404): lọc trạng thái / nguồn / thư mục, tìm tên, sắp xếp, cắt trang — đúng như
 * `project.service.listProjectsPage`, để các tình huống của dashboard giữ nguyên ý nghĩa khi việc lọc chuyển sang BE.
 */
let db: Project[] = [];
const serve = (projects: Project[]) => {
  db = projects;
};
const fakeListProjectsPage = async (p: ListProjectsPageParams) => {
  const dateKey = p.sort === "updated" ? "updatedAt" : p.sort === "opened" ? "lastOpenedAt" : "createdAt";
  const time = (x: Project) => {
    const v = x[dateKey as keyof Project] as string | null | undefined;
    return v ? new Date(v).getTime() : -Infinity;
  };
  const matched = db
    .filter(
      (x) =>
        (!p.status || x.status === p.status) &&
        (!p.mode || x.mode === p.mode) &&
        (!p.q || x.name.toLocaleLowerCase("vi").includes(p.q.toLocaleLowerCase("vi"))) &&
        (p.folder === undefined || (p.folder === "none" ? !x.folderId : x.folderId === p.folder))
    )
    .sort((a, b) => time(b) - time(a));
  return {
    items: matched.slice((p.page - 1) * p.limit, p.page * p.limit),
    meta: { page: p.page, limit: p.limit, total: matched.length, totalPages: Math.max(1, Math.ceil(matched.length / p.limit)) },
  };
};
/** Lời gọi danh sách của dashboard (không tính hai lời gọi tóm tắt của `ProjectsProvider`). */
const listCalls = () => vi.mocked(listProjectsPage).mock.calls.map(([params]) => params).filter((params) => params.limit === 24);

/** Chọn một mục trong bộ lọc (FilterSelect tự dựng): mở combobox rồi chọn option theo nhãn. */
const pickFilter = (name: string, option: string) => {
  fireEvent.click(screen.getByRole("combobox", { name }));
  fireEvent.mouseDown(screen.getByRole("option", { name: option }));
};

describe("Project Dashboard", () => {
  beforeEach(() => {
    push.mockReset();
    activeOrg.current = null;
    vi.mocked(listProjectsPage).mockReset().mockImplementation(fakeListProjectsPage);
    serve([]);
    vi.mocked(createProjectFrom).mockReset();
    vi.mocked(listFolders).mockReset().mockResolvedValue(ok([]));
  });

  it("đang tải ⇒ skeleton, không hiện trạng thái rỗng", () => {
    vi.mocked(listProjectsPage).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getAllByTestId("project-skeleton")).toHaveLength(6);
    expect(screen.queryByText("Bắt đầu dự án SRS đầu tiên")).toBeNull();
    expect(screen.queryByText("Không có dự án khớp bộ lọc")).toBeNull();
  });

  it("chưa có dự án ⇒ hộp Tạo dự án hai ô (SRS + tài liệu tham khảo) ngay trên trang; tạo xong vào dự án ngay, không tải lại danh sách (lượt tải lại chen với lượt tải file SRS)", async () => {
    vi.mocked(createProjectFrom).mockResolvedValue(ok(project("p9")));
    renderPage();

    expect(await screen.findByText("Bắt đầu dự án SRS đầu tiên")).toBeInTheDocument();
    const callsBefore = vi.mocked(listProjectsPage).mock.calls.length;
    // Không còn câu hỏi Dự án mới / có sẵn — chỉ hai ô tải file
    expect(screen.queryByRole("radiogroup", { name: "Bạn bắt đầu từ đâu?" })).toBeNull();
    expect(screen.getByRole("heading", { name: "SRS" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tài liệu tham khảo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Bắt đầu/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/p9"));
    expect(createProjectFrom).toHaveBeenCalledWith({ name: "Dự án chưa đặt tên", has_srs_file: false, documentLanguage: "vi" });
    expect(listProjectsPage).toHaveBeenCalledTimes(callsBefore);
  });

  it("có dự án ⇒ lưới đúng số card; lọc theo nguồn và trạng thái", async () => {
    serve([project("a", { mode: "import" }), project("b"), project("c", { status: "archived" })]);
    renderPage();

    expect(await screen.findByRole("link", { name: /Dự án a/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dự án b/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dự án c/ })).toBeNull();
    await waitFor(() => expect(getProgress).toHaveBeenCalled());

    pickFilter("Nguồn", "SRS có sẵn");
    await waitFor(() => expect(screen.queryByRole("link", { name: /Dự án b/ })).toBeNull());
    expect(listCalls().at(-1)).toMatchObject({ page: 1, status: "active", mode: "import", folder: "none" });

    pickFilter("Nguồn", "Tất cả");
    pickFilter("Trạng thái", "Lưu trữ");
    expect(await screen.findByRole("link", { name: /Dự án c/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dự án a/ })).toBeNull();
  });

  it("lọc ra rỗng ⇒ empty state riêng, Xoá bộ lọc đưa về danh sách", async () => {
    serve([project("a")]);
    renderPage();
    await screen.findByRole("link", { name: /Dự án a/ });

    // Tìm chạy ở BE (sau khi dừng gõ) — gửi đúng từ khoá, tìm cả trong thư mục
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm dự án theo tên" }), { target: { value: "không khớp" } });
    expect(await screen.findByText("Không có dự án khớp bộ lọc")).toBeInTheDocument();
    expect(listCalls().at(-1)).toMatchObject({ q: "không khớp", folder: undefined });
    expect(screen.queryByText("Bắt đầu dự án SRS đầu tiên")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xoá bộ lọc" }));
    expect(await screen.findByRole("link", { name: /Dự án a/ })).toBeInTheDocument();
  });

  it("chỉ còn dự án lưu trữ ⇒ không hiện onboarding nhưng có sẵn form tạo dự án, vẫn mở được lưu trữ", async () => {
    serve([project("c", { status: "archived" })]);
    renderPage();

    expect(await screen.findByText("Chưa có dự án đang làm")).toBeInTheDocument();
    expect(screen.queryByText("Bắt đầu dự án SRS đầu tiên")).toBeNull();
    // Hộp Tạo dự án ngay trong vùng trống, không phải mở dialog
    expect(screen.getByRole("heading", { name: "SRS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem lưu trữ" }));
    expect(await screen.findByRole("link", { name: /Dự án c/ })).toBeInTheDocument();
  });

  it("hàng Thư mục: bấm thư mục ⇒ chỉ dự án bên trong, breadcrumb đổi, quay lại được", async () => {
    serve([project("a", { folderId: "f1" }), project("b")]);
    vi.mocked(listFolders).mockResolvedValue(
      ok([{ _id: "f1", name: "Khách A", color: "blue", projectCount: 1, createdAt: "", updatedAt: "" }])
    );
    renderPage();

    const folders = await screen.findByRole("region", { name: /Thư mục/ });
    expect(within(folders).getByRole("button", { name: /Thư mục mới/ })).toBeInTheDocument();
    fireEvent.click(within(folders).getByRole("button", { name: /^Khách A/ }));

    expect(await screen.findByRole("link", { name: /Dự án a/ })).toBeInTheDocument();
    expect(listCalls().at(-1)).toMatchObject({ folder: "f1", sort: "created" });
    expect(screen.queryByRole("link", { name: /Dự án b/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /^Thư mục/ })).toBeNull();
    expect(screen.getByText("Khách A", { selector: "[aria-current='page']" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả dự án" }));
    expect(await screen.findByRole("link", { name: /Dự án b/ })).toBeInTheDocument();
  });

  it("tab Tất cả ẩn dự án trong thư mục; tab Dự án hiện tất cả kèm chip thư mục, chia vùng thời gian", async () => {
    const now = new Date().toISOString();
    serve([project("a", { folderId: "f1", updatedAt: now }), project("b", { updatedAt: "2020-01-01T00:00:00Z" })]);
    vi.mocked(listFolders).mockResolvedValue(
      ok([{ _id: "f1", name: "Khách A", color: "blue", projectCount: 1, createdAt: "", updatedAt: "" }])
    );
    renderPage();

    expect(await screen.findByRole("link", { name: /Dự án b/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dự án a/ })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /^Dự án/ }));
    expect(await screen.findByRole("link", { name: /Dự án a/ })).toHaveTextContent("Khách A");
    // Tab Dự án: mọi thư mục, BE sắp theo mốc đang chọn để vùng thời gian nối tiếp được giữa các trang
    expect(listCalls().at(-1)).toMatchObject({ folder: undefined, sort: "updated" });
    expect(screen.getByRole("heading", { name: "Hôm nay" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cũ hơn" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Thư mục/ })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Sắp xếp" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^Thư mục/ }));
    expect(screen.queryByRole("link", { name: /Dự án/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Khách A/ })).toBeInTheDocument();
  });

  it("thả card dự án vào thẻ thư mục ⇒ chuyển rồi tải lại", async () => {
    serve([project("a")]);
    vi.mocked(listFolders).mockResolvedValue(ok([{ _id: "f1", name: "Khách A", color: "blue", projectCount: 0, createdAt: "", updatedAt: "" }]));
    renderPage();
    await screen.findByRole("link", { name: /Dự án a/ });
    const before = listCalls().length;

    const folder = screen.getByRole("button", { name: /^Khách A/ }).closest("article") as HTMLElement;
    const dataTransfer = { types: ["application/x-flintflow-project"], getData: () => "a", dropEffect: "none" };
    fireEvent.dragOver(folder, { dataTransfer });
    fireEvent.drop(folder, { dataTransfer });

    await waitFor(() => expect(moveProjectToFolder).toHaveBeenCalledWith("a", "f1"));
    // Tải lại danh sách từ trang 1 (chuyển dự án làm lệch ranh giới các trang đã tải)
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    expect(listCalls().at(-1)).toMatchObject({ page: 1 });
  });

  it("trong thư mục: chọn nhiều ⇒ đưa cả nhóm ra ngoài một lượt, xong thì thoát chế độ chọn", async () => {
    const inFolder = { folderId: "f1" };
    serve([project("a", inFolder), project("b", inFolder)]);
    vi.mocked(listFolders).mockResolvedValue(ok([{ _id: "f1", name: "Khách A", color: "blue", projectCount: 2, createdAt: "", updatedAt: "" }]));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /^Khách A/ }));
    await screen.findByRole("link", { name: /Dự án a/ });
    const before = listCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "Chọn" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn dự án Dự án a" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn dự án Dự án b" }));
    expect(screen.getByText("Đã chọn 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Để ra ngoài" }));
    await waitFor(() =>
      expect(moveProjectsToFolder).toHaveBeenCalledWith(
        [expect.objectContaining({ _id: "a" }), expect.objectContaining({ _id: "b" })],
        null
      )
    );
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    await waitFor(() => expect(screen.getByRole("button", { name: "Chọn" })).toBeInTheDocument());
  });

  it("ngoài thư mục: chọn nhiều ⇒ khoá nút đưa ra ngoài, vẫn mở được dialog chuyển vào", async () => {
    serve([project("a")]);
    vi.mocked(listFolders).mockResolvedValue(ok([{ _id: "f1", name: "Khách A", color: "blue", projectCount: 0, createdAt: "", updatedAt: "" }]));
    renderPage();
    await screen.findByRole("link", { name: /Dự án a/ });

    fireEvent.click(screen.getByRole("button", { name: "Chọn" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn dự án Dự án a" }));

    expect(screen.getByRole("button", { name: "Để ra ngoài" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển vào thư mục" }));
    expect(screen.getByRole("dialog", { name: "Chuyển vào thư mục" })).toBeInTheDocument();
  });

  it('"+ Dự án mới" mở dialog chứa cùng hộp hai ô; Huỷ không tạo gì', async () => {
    serve([project("a")]);
    renderPage();
    await screen.findByRole("link", { name: /Dự án a/ });

    fireEvent.click(screen.getByRole("button", { name: /Dự án mới|Mới/ }));
    const dialog = screen.getByRole("dialog", { name: "Tạo dự án mới" });
    expect(within(dialog).getByRole("heading", { name: "SRS" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Tài liệu tham khảo" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(createProjectFrom).not.toHaveBeenCalled();
  });
});

describe("Project Dashboard - cuộn tải dần (FLF-404)", () => {
  /** IntersectionObserver giả: giữ callback để test tự "cuộn tới mốc cuối". */
  let reachEnd: (() => void) | null = null;
  class FakeObserver {
    constructor(private cb: IntersectionObserverCallback) {}
    observe() {
      reachEnd = () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    disconnect() {
      reachEnd = null;
    }
  }

  beforeEach(() => {
    activeOrg.current = null;
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.mocked(listProjectsPage).mockReset().mockImplementation(fakeListProjectsPage);
    vi.mocked(listFolders).mockReset().mockResolvedValue(ok([]));
    // 30 dự án tạo cách nhau một ngày ⇒ trang 1 có 24 thẻ mới nhất, trang 2 có 6 thẻ cũ nhất
    serve(Array.from({ length: 30 }, (_, i) => project(`p${String(i).padStart(2, "0")}`, { createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    reachEnd = null;
  });

  it("trang đầu 24 thẻ, số đếm là tổng của BE; cuộn tới cuối ⇒ nối trang 2, hết trang thì thôi", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: /Dự án p29/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dự án p05/ })).toBeNull();
    expect(screen.getAllByRole("link", { name: /^Dự án p/ })).toHaveLength(24);
    expect(within(screen.getByRole("region", { name: /Dự án ngoài thư mục/ })).getByText("30")).toBeInTheDocument();

    await waitFor(() => expect(reachEnd).not.toBeNull());
    act(() => reachEnd!());
    expect(await screen.findByRole("link", { name: /Dự án p00/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Dự án p/ })).toHaveLength(30);
    expect(listCalls().at(-1)).toMatchObject({ page: 2, limit: 24 });
    await waitFor(() => expect(reachEnd).toBeNull());
    // Vẽ 30 thẻ: chạy chung cả bộ test thì chậm hơn mặc định 5s
  }, 15_000);
});

describe("Project Dashboard - Viewer chỉ xem", () => {
  const FOLDER = { _id: "f1", name: "Khách A", color: "blue", projectCount: 0, createdAt: "", updatedAt: "" };

  beforeEach(() => {
    vi.mocked(listProjectsPage).mockReset().mockImplementation(fakeListProjectsPage);
    serve([]);
    vi.mocked(moveProjectToFolder).mockClear();
    vi.mocked(listFolders).mockReset().mockResolvedValue(ok([]));
    activeOrg.current = { id: "o1", name: "Org", role: "viewer" };
  });

  it("tổ chức chưa có dự án ⇒ câu giải thích thay cho form tạo dự án", async () => {
    renderPage();

    expect(await screen.findByText("Tổ chức chưa có dự án nào")).toBeInTheDocument();
    expect(screen.getByText(/Bạn đang xem với vai trò Viewer/)).toBeInTheDocument();
    expect(screen.queryByText("Bắt đầu dự án SRS đầu tiên")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("có dự án ⇒ mở xem được nhưng không có Dự án mới, Chọn, Thư mục mới, menu ⋮ hay kéo thả", async () => {
    serve([project("a")]);
    vi.mocked(listFolders).mockResolvedValue(ok([FOLDER]));
    renderPage();

    expect(await screen.findByRole("link", { name: /Dự án a/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dự án mới/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Chọn" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Thư mục mới/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tuỳ chọn cho Dự án a" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tuỳ chọn cho thư mục Khách A" })).toBeNull();

    const folder = screen.getByRole("button", { name: /^Khách A/ }).closest("article") as HTMLElement;
    const dataTransfer = { types: ["application/x-flintflow-project"], getData: () => "a", dropEffect: "none" };
    fireEvent.dragOver(folder, { dataTransfer });
    fireEvent.drop(folder, { dataTransfer });
    expect(moveProjectToFolder).not.toHaveBeenCalled();
  });

  it("Analyst vẫn có đủ thao tác", async () => {
    activeOrg.current = { id: "o1", name: "Org", role: "analyst" };
    serve([project("a")]);
    renderPage();

    expect(await screen.findByRole("link", { name: /Dự án a/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dự án mới/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tuỳ chọn cho Dự án a" })).toBeInTheDocument();
  });
});
