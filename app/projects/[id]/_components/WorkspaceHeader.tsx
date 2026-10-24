"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import CountBadge from "@/components/ui/CountBadge";
import DropdownMenu from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";

interface WorkspaceHeaderProps {
  project: Project | null;
  user: User | null;
  /**
   * Trạng thái chốt bản hiện trên breadcrumb: baseline đã ký, hoặc bản đang chờ duyệt / vừa bị từ chối.
   * `null` ⇒ không hiện chip. Chữ do nơi gọi dựng vì nó phụ thuộc vai trò người đang xem.
   */
  baselineStatus?: { label: string; tone: BadgeTone } | null;
  /** Rail tiến độ đang ẩn ⇒ đầu header có nút hiện lại + logo (logo nằm trên rail khi rail mở). */
  progressHidden?: boolean;
  onShowProgress?: () => void;
  /** Bước hiện tại của tiến độ — để nút "Về" nói rõ quay về đâu. */
  currentStep?: string | null;
  /** Đang xem bước khác bước hiện tại ⇒ cho đường quay lại (L9). */
  onBackToCurrent?: () => void;
  onExportClick?: () => void;
  /** Nút riêng của chế độ (mode 1: mở popup Gap report / Change request), đứng trước Export. */
  actions?: ReactNode;
  /** Mở rộng trang: ẩn header và khối tiến độ. */
  onEnterFocus?: () => void;
  /** Mở/đóng panel Công cụ (thuật ngữ, đã chốt, hàng đợi màn, lịch sử sửa…) — thay rail icon bên phải cũ. */
  onToolsClick?: () => void;
  toolsActive?: boolean;
  toolsLabel?: string;
  /** Chữ ngắn trên nút (màn rộng) — mặc định "Công cụ". */
  toolsShortLabel?: string;
  /** Số mục trong panel đang chờ user quyết — hiện thành badge trên nút, 0 thì không hiện. */
  toolsCount?: number;
  /**
   * Mở/đóng panel "Kiểm tra tài liệu" (cờ đỏ/vàng + chốt baseline). Trước đây panel này chỉ vào được
   * qua chip trên header pane tài liệu — mà chip đó ghi "Không có vấn đề" khi tài liệu sạch, đúng lúc
   * người dùng cần nút chốt baseline nhất thì lại không ai đoán ra. Nút ở đây luôn thấy, kể cả khi
   * đang ở màn Brief.
   */
  onVerifyClick?: () => void;
  verifyActive?: boolean;
  /** Số vấn đề đang chặn chốt bản — badge đỏ, 0 thì không hiện. */
  verifyCount?: number;
  onLogout: () => void;
}

/**
 * Thanh trên của workspace, cố ý ít chữ: breadcrumb `Dự án / tên` (+ baseline) · Export, mở rộng trang,
 * menu tài khoản (credits, đăng xuất). Tiến độ giai đoạn/bước nằm ở rail trái (`WorkspaceProgressRail`).
 */
