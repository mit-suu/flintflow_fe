import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "@/components/layout/AppShell";
import AppSidebar from "@/components/layout/AppSidebar";
import { listProjects } from "@/lib/api/projects";
import { listFolders } from "@/lib/api/folders";
import { ProjectsProvider } from "@/lib/hooks/use-projects";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { Locale } from "@/lib/i18n";
import type { Project } from "@/types/project";
import HomePage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/home" }));
vi.mock("@/lib/api/projects", () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  renameProject: vi.fn(),
  deleteProject: vi.fn(),
  setDocumentLanguage: vi.fn(),
  moveProjectToFolder: vi.fn(),
}));
vi.mock("@/lib/api/folders", () => ({ listFolders: vi.fn() }));
vi.mock("@/lib/api/pipeline", () => ({ getProgress: vi.fn(async () => ({ data: null, error: null })) }));
vi.mock("@/lib/api/change-requests", () => ({ listCrs: vi.fn(async () => ({ data: [], error: null })) }));
vi.mock("@/lib/api/billing", () => ({ fetchBalance: vi.fn(async () => ({ balance: 1200, planLabel: "Free" })) }));
vi.mock("@/lib/api/notifications", () => ({ fetchUnreadCount: vi.fn(async () => 0), onNotificationsChanged: () => () => {} }));

// Tên dự án là dữ liệu của user ⇒ không dịch; đặt tên không dấu để phép thử "còn tiếng Việt không" đo đúng chữ UI.
const PROJECT: Project = {
  _id: "p1",
  name: "Lumen",
  status: "active",
  mode: "fpt",
  import_state: null,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

const user = { name: "Mai", email: "mai@studio.vn", isAdmin: false };

const renderDashboard = (locale: Locale) =>
  renderWithIntl(
    <ProjectsProvider>
      <AppShell sidebar={<AppSidebar user={user} />}>
        <HomePage />
      </AppShell>
    </ProjectsProvider>,
    locale
  );

describe("Dashboard — song ngữ", () => {
  beforeEach(() => {
    vi.mocked(listProjects).mockResolvedValue({ data: [PROJECT], error: null } as never);
    vi.mocked(listFolders).mockResolvedValue({ data: [], error: null } as never);
  });

  it("vi giữ nguyên nhãn cũ của dashboard và sidebar", async () => {
    renderDashboard("vi");
    await waitFor(() => expect(screen.getByRole("link", { name: "Dự án" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Dự án mới/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Thư mục/ })).toBeInTheDocument();
  });

  it("en dịch dashboard và sidebar, không còn chữ tiếng Việt nào", async () => {
    const { container } = renderDashboard("en");
    await waitFor(() => expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /New project/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Folders/ })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("FLF-265: en — form tạo dự án và menu card có nhãn ngôn ngữ tài liệu tiếng Anh, mặc định English", async () => {
    renderDashboard("en");
    await waitFor(() => expect(screen.getByRole("link", { name: "Projects" })).toBeInTheDocument());

    fireEvent.click(await screen.findByRole("button", { name: "Options for Lumen" }));
    expect(screen.getByRole("menuitem", { name: "Document language" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Document language" }));
    const languageDialog = await screen.findByRole("dialog");
    expect(languageDialog).toHaveTextContent("diagrams stay in English");
    expect(vietnameseLeftovers(languageDialog)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /New project/ }));
    const dialog = await screen.findByRole("dialog");
    expect(screen.getByRole("radiogroup", { name: "Document language" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Vietnamese" })).toHaveAttribute("aria-checked", "false");
    expect(vietnameseLeftovers(dialog)).toEqual([]);
  });
});
