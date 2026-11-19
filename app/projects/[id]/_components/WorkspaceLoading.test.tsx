import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { WorkspaceMemory } from "@/lib/workspace-memory";
import { WorkspaceBootProvider, type WorkspaceBoot } from "../../workspace-boot";
import WorkspaceLoading from "./WorkspaceLoading";

vi.mock("next/navigation", () => ({ usePathname: () => "/projects/p1", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const memory = (patch: Partial<WorkspaceMemory> = {}): WorkspaceMemory => ({
  id: "p1",
  mode: "fpt",
  name: "Shop online",
  phase: "B-0",
  pane: "brief",
  review: "balanced",
  ...patch,
});

const renderLoading = (boot: Partial<WorkspaceBoot>, viewer = false) =>
  renderWithIntl(
    <WorkspaceBootProvider value={{ memory: null, importPendingIds: [], profileName: null, orgRole: "lead", ...boot }}>
      <WorkspaceLoading projectId="p1" viewer={viewer} />
    </WorkspaceBootProvider>
  );

describe("WorkspaceLoading - workspace lúc đang tải", () => {
  it("dự án soạn theo quy trình (bản nhớ): rail có tên giai đoạn, header có Kiểm & chốt, khung chat + ô nhập thật", () => {
    renderLoading({ memory: memory() });
    expect(screen.getByText("Shop online")).toBeInTheDocument();
    // Nút trên header + giai đoạn cùng tên trên rail
    expect(screen.getAllByRole("button", { name: /Kiểm & chốt/ }).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("link", { name: "Gap report" })).toBeNull();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("dự án nhập SRS (bản nhớ): không rail; header có Gap report; panel Kiểm & chốt có tiêu đề", () => {
    renderLoading({ memory: memory({ mode: "import", pane: "document" }) });
    expect(screen.getByText("Hỏi đáp & lệnh sửa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gap report" })).toHaveAttribute("href", "/projects/p1?panel=gap");
    expect(screen.getByRole("complementary", { name: "Kiểm & chốt" })).toBeInTheDocument();
    // Không rail; mode 1 chỉ có một nút "Kiểm & chốt" (chính nút mở panel), không có nút kiểm tra riêng như dự án AI soạn
    expect(screen.queryAllByRole("button", { name: /Kiểm & chốt/ })).toHaveLength(1);
  });

  it("bản nhớ của dự án khác ⇒ không dùng tên của nó", () => {
    renderLoading({ memory: memory({ id: "khac", name: "Dự án khác" }) });
    expect(screen.queryByText("Dự án khác")).toBeNull();
  });

  it("đã biết là Viewer ⇒ không có ô nhập", () => {
    renderLoading({ memory: memory() }, true);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