export default function WorkspaceHeader({
  project,
  user,
  baselineStatus = null,
  progressHidden = false,
  onShowProgress,
  currentStep = null,
  onBackToCurrent,
  onExportClick,
  actions,
  onEnterFocus,
  onToolsClick,
  toolsActive = false,
  toolsLabel,
  toolsShortLabel,
  toolsCount = 0,
  onVerifyClick,
  verifyActive = false,
  verifyCount = 0,
  onLogout,
}: WorkspaceHeaderProps) {
  const t = useTranslations("workspace.header");
  const tools = toolsLabel ?? t("tools");
  return (
    <header className="shrink-0 bg-surface-container-lowest h-[58px] px-4 flex items-center gap-3">
      {progressHidden && (
        <div className="shrink-0 flex items-center gap-2">
          <IconButton icon="sidebar" label={t("showProgress")} onClick={onShowProgress} aria-controls="workspace-progress" aria-expanded={false} />
          <Logo variant="icon" sizeClassName="w-5 h-5" theme="light" href="/home" />
        </div>
      )}
      <nav aria-label={t("breadcrumb")} className="flex-1 min-w-0 flex items-center gap-1 text-body">
        <Link href="/home" className="hidden sm:inline text-on-surface-muted hover:text-on-surface font-medium transition-colors">
          {t("projects")}
        </Link>
        <span aria-hidden className="hidden sm:inline text-on-surface-subtle px-0.5">
          /
        </span>
        <span aria-current="page" className="font-bold text-on-surface truncate">{project?.name || t("untitled")}</span>
        {baselineStatus && (
          // Trạng thái chốt bản là thứ cả Lead lẫn Analyst cần thấy MỌI LÚC (có bản chờ mình duyệt không,
          // bản mình gửi bị từ chối chưa), nên nó ở ngay breadcrumb. Hành động thì nằm trong panel — bấm
          // chip là mở panel đó, khỏi phải nhớ nút nào mở cái gì.
          <button
            type="button"
            onClick={onVerifyClick}
            disabled={!onVerifyClick}
            title={onVerifyClick ? t("openVerify") : undefined}
            className="hidden md:inline-flex ml-1.5 shrink-0 rounded-full enabled:cursor-pointer enabled:hover:opacity-80 transition-opacity"
          >
            <Badge tone={baselineStatus.tone} dot>
              {baselineStatus.label}
            </Badge>
          </button>
        )}
      </nav>

      <div className="shrink-0 flex items-center justify-end gap-1.5">
        {onBackToCurrent && currentStep && (
          <Button
            size="sm"
            variant="ghost"
            icon="caret-left"
            onClick={onBackToCurrent}
            title={t("backTitle", { step: currentStep })}
            aria-label={t("backAria", { step: currentStep })}
            className="shrink-0"
          >
            <span className="hidden sm:inline">{t("back", { step: currentStep })}</span>
          </Button>
        )}
        {actions}
        {onVerifyClick && (
          <Button
            size="sm"
            variant="ghost"
            icon="shield-check"
            onClick={onVerifyClick}
            aria-pressed={verifyActive}
            title={verifyCount > 0 ? t("verifyIssues", { count: verifyCount }) : t("verifyHint")}
            className={`shrink-0 ${verifyActive ? "bg-primary-soft text-primary-hover" : ""}`}
          >
            <span className="hidden md:inline">{t("verify")}</span>
            {verifyCount > 0 && <CountBadge count={verifyCount} tone="alert" />}
          </Button>
        )}
        {/* UC-49: bản đọc + comment (Viewer góp ý trên baseline, Lead/Analyst xử lý) */}
        {project && (
          <Link
            href={`/projects/${project._id}/view`}
            title={t("viewHint")}
            aria-label={t("view")}
            className="shrink-0 inline-flex items-center justify-center h-8 px-3.5 gap-1.5 rounded-control text-body font-bold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Icon name="eye" size={14} />
            <span className="hidden md:inline">{t("view")}</span>
          </Link>
        )}
        {onToolsClick && (
          <Button
            size="sm"
            variant="ghost"
            icon="folder"
            onClick={onToolsClick}
            aria-pressed={toolsActive}
            title={toolsCount > 0 ? t("toolsPending", { label: tools, count: toolsCount }) : tools}
            className={`shrink-0 ${toolsActive ? "bg-primary-soft text-primary-hover" : ""}`}
          >
            <span className="hidden md:inline">{toolsShortLabel ?? t("tools")}</span>
            {/* Có mục chờ quyết mà nút im lặng thì user không biết để mở — badge nói số, không chỉ một chấm màu */}
            {toolsCount > 0 && <CountBadge count={toolsCount} tone="alert" />}
          </Button>
        )}
        <Button size="sm" variant="ghost" icon="export" onClick={onExportClick} title={t("exportHint")} className="shrink-0">
          <span className="hidden md:inline">{t("export")}</span>
        </Button>
        {onEnterFocus && <IconButton icon="expand" label={t("enterFocus")} onClick={onEnterFocus} />}
        <DropdownMenu
          trigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={t("account")}
              title={t("account")}
              className="w-9 h-9 grid place-items-center rounded-control hover:bg-surface-container-high transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="w-7 h-7 rounded-full grid place-items-center text-body font-semibold bg-primary-fixed text-primary">
                {user?.name ? user.name.charAt(0).toUpperCase() : <Icon name="user" size={14} />}
              </span>
            </button>
          )}
          header={
            user ? (
              <div className="flex flex-col gap-1.5 min-w-[200px]">
                <span className="min-w-0">
                  <span className="block text-body font-semibold text-on-surface truncate">{user.name ?? user.email}</span>
                  {user.name && <span className="block text-caption text-on-surface-muted truncate">{user.email}</span>}
                </span>
                <span className="inline-flex items-center gap-1.5 text-body font-semibold text-on-surface">
                  <Icon name="wallet" size={14} className="text-primary" />
                  <span className="tabular-nums">{user.balance ?? 0}</span>
                  <span className="text-on-surface-muted font-medium">{t("credits")}</span>
                </span>
              </div>
            ) : undefined
          }
          items={[{ label: t("logout"), icon: "logout", tone: "danger", onSelect: onLogout }]}
        />
      </div>
    </header>
  );
}
