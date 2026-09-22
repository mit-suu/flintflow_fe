import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import WorkspaceHeader from "../WorkspaceHeader";
import type { Project } from "@/types/project";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PROJECT = { _id: "p1", name: "FlintFlow", domain: "SaaS", status: "active" } as Project;

describe("WorkspaceHeader", () => {
  it("badge baseline lấy từ phiên bản baseline của Spine", () => {
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} baselineVersion="v1.0-conditional" onLogout={() => {}} />);
    expect(screen.getByText("Baseline v1.0-conditional")).toBeInTheDocument();
  });

  it("chưa ký baseline thì không hiện badge", () => {
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} onLogout={() => {}} />);
    expect(screen.queryByText(/^Baseline/)).not.toBeInTheDocument();
  });

  it("Export và mở rộng trang gọi callback; đăng xuất nằm trong menu tài khoản", async () => {
    const onExportClick = vi.fn();
    const onEnterFocus = vi.fn();
    const onLogout = vi.fn();
    renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} onExportClick={onExportClick} onEnterFocus={onEnterFocus} onLogout={onLogout} />);
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    fireEvent.click(screen.getByRole("button", { name: /Mở rộng trang/ }));
    expect(onExportClick).toHaveBeenCalledTimes(1);
    expect(onEnterFocus).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Tài khoản" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Đăng xuất" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("chỉ hiện nút chạy bước khi có step chạy được", () => {
    const onRun = vi.fn();
    const { rerender } = renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} onLogout={() => {}} />);
    expect(screen.queryByRole("button", { name: /Chạy bước này/ })).not.toBeInTheDocument();
    rerender(<WorkspaceHeader project={PROJECT} user={null} onRunCurrentStep={onRun} onLogout={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Chạy bước này/ }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  // L9 (gặp thật 2026-09-20): nút từng luôn chạy `current_step` — quay về bước cũ bấm chạy lại ra bản accept của
  // bước SAU. Khi dời nút từ PhaseHeader sang header mới (FLF-197) phải giữ: gọi tên đúng bước đang xem.
  it("nút chạy gọi tên bước đang xem, không phải bước hiện tại (L9)", () => {
    const onRun = vi.fn();
    renderWithIntl(
      <WorkspaceHeader project={PROJECT} user={null} runnableStep="S-3.1" currentStep="S-4.2" onRunCurrentStep={onRun} onLogout={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Chạy bước S-3.1" }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /S-4\.2/ }), "không có nút nào chạy bước hiện tại").not.toBeInTheDocument();
  });

  it("đang xem bước khác bước hiện tại ⇒ có nút quay về (L9)", () => {
    const onBack = vi.fn();
    const { rerender } = renderWithIntl(<WorkspaceHeader project={PROJECT} user={null} currentStep="S-4.2" onLogout={() => {}} />);
    expect(screen.queryByRole("button", { name: /Về bước/ })).not.toBeInTheDocument();
    rerender(<WorkspaceHeader project={PROJECT} user={null} currentStep="S-4.2" onBackToCurrent={onBack} onLogout={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Về bước S-4.2" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // L2: reload giữa lúc chạy ⇒ lượt cũ ở BE chưa dứt; bấm nữa là STEP_NOT_RUNNABLE. Khoá nút và nói lý do.
  it("BE báo bước đang chạy dở ⇒ nút khoá, nói đang chạy (L2)", () => {
    renderWithIntl(
      <WorkspaceHeader project={PROJECT} user={null} runnableStep="S-3.1" stepRunningElsewhere onRunCurrentStep={vi.fn()} onLogout={() => {}} />
    );
    const button = screen.getByRole("button", { name: "Đang chạy" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", expect.stringContaining("chưa dứt"));
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
