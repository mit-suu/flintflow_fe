"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import { ApiClientError } from "@/lib/api/client";
import { userErrorMessage } from "@/lib/api/error-messages";
import { estimateScreenMockups, fetchScreenOriginalImage, runScreenMockups } from "@/lib/api/projects";
import type { ScreenMockupEstimate, ScreenMockupMode, ScreenMockupRunView, ScreenMockupScope } from "@/types/project";
import { DEFAULT_PRIMARY_COLOR, textOn } from "./ScreenThemePicker";

export interface OriginalScreen {
  screen_id: string;
  name: string;
}

interface ScreenMockupDialogProps {
  projectId: string;
  /** Màn có ảnh gốc (theo `GET /screen-mockups`). */
  screens: readonly OriginalScreen[];
  /** Mở từ một màn ⇒ có nút chuyển "Màn này / Tất cả"; không (cài đặt dự án) ⇒ chỉ "Tất cả", ẩn phạm vi. */
  screenId?: string;
  /** Kiểu mockup màn này đang hiển thị (nhãn "Đang dùng"); màn đang dùng ảnh gốc / chưa vẽ ⇒ không truyền. */
  currentMode?: ScreenMockupMode;
  /** Màu chính của dự án — vẽ hình minh hoạ kiểu "Mockup chuẩn". `null` ⇒ màu mặc định. */
  primaryColor?: string | null;
  onClose: () => void;
  /** Lượt vẽ đã bắt đầu chạy nền (BE trả 202) — chủ theo dõi tiến độ, hộp đóng ngay. */
  onStarted: (run: ScreenMockupRunView) => void;
}

/** Hình minh hoạ "Mockup chuẩn": khung trình duyệt + header màu chính của dự án + ô nhập + nút. */
function StandardThumb({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 72" aria-hidden className="w-full h-full">
      <rect x="0.5" y="0.5" width="119" height="71" rx="4" fill="#fff" stroke="#C9C9C9" />
      <rect x="1" y="1" width="118" height="9" rx="3" fill="#E4E4E4" />
      {["#E0504A", "#E8B23A", "#52B548"].map((c, i) => (
        <circle key={c} cx={6 + i * 5} cy="5.5" r="1.6" fill={c} />
      ))}
      <rect x="1" y="10" width="118" height="12" fill={color} />
      <rect x="6" y="14.5" width="22" height="3" rx="1.5" fill={textOn(color)} opacity="0.9" />
      <rect x="8" y="28" width="30" height="4" rx="1" fill="#333" />
      {[0, 1].map((col) =>
        [0, 1].map((row) => (
          <g key={`${col}-${row}`}>
            <rect x={8 + col * 54} y={37 + row * 12} width="50" height="8" rx="1.5" fill="#fff" stroke="#A6A6A6" strokeWidth="0.6" />
          </g>
        ))
      )}
      <rect x="8" y="62" width="22" height="6" rx="1.5" fill={color} />
      <rect x="33" y="62" width="22" height="6" rx="1.5" fill="#fff" stroke={color} strokeWidth="0.8" />
    </svg>
  );
}

/** Ảnh gốc thu nhỏ của màn (một màn); tải lỗi / nhiều màn ⇒ icon. */
function OriginalThumb({ projectId, screenId }: { projectId: string; screenId?: string }) {
  const [src, setSrc] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!screenId) return;
    let alive = true;
    let url: string | null = null;
    fetchScreenOriginalImage(projectId, screenId).then(
      (blob) => {
        url = URL.createObjectURL(blob);
        if (alive) setSrc({ id: screenId, url });
        else URL.revokeObjectURL(url);
      },
      () => alive && setSrc({ id: screenId, url: null })
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [projectId, screenId]);
  const shown = screenId && src?.id === screenId ? src.url : null;
  // eslint-disable-next-line @next/next/no-img-element -- blob URL của ảnh trong file import
  if (shown) return <img src={shown} alt="" className="w-full h-full object-cover object-top" />;
  return (
    <span className="w-full h-full flex items-center justify-center text-on-surface-variant">
      <Icon name="file" size={26} />
    </span>
  );
}

