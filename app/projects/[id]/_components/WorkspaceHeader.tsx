"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import DropdownMenu from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";

interface WorkspaceHeaderProps {
  project: Project | null;
  user: User | null;
  /** Phiên bản baseline mới nhất trong `spine.baselines[]`; `null` khi chưa ký baseline. */
  baselineVersion?: string | null;
  /** Rail tiến độ đang ẩn ⇒ đầu header có nút hiện lại + logo (logo nằm trên rail khi rail mở). */
  progressHidden?: boolean;
  onShowProgress?: () => void;
  /** Có ⇒ hiện nút chạy bước (bước **đang xem** — `runnableStep`, không nhất thiết là bước hiện tại). */
  onRunCurrentStep?: () => void;
  /** Bước nút "Chạy" sẽ chạy — là bước ĐANG XEM, có thể khác bước hiện tại khi người dùng xem lại bước cũ (L9). */
  runnableStep?: string | null;
  /** Bước hiện tại của tiến độ — để nút "Về" nói rõ quay về đâu. */
  currentStep?: string | null;
  /** Đang xem bước khác bước hiện tại ⇒ cho đường quay lại (L9). */
  onBackToCurrent?: () => void;
  /** BE báo step đang chạy dở ở request khác (lần chạy trước chưa dứt sau khi reload — L2). */
  stepRunningElsewhere?: boolean;
  busy?: boolean;
  onExportClick?: () => void;
  /** Nút riêng của chế độ (mode 1: mở popup Gap report / Change request), đứng trước Export. */
  actions?: ReactNode;
  /** Mở rộng trang: ẩn header và khối tiến độ. */
  onEnterFocus?: () => void;
  /** Mở/đóng panel Công cụ (thuật ngữ, đã chốt, hàng đợi màn, lịch sử sửa…) — thay rail icon bên phải cũ. */
  onToolsClick?: () => void;
  toolsActive?: boolean;
  toolsLabel?: string;
  onLogout: () => void;
}

/**
 * Thanh trên của workspace, cố ý ít chữ: breadcrumb `Dự án / tên` (+ baseline) · chạy bước, Export, mở rộng trang,
 * menu tài khoản (credits, đăng xuất). Tiến độ giai đoạn/bước nằm ở rail trái (`WorkspaceProgressRail`).
 */
export default function WorkspaceHeader({
  project,
  user,
  baselineVersion = null,
  progressHidden = false,
  onShowProgress,
  onRunCurrentStep,
  runnableStep = null,
  currentStep = null,
  onBackToCurrent,
  stepRunningElsewhere = false,
  busy = false,
  onExportClick,
  actions,
  onEnterFocus,
  onToolsClick,
  toolsActive = false,
  toolsLabel = "Công cụ",
  onLogout,
}: WorkspaceHeaderProps) {
  return (
    <header className="shrink-0 bg-surface-container-lowest h-[58px] px-4 flex items-center gap-3">
      {progressHidden && (
        <div className="shrink-0 flex items-center gap-2">
          <IconButton icon="sidebar" label="Hiện tiến độ" onClick={onShowProgress} aria-controls="workspace-progress" aria-expanded={false} />
          <Logo variant="icon" sizeClassName="w-5 h-5" theme="light" href="/home" />
        </div>
      )}
      <nav aria-label="Breadcrumb" className="flex-1 min-w-0 flex items-center gap-1 text-[13px]">
        <Link href="/home" className="hidden sm:inline text-on-surface-muted hover:text-on-surface font-medium transition-colors">
          Dự án
        </Link>
        <span aria-hidden className="hidden sm:inline text-on-surface-subtle px-0.5">
          /
        </span>
        <span aria-current="page" className="font-bold text-on-surface truncate">{project?.name || "Dự án SRS"}</span>
        {baselineVersion && (
          <Badge tone="success" dot className="hidden md:inline-flex ml-1.5">
            Baseline {baselineVersion}
          </Badge>
        )}
      </nav>

      <div className="shrink-0 flex items-center justify-end gap-1.5">
        {onBackToCurrent && currentStep && (
          <Button
            size="sm"
            variant="ghost"
            icon="caret-left"
            onClick={onBackToCurrent}
            title={`Quay lại bước hiện tại (${currentStep})`}
            aria-label={`Về bước ${currentStep}`}
            className="shrink-0"
          >
            <span className="hidden sm:inline">Về {currentStep}</span>
          </Button>
        )}
        {onRunCurrentStep && (
          // Gọi tên bước sẽ chạy: người dùng đang xem bước cũ thì nút chạy ĐÚNG bước đó, không phải bước hiện tại (L9)
          <Button
            size="sm"
            icon="play"
            onClick={onRunCurrentStep}
            disabled={busy || stepRunningElsewhere}
            title={stepRunningElsewhere ? "Lần chạy trước của bước này chưa dứt — chờ vài giây rồi thử lại" : runnableStep ? `Chạy ${runnableStep}` : undefined}
            aria-label={stepRunningElsewhere ? "Đang chạy" : runnableStep ? `Chạy bước ${runnableStep}` : "Chạy bước này"}
            className="shrink-0"
          >
            <span className="hidden sm:inline">{stepRunningElsewhere ? "Đang chạy…" : runnableStep ? `Chạy ${runnableStep}` : "Chạy bước này"}</span>
            <span className="sm:hidden">Chạy</span>
          </Button>
        )}
        {actions}
        {onToolsClick && (
          <Button
            size="sm"
            variant="ghost"
            icon="folder"
            onClick={onToolsClick}
            aria-pressed={toolsActive}
            title={toolsLabel}
            className={`shrink-0 ${toolsActive ? "bg-primary-soft text-primary-hover" : ""}`}
          >
            <span className="hidden md:inline">{toolsLabel === "Hồ sơ dự án" ? "Hồ sơ" : "Công cụ"}</span>
          </Button>
        )}
        <Button size="sm" variant="ghost" icon="export" onClick={onExportClick} title="Hoàn tất và xuất tài liệu SRS" className="shrink-0">
          <span className="hidden md:inline">Export</span>
        </Button>
        {onEnterFocus && <IconButton icon="expand" label="Mở rộng trang (ẩn thanh trên)" onClick={onEnterFocus} />}
        <DropdownMenu
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label="Tài khoản"
              title="Tài khoản"
              className="w-9 h-9 grid place-items-center rounded-control hover:bg-surface-container-high transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="w-7 h-7 rounded-full grid place-items-center text-[12px] font-semibold bg-primary-fixed text-primary">
                {user?.name ? user.name.charAt(0).toUpperCase() : <Icon name="user" size={14} />}
              </span>
            </button>
          )}
          header={
            user ? (
              <div className="flex flex-col gap-1.5 min-w-[200px]">
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-on-surface truncate">{user.name ?? user.email}</span>
                  {user.name && <span className="block text-[11px] text-on-surface-muted truncate">{user.email}</span>}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-on-surface">
                  <Icon name="wallet" size={14} className="text-primary" />
                  <span className="tabular-nums">{user.balance ?? 0}</span>
                  <span className="text-on-surface-muted font-medium">credits</span>
                </span>
              </div>
            ) : undefined
          }
          items={[{ label: "Đăng xuất", icon: "logout", tone: "danger", onSelect: onLogout }]}
        />
      </div>
    </header>
  );
}
