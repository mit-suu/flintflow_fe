"use client";

import Link from "next/link";
import Skeleton from "@/components/ui/Skeleton";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import Logo from "@/components/Logo";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import CountBadge from "@/components/ui/CountBadge";
import DropdownMenu, { type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import Icon, { type IconName } from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import type { Project } from "@/types/project";
import type { User } from "@/types/user";

/** Một nút trong nhóm thao tác phụ: bo tròn, nổi nền trắng khi rê (giống từng ô của cụm VI/EN). */
const GROUP_ITEM =
  "h-7 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-full text-body font-bold cursor-pointer transition-colors hover:bg-surface-container-lowest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

interface WorkspaceHeaderProps {
  project: Project | null;
  user: User | null;
  /**
   * Chip trạng thái trên breadcrumb — chỉ các màn chưa có thanh đầu tài liệu (đang nhập SRS, đang tạo dự án). Workspace chính
   * đặt trạng thái baseline / gói duyệt ở thanh đầu tài liệu. `null` ⇒ không hiện chip.
   */
  baselineStatus?: { label: string; tone: BadgeTone } | null;
  /** Rail tiến độ đang ẩn ⇒ đầu header có nút hiện lại + logo (logo nằm trên rail khi rail mở). */
  progressHidden?: boolean;
  onShowProgress?: () => void;
  /**
   * TÊN bước hiện tại của tiến độ (vd "Người dùng & việc cần làm") — để nút "Về" nói rõ quay về đâu. Không truyền mã bước
   * (`B-1.2`): mã nội bộ không được hiện cho người dùng (FLF-411 #22).
   */
  currentStep?: string | null;
  /** Đang xem bước khác bước hiện tại ⇒ cho đường quay lại (L9). */
  onBackToCurrent?: () => void;
  onExportClick?: () => void;
  /** Mở / đóng panel "Trợ lý Google Docs" — không truyền ⇒ không có nút (thiếu client id Google, hoặc Viewer). */
  onDocsAssistantClick?: () => void;
  docsAssistantActive?: boolean;
  /** Nút riêng của chế độ (mode 1: mở popup Gap report / Change request), đứng trước Export. */
  actions?: ReactNode;
  /** Mở/đóng panel Công cụ (thuật ngữ, đã chốt, hàng đợi màn, lịch sử sửa…) — thay rail icon bên phải cũ. */
  onToolsClick?: () => void;
  toolsActive?: boolean;
  toolsLabel?: string;
  /** Icon của nút panel — mặc định `folder` (Hồ sơ); mode 1 dùng `shield-check` vì panel là "Kiểm & chốt". */
  toolsIcon?: IconName;
  /** Menu ⋯ (thao tác dùng hiếm, vd "Đổi mẫu"); rỗng / bỏ trống ⇒ không có nút. */
  moreItems?: readonly DropdownMenuItem[];
  /** Chữ ngắn trên nút (màn rộng) — mặc định "Công cụ". */
  toolsShortLabel?: string;
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
  /** Tên hiện khi `project` chưa tải xong (vd tên vừa nhập ở hộp Tạo dự án). */
  fallbackName?: string;
  /** Tên dự án chưa về (khung đang tải, chưa có bản nhớ) ⇒ thanh giữ chỗ thay cho chữ "Chưa đặt tên". */
  nameLoading?: boolean;
}

/**
 * Thanh trên của workspace, cố ý ít chữ: breadcrumb `Dự án / tên` · Export, menu ⋯, menu tài khoản
 * (credits, đăng xuất). Tiến độ giai đoạn/bước nằm ở rail trái (`WorkspaceProgressRail`); trạng thái baseline / gói duyệt
 * nằm ở thanh đầu tài liệu (`DocumentPane`).
 */
export default function WorkspaceHeader({
  project,
  user,
  baselineStatus = null,
  fallbackName,
  nameLoading = false,
  progressHidden = false,
  onShowProgress,
  currentStep = null,
  onBackToCurrent,
  onExportClick,
  onDocsAssistantClick,
  docsAssistantActive = false,
  actions,
  onToolsClick,
  toolsActive = false,
  toolsLabel,
  toolsIcon = "folder",
  moreItems,
  toolsShortLabel,
  onVerifyClick,
  verifyActive = false,
  verifyCount = 0,
  onLogout,
}: WorkspaceHeaderProps) {
  const t = useTranslations("workspace.header");
  const tools = toolsLabel ?? t("tools");
  // Container query theo bề rộng thật của header (rail tiến độ, panel phải đổi chỗ trống): nhãn chữ ẩn dần, nút ít dùng ẩn trước
  return (
    <header className="@container/header shrink-0 bg-surface-container-lowest h-[58px] px-4 flex items-center gap-3">
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
        {nameLoading ? (
          <Skeleton className="h-3.5 w-40" />
        ) : (
          <span aria-current="page" className="font-bold text-on-surface truncate">{project?.name || fallbackName || t("untitled")}</span>
        )}
        {baselineStatus && (
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
            <span className="hidden @[60rem]/header:inline max-w-[16rem] truncate">{t("back", { step: currentStep })}</span>
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
            <span className="hidden @[56rem]/header:inline">{t("verify")}</span>
            {verifyCount > 0 && <CountBadge count={verifyCount} tone="alert" />}
          </Button>
        )}
        {onToolsClick && (
          <Button
            size="sm"
            variant="ghost"
            icon={toolsIcon}
            onClick={onToolsClick}
            aria-pressed={toolsActive}
            // Không có badge số chờ quyết: việc chờ quyết không phải lỗi, số nằm ở tab "Chờ bạn quyết" trong panel
            title={tools}
            className={`shrink-0 ${toolsActive ? "bg-primary-soft text-primary-hover" : ""}`}
          >
            <span className="hidden @[56rem]/header:inline">{toolsShortLabel ?? t("tools")}</span>
          </Button>
        )}
        {/* Thao tác phụ gom một nhóm nền xám (cùng kiểu cụm VI/EN): header hẹp thì chỉ còn icon, nằm trong khung chung nên
            không lơ lửng cạnh các nút có chữ */}
        <div role="group" aria-label={t("secondaryActions")} className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-surface-sidebar p-1">
          {/* UC-49: bản đọc + comment (Viewer góp ý trên baseline, Lead/Analyst xử lý) */}
          {project && (
            <Link
              href={`/projects/${project._id}/view`}
              title={t("viewHint")}
              aria-label={t("view")}
              className={`${GROUP_ITEM} text-on-surface-variant hover:text-on-surface`}
            >
              <Icon name="eye" size={14} />
              <span className="hidden @[80rem]/header:inline">{t("view")}</span>
            </Link>
          )}
          {onDocsAssistantClick && (
            <button
              type="button"
              onClick={onDocsAssistantClick}
              aria-pressed={docsAssistantActive}
              aria-label={t("docsAssistant")}
              title={t("docsAssistantHint")}
              className={`${GROUP_ITEM} ${docsAssistantActive ? "bg-primary-soft text-primary-hover" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              <Icon name="file" size={14} />
              <span className="hidden @[80rem]/header:inline">{t("docsAssistant")}</span>
            </button>
          )}
          <button type="button" onClick={onExportClick} aria-label={t("export")} title={t("exportHint")} className={`${GROUP_ITEM} text-on-surface-variant hover:text-on-surface`}>
            <Icon name="export" size={14} />
            <span className="hidden @[80rem]/header:inline">{t("export")}</span>
          </button>
          {moreItems && moreItems.length > 0 && (
            <DropdownMenu
              placement="bottom-end"
              trigger={(props) => (
                <button type="button" {...props} aria-label={t("more")} title={t("more")} className={`${GROUP_ITEM} text-on-surface-variant hover:text-on-surface`}>
                  <Icon name="more-horizontal" size={14} />
                </button>
              )}
              items={moreItems}
            />
          )}
        </div>
        {/* Màn hẹp header đã chật: đổi ngôn ngữ vẫn có ở trang chủ / hồ sơ */}
        <LocaleSwitcher className="hidden sm:inline-flex shrink-0" />
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