/** Việc nút chính sẽ làm. */
type Action = "draw" | "reenable" | "none";
const actionOf = (e: ScreenMockupEstimate): Action => (e.ai_calls > 0 ? "draw" : e.reenable > 0 ? "reenable" : "none");

/**
 * Vẽ lại ảnh gốc (dự án import) bằng mockup (FLF-410). Hai quyết định: phạm vi (nút chuyển "Màn này / Tất cả N màn", ẩn khi
 * mở từ cài đặt dự án) và kiểu vẽ (hai thẻ có hình minh hoạ). Chân hộp chia mọi màn trong phạm vi thành đúng ba nhóm cộng lại
 * bằng tổng (vẽ mới / bật lại / bỏ qua) — không còn "15 màn" mà "14 credit" không giải thích; bấm "Xem màn" ra tên từng màn.
 * Nút chính nói việc nó làm ("Vẽ lại 14 màn"), tắt khi không có gì để làm. Bấm ⇒ BE kiểm credit rồi chạy nền, hộp đóng ngay.
 */
export default function ScreenMockupDialog({ projectId, screens, screenId, currentMode, primaryColor, onClose, onStarted }: ScreenMockupDialogProps) {
  const t = useTranslations("app.screenMockup");
  const tc = useTranslations("app.common");
  const [mode, setMode] = useState<ScreenMockupMode>(currentMode === "original" ? "original" : "system");
  const [scope, setScope] = useState<ScreenMockupScope>(screenId ? "screen" : "all");
  const [estimate, setEstimate] = useState<{ key: string; value: ScreenMockupEstimate | null } | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = `${mode}:${scope}`;
  const current = screens.find((s) => s.screen_id === screenId);
  const nameOf = (id: string) => screens.find((s) => s.screen_id === id)?.name ?? id;

  useEffect(() => {
    let alive = true;
    estimateScreenMockups(projectId, mode, scope, scope === "screen" ? screenId : undefined).then(
      (res) => alive && setEstimate({ key, value: res.data }),
      () => alive && setEstimate({ key, value: null })
    );
    return () => {
      alive = false;
    };
  }, [projectId, mode, scope, screenId, key]);
  const shown = estimate?.key === key ? estimate.value : undefined;
  const action = shown ? actionOf(shown) : null;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await runScreenMockups(projectId, mode, scope, scope === "screen" && screenId ? [screenId] : undefined);
      if (res.data) onStarted(res.data);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError && err.code === "INSUFFICIENT_CREDITS"
          ? t("insufficient", { required: Number(err.meta?.required ?? 0), available: Number(err.meta?.available ?? 0) })
          : userErrorMessage(err, t("failed"))
      );
    } finally {
      setStarting(false);
    }
  };

  // Luôn đóng được, kể cả đang gửi: lượt vẽ chạy nền ở BE, đóng hộp không huỷ gì (kết quả vẫn về thẻ tiến độ của trang)
  const close = onClose;

  const inUse = (m: ScreenMockupMode) => scope === "screen" && currentMode === m;
  const styleCard = (m: ScreenMockupMode, title: string, note: string, thumb: React.ReactNode) => {
    const checked = mode === m;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        disabled={starting}
        onClick={() => setMode(m)}
        className={`relative flex flex-col text-left rounded-control overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors ${
          checked ? "bg-primary-soft" : "bg-surface-container hover:bg-surface-container-high"
        }`}
      >
        {checked && (
          <span className="absolute top-3 right-3 size-6 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm">
            <Icon name="check" size={14} />
          </span>
        )}
        <span className="h-24 bg-surface-container-lowest m-2 mb-0 rounded-[6px] overflow-hidden">{thumb}</span>
        <span className="px-3 py-2.5 flex flex-col gap-0.5">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-semibold text-on-surface">{title}</span>
            {inUse(m) && <span className="text-caption font-bold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">{t("inUse")}</span>}
          </span>
          <span className="text-caption text-on-surface-variant leading-[1.45]">{note}</span>
        </span>
      </button>
    );
  };

  /** Ba nhóm, nhóm 0 màn ẩn: "15 màn: 14 vẽ mới · 1 bỏ qua (đã là mockup kiểu này)". */
  const breakdown = shown
    ? [
        shown.groups.draw.length > 0 && t("groupDraw", { count: shown.groups.draw.length }),
        shown.groups.reenable.length > 0 && t("groupReenable", { count: shown.groups.reenable.length }),
        shown.groups.skip.length > 0 && t("groupSkip", { count: shown.groups.skip.length }),
      ].filter(Boolean)
    : [];
  const hasNames = shown && (shown.groups.reenable.length > 0 || shown.groups.skip.length > 0 || (scope === "all" && shown.groups.draw.length > 0));

  return (
    <Modal open onClose={close} title={t("title")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (action && action !== "none") void start();
        }}
        className="flex flex-col gap-5"
      >
        <p className="-mt-3 text-body text-on-surface-variant">
          {scope === "screen" && current ? t("subtitleScreen", { name: current.name }) : t("subtitleAll", { count: screens.length })}
        </p>

        {screenId && current && (
          <div className="flex items-center gap-3">
            <span className="text-body font-bold text-on-surface-medium shrink-0">{t("scopeLabel")}</span>
            <div role="radiogroup" aria-label={t("scopeLabel")} className="inline-flex p-1 rounded-control bg-surface-container">
              {(["screen", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={scope === s}
                  disabled={starting}
                  onClick={() => setScope(s)}
                  className={`px-3 h-8 rounded-[6px] text-body cursor-pointer transition-colors ${
                    scope === s ? "bg-surface-container-lowest font-semibold text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {s === "screen" ? t("scopeThis") : t("scopeAllShort", { count: screens.length })}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-body font-bold text-on-surface-medium">{t("modeLabel")}</span>
          <div role="radiogroup" aria-label={t("modeLabel")} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {styleCard("system", t("modeSystemShort"), t("modeSystemCard"), <StandardThumb color={primaryColor ?? DEFAULT_PRIMARY_COLOR} />)}
            {styleCard("original", t("modeOriginalShort"), t("modeOriginalCard"), <OriginalThumb projectId={projectId} screenId={scope === "screen" ? screenId : undefined} />)}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-body text-on-error-container bg-error-container rounded-control px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 pt-1">
          <div aria-live="polite" className="flex flex-col gap-1 min-h-11">
            {shown === undefined ? (
              <span className="text-body text-on-surface-variant">{t("estimating")}</span>
            ) : shown === null ? (
              <span className="text-body text-on-surface-variant">{t("estimateFailed")}</span>
            ) : (
              <>
                <span className="text-body text-on-surface">
                  {action === "none" && <Icon name="check-circle" size={15} className="inline -mt-0.5 mr-1.5 text-success" />}
                  <span className="font-semibold">{t("groupTotal", { count: shown.screens })}</span> {breakdown.join(" · ")}
                  {hasNames && (
                    <button type="button" onClick={() => setShowNames((v) => !v)} className="ml-2 text-primary font-semibold hover:underline cursor-pointer">
                      {showNames ? t("hideScreens") : t("showScreens")}
                    </button>
                  )}
                </span>
                <span className="text-caption text-on-surface-variant">{shown.credits > 0 ? t("cost", { credits: shown.credits }) : t("costFree")}</span>
                {showNames && hasNames && (
                  <ul className="mt-1 flex flex-col gap-1 text-caption text-on-surface-variant max-h-32 overflow-y-auto">
                    {(["draw", "reenable", "skip"] as const).map((g) =>
                      shown.groups[g].length > 0 ? (
                        <li key={g}>
                          <span className="font-semibold text-on-surface-medium">{t(`groupName.${g}`)}:</span> {shown.groups[g].map(nameOf).join(", ")}
                        </li>
                      ) : null
                    )}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button type="submit" loading={starting} disabled={!action || action === "none"}>
              {action === "reenable"
                ? t("ctaReenableN", { count: shown?.reenable ?? 0 })
                : action === "none"
                  ? t("ctaNothing")
                  : t("ctaDrawN", { count: shown?.ai_calls ?? 0 })}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
