import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import WorkspaceHeader from "../WorkspaceHeader";
import type { Project } from "@/types/project";

// Header có nút đổi ngôn ngữ (LocaleSwitcher) - dùng router để làm mới trang sau khi đổi
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PROJECT = { _id: "p1", name: "FlintFlow", domain: "SaaS", status: "active" } as Project;

describe("WorkspaceHeader", () => {
  it("chip trạng thái chốt bản hiện nhãn nơi gọi dựng", () => {
    renderWithIntl(
      <WorkspaceHeader project={PROJECT} user={null} baselineStatus={{ label: "Baseline v1.0", tone: "success" }} onLogout={() => {}} />
    );
    expect(screen.getByText("Baseline v1.0")).toBeInTheDocument();
  });

  it("chip bấm được thì mở panel Kiểm & chốt", () => {
    const onVerifyClick = vi.fn();
    renderWithIntl(
      <WorkspaceHeader
        project={PROJECT}
        user={null}
        baselineStatus={{ label: "1 bản chờ bạn duyệt", tone: "warning" }}
        onVerifyClick={onVerifyClick}
        onLogout={() => {}}
      />
    );
    fireEvent.click(screen.getByText("1 bản chờ bạn duyệt"));
    expect(onVerifyClick).toHaveBeenCalled();
  });

  it("chưa nộp và chưa ký baseline thì không hiện chip", () => {
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} onLogout={() => {}} />);
    expect(screen.queryByText(/^Baseline/)).not.toBeInTheDocument();
  });

  it("Export gọi callback; đăng xuất nằm trong menu tài khoản", async () => {
    const onExportClick = vi.fn();
    const onLogout = vi.fn();
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} onExportClick={onExportClick} onLogout={onLogout} />);
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    expect(onExportClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Tài khoản" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Đăng xuất" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("nút Xem & comment dẫn tới bản đọc của dự án (UC-49)", () => {
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} onLogout={() => {}} />);
    expect(screen.getByRole("link", { name: "Xem & comment" })).toHaveAttribute("href", "/projects/p1/view");
  });

  it("chưa tải xong project ⇒ chưa có nút Xem & comment", () => {
    renderWithIntl(<WorkspaceHeader project={null} user={null} onLogout={() => {}} />);
    expect(screen.queryByRole("link", { name: "Xem & comment" })).not.toBeInTheDocument();
  });

  // FLF-221: gõ chat là chạy — header không còn nút chạy bước nào
  it("không có nút chạy bước", () => {
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} currentStep="Danh sách màn hình" onLogout={() => {}} />);
    expect(screen.queryByRole("button", { name: /Chạy/ })).not.toBeInTheDocument();
  });

  it("đang xem bước khác bước hiện tại ⇒ có nút quay về (L9)", () => {
    const onBack = vi.fn();
    const { rerender } = renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} currentStep="Danh sách màn hình" onLogout={() => {}} />);
    expect(screen.queryByRole("button", { name: /Về bước/ })).not.toBeInTheDocument();
    rerender(<WorkspaceHeader project={PROJECT} user={null} currentStep="Danh sách màn hình" onBackToCurrent={onBack} onLogout={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Về bước Danh sách màn hình" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("rail tiến độ ẩn ⇒ đầu header có nút hiện lại", () => {
    const onShowProgress = vi.fn();
    const { rerender } = renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} onLogout={() => {}} />);
    expect(screen.queryByRole("button", { name: "Hiện tiến độ" })).not.toBeInTheDocument();
    rerender(<WorkspaceHeader project={PROJECT} user={null} progressHidden onShowProgress={onShowProgress} onLogout={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Hiện tiến độ" }));
    expect(onShowProgress).toHaveBeenCalledTimes(1);
  });
});

describe("WorkspaceHeader - menu ⋯ và nút panel", () => {
  it("menu ⋯ có Đổi mẫu; mục bị chặn mờ đi và ghi lý do ngay dưới", async () => {
    const onSelect = vi.fn();
    const { rerender } = renderWithIntl(
      <WorkspaceHeader project={PROJECT} user={null} moreItems={[{ label: "Đổi mẫu", icon: "file-template", onSelect }]} onLogout={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Thao tác khác" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Đổi mẫu" }));
    expect(onSelect).toHaveBeenCalledTimes(1);

    rerender(
      <WorkspaceHeader
        project={PROJECT}
        user={null}
        moreItems={[{ label: "Đổi mẫu", icon: "file-template", onSelect, disabled: true, hint: "Chưa có baseline." }]}
        onLogout={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Thao tác khác" }));
    const item = await screen.findByRole("menuitem", { name: /Đổi mẫu/ });
    expect(item).toBeDisabled();
    expect(item).toHaveTextContent("Chưa có baseline.");
  });

  it("không có mục nào ⇒ không có nút ⋯", () => {
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} moreItems={[]} onLogout={() => {}} />);
    expect(screen.queryByRole("button", { name: "Thao tác khác" })).not.toBeInTheDocument();
  });

  it("nút Hồ sơ không có badge số chờ quyết; mode 1 đổi nhãn + icon thành Kiểm & chốt", () => {
    const { rerender } = renderWithIntl(
      <WorkspaceHeader project={PROJECT} user={null} onToolsClick={() => {}} toolsLabel="Hồ sơ dự án" toolsShortLabel="Hồ sơ" onLogout={() => {}} />
    );
    const btn = screen.getByRole("button", { name: "Hồ sơ" });
    expect(btn).toHaveAttribute("title", "Hồ sơ dự án");
    expect(btn.textContent).toBe("Hồ sơ");

    rerender(
      <WorkspaceHeader project={PROJECT} user={null} onToolsClick={() => {}} toolsLabel="Kiểm & chốt" toolsShortLabel="Kiểm & chốt" toolsIcon="shield-check" onLogout={() => {}} />
    );
    expect(screen.getByRole("button", { name: "Kiểm & chốt" })).toBeInTheDocument();
  });
});
