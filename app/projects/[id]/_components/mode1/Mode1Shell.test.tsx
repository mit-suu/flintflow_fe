/**
 * Khung chung của mọi trang mode 1 (V6: trước đây 0% coverage). Cái đáng kiểm là **khoá tab theo
 * `project.import_state` do BE trả** — FE không tự suy: chưa xong import thì tab Tài liệu & version phải là chữ chết,
 * không phải link bấm được. Gap report / Change request là popup trên màn tài liệu, không còn là tab.
 */
import { screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types/project";
import Mode1Shell from "./Mode1Shell";

const P = "650000000000000000000001";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "650000000000000000000001" }),
}));
// Đã đăng nhập: AuthGuard không gọi refresh
vi.mock("@/lib/auth", async (importOriginal) => ({ ...(await importOriginal<object>()), isAuthenticated: () => true }));

beforeAll(() => vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterAll(() => vi.unstubAllGlobals());

const project = (import_state: Project["import_state"]): Project =>
  ({ _id: P, name: "Lumen LMS", mode: "import", import_state }) as Project;

const nav = () => screen.getByRole("navigation", { name: "Mode 1" });
const tab = (label: string) => within(nav()).getByText(label);

const renderShell = (over: Partial<Parameters<typeof Mode1Shell>[0]> = {}) =>
  renderWithIntl(
    <Mode1Shell projectId={P} project={project("gap_review")} credits={42} active="document" {...over}>
      <p>nội dung trang</p>
    </Mode1Shell>
  );

describe("Mode1Shell", () => {
  it("import chưa xong ⇒ tab cần baseline bị khoá, chỉ Nhập SRS bấm được; không còn tab Gap report / Change request", () => {
    renderShell({ project: project("extracting"), active: "import" });

    expect(tab("Nhập SRS").closest("a"), "tab import luôn mở").toBeInTheDocument();
    expect(within(nav()).queryByText("Gap report")).not.toBeInTheDocument();
    expect(within(nav()).queryByText("Change request")).not.toBeInTheDocument();
    for (const label of ["Tài liệu & version"]) {
      const el = tab(label);
      expect(el.closest("a"), `${label} chưa được là link`).toBeNull();
      expect(el).toHaveAttribute("aria-disabled", "true");
      expect(el).toHaveAttribute("title", expect.stringContaining("baseline"));
    }
  });

  it("import xong ⇒ mọi tab thành link đúng địa chỉ, tab đang mở có aria-current", () => {
    renderShell({ project: project("delivered"), active: "import" });

    expect(tab("Nhập SRS").closest("a")).toHaveAttribute("href", `/projects/${P}/import`);
    expect(tab("Tài liệu & version").closest("a")).toHaveAttribute("href", `/projects/${P}`);
    expect(tab("Nhập SRS").closest("a")).toHaveAttribute("aria-current", "page");
  });

  it("chưa tải được project ⇒ tab khoá, tên dự án là câu chờ, không vỡ", () => {
    renderShell({ project: null, credits: null });
    expect(screen.getByText("Đang tải…")).toBeInTheDocument();
    expect(tab("Tài liệu & version")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/… credits/)).toBeInTheDocument();
  });

  it("header hiện tên, nhãn mode và trạng thái import theo bảng nhãn", () => {
    renderShell({ project: project("extracting") });
    expect(screen.getByText("Lumen LMS")).toBeInTheDocument();
    expect(screen.getByText("Upload SRS có sẵn")).toBeInTheDocument();
    expect(screen.getByText("Đang trích field"), "nhãn tiếng Việt của import_state").toBeInTheDocument();
    expect(screen.getByText(/42 credits/)).toBeInTheDocument();
  });

  it("có error ⇒ hiện lỗi THAY cho nội dung, không để trang trắng", () => {
    renderShell({ error: "Không tìm thấy dự án" });
    expect(screen.getByText("Không tìm thấy dự án")).toBeInTheDocument();
    expect(screen.queryByText("nội dung trang")).not.toBeInTheDocument();
  });

  it("không có error ⇒ render children", () => {
    renderShell();
    expect(screen.getByText("nội dung trang")).toBeInTheDocument();
  });
});
