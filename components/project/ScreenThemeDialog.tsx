"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { userErrorMessage } from "@/lib/api/error-messages";
import { disableScreenMockups, getScreenMockupSummary, setScreenTheme } from "@/lib/api/projects";
import type { Project, ScreenMockupSummary, ScreenTheme } from "@/types/project";
import ScreenMockupDialog from "./ScreenMockupDialog";
import ScreenThemePicker, { isHexColor } from "./ScreenThemePicker";

const EMPTY_THEME: ScreenTheme = { primaryColor: null, domain: null, platforms: null };

/** Field đổi so với theme đã lưu — PATCH chỉ gửi phần này. */
export const themePatch = (before: ScreenTheme, after: ScreenTheme): Partial<ScreenTheme> => {
  const patch: Partial<ScreenTheme> = {};
  if (before.primaryColor !== after.primaryColor) patch.primaryColor = after.primaryColor;
  if ((before.domain ?? null) !== (after.domain?.trim() || null)) patch.domain = after.domain?.trim() || null;
  if (JSON.stringify(before.platforms) !== JSON.stringify(after.platforms)) patch.platforms = after.platforms;
  return patch;
};

interface ScreenThemeDialogProps {
  project: Project;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}

/**
 * Cài đặt "Giao diện màn hình" của dự án (FLF-410): theme mockup + (dự án import có ảnh gốc) dòng tổng "Màn có ảnh gốc: N ·
 * đang dùng mockup: M" với "Vẽ lại tất cả…" / "Dùng ảnh gốc cho tất cả". Lưu theme ⇒ BE vẽ lại mockup đã có, không trừ credit.
 */
export default function ScreenThemeDialog({ project, onClose, onDone }: ScreenThemeDialogProps) {
  const t = useTranslations("app.projectDialogs.screenTheme");
  const tc = useTranslations("app.common");
  const saved = project.screenTheme ?? EMPTY_THEME;
  const [theme, setTheme] = useState<ScreenTheme>(saved);
  const [hexDraft, setHexDraft] = useState(saved.primaryColor ?? "");
  const [summary, setSummary] = useState<ScreenMockupSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [redrawAll, setRedrawAll] = useState(false);

  useEffect(() => {
    let alive = true;
    if (project.mode === "import")
      getScreenMockupSummary(project._id).then(
        (res) => alive && setSummary(res.data),
        () => undefined
      );
    return () => {
      alive = false;
    };
  }, [project._id, project.mode]);

  const patch = themePatch(saved, theme);
  const invalid = hexDraft !== "" && !isHexColor(hexDraft);
  const unchanged = Object.keys(patch).length === 0;

  const save = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await setScreenTheme(project._id, patch);
      await onDone();
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, t("failed")));
    } finally {
      setSubmitting(false);
    }
  };

  const restoreOriginalForAll = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await disableScreenMockups(project._id, "all");
      setSummary((s) => (s ? { ...s, using_mockup: 0 } : s));
      setNotice(t("originalRestored"));
    } catch (err) {
      setError(userErrorMessage(err, t("failed")));
    } finally {
      setSubmitting(false);
    }
  };

  if (redrawAll && summary) {
    return (
      <ScreenMockupDialog
        projectId={project._id}
        screens={summary.originals}
        primaryColor={theme.primaryColor}
        onClose={() => setRedrawAll(false)}
        // Chạy nền: quay về hộp theme, báo đã bắt đầu — tiến độ xem trong trang dự án
        onStarted={() => setNotice(t("runStarted"))}
      />
    );
  }

  return (
    <Modal open onClose={() => !submitting && onClose()} title={t("title")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!unchanged && !invalid) void save();
        }}
        className="flex flex-col gap-4"
      >
        <ScreenThemePicker value={theme} onChange={setTheme} hexDraft={hexDraft} onHexDraftChange={setHexDraft} disabled={submitting} />
        <p className="text-body text-on-surface-variant leading-[1.55]">{t("detail")}</p>
        {summary && summary.with_original > 0 && (
          <div className="flex flex-col gap-2 bg-surface-container rounded-control px-4 py-3">
            <p className="text-body text-on-surface">{t("originalSummary", { total: summary.with_original, mockup: summary.using_mockup })}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setRedrawAll(true)} disabled={submitting}>
                {t("redrawAll")}
              </Button>
              {summary.using_mockup > 0 && (
                <Button size="sm" variant="ghost" onClick={() => void restoreOriginalForAll()} disabled={submitting}>
                  {t("useOriginalAll")}
                </Button>
              )}
            </div>
          </div>
        )}
        {notice && <p className="text-body text-success">{notice}</p>}
        {error && (
          <p role="alert" className="text-body text-on-error-container bg-error-container rounded-control px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button type="submit" loading={submitting} disabled={unchanged || invalid}>
            {submitting ? t("busy") : t("cta")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
