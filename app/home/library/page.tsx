"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import TopBar from "@/components/layout/TopBar";
import { Button } from "@/components/ui";
import { fetchOrganization } from "@/lib/api/orgs";
import {
  deleteContentEntry,
  deleteOrgTemplate,
  listContentLibrary,
  listOrgTemplates,
  updateContentEntry,
  upsertContentEntry,
} from "@/lib/api/org-library";
import { getActiveOrgId } from "@/lib/api/token-store";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { ContentEntry, OrgTemplateSummary } from "@/types/org-library";
import type { OrgRole } from "@/types/organization";
import { blocksToText, textToBlocks } from "./content-text";

/** Mục đang soạn: `null` = không soạn; `id: null` = thêm mới. */
type Draft = { id: string | null; title: string; text: string } | null;

/**
 * Thư viện của tổ chức (FLF-278 đợt 3): mẫu SRS đã lưu từ dự án và nội dung chuẩn theo tiêu đề mục (Document
 * Conventions, References…). Mọi thành viên xem; Lead + Analyst thêm/sửa/xoá — BE kiểm lại bằng `requireRole`.
 */
export default function OrgLibraryPage() {
  const t = useTranslations("app.org.library");
  const tc = useTranslations("app.common");
  const format = useFormatter();
  const titleId = useId();
  const textId = useId();
  // Như trang Thành viên: tổ chức đang mở đọc lúc render (token-store chỉ có ở trình duyệt, trang là client)
  const orgId = getActiveOrgId();
  const [role, setRole] = useState<OrgRole | null>(null);
  const [templates, setTemplates] = useState<OrgTemplateSummary[]>([]);
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(null);
  /** Hai bước xoá: bấm lần đầu đổi nút thành "Xác nhận xoá". */
  const [confirming, setConfirming] = useState<string | null>(null);

  const canEdit = role === "lead" || role === "analyst";

  const fetchAll = useCallback(async (org: string) => {
    const [detail, tpl, content] = await Promise.all([fetchOrganization(org), listOrgTemplates(org), listContentLibrary(org)]);
    return { role: detail.role, tpl, content };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!orgId) return;
    fetchAll(orgId)
      .then((data) => {
        if (cancelled) return;
        setRole(data.role);
        setTemplates(data.tpl);
        setEntries(data.content);
      })
      .catch((err: unknown) => !cancelled && setError(userErrorMessage(err)))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [fetchAll, orgId]);
  const loading = orgId !== null && !loaded;

  const run = async (action: (org: string) => Promise<void>) => {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      await action(orgId);
      const data = await fetchAll(orgId);
      setTemplates(data.tpl);
      setEntries(data.content);
    } catch (err) {
      setError(userErrorMessage(err));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const saveDraft = () => {
    if (!draft) return;
    const input = { title: draft.title.trim(), blocks: textToBlocks(draft.text) };
    void run(async (org) => {
      if (draft.id) await updateContentEntry(org, draft.id, input);
      else await upsertContentEntry(org, input);
      setDraft(null);
    });
  };

  const removeButton = (key: string, onConfirm: () => void) => (
    <Button size="sm" variant="ghost" disabled={busy} onClick={() => (confirming === key ? onConfirm() : setConfirming(key))}>
      {confirming === key ? t("confirmDelete") : t("delete")}
    </Button>
  );

  return (
    <>
      <TopBar trail={[tc("account"), t("title")]} />
      <div className="flex-1 overflow-y-auto px-6 pt-6 sm:px-8 sm:pt-8 pb-scroll-end bg-surface-container-lowest">
        <div className="max-w-[860px] flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-title font-extrabold text-on-surface">{t("title")}</h1>
            <p className="text-body text-on-surface-variant">{t("intro")}</p>
            {!loading && !canEdit && <p className="text-caption text-on-surface-muted">{t("readOnly")}</p>}
          </div>
          {error && (
            <p role="alert" className="text-body text-error">
              {error}
            </p>
          )}
          {loading ? (
            <p role="status" className="text-body text-on-surface-muted">
              {t("loading")}
            </p>
          ) : (
            <>
              <section aria-labelledby="org-lib-templates" className="flex flex-col gap-3">
                <h2 id="org-lib-templates" className="text-subtitle font-extrabold text-on-surface">
                  {t("templates.title")}
                </h2>
                <p className="text-body text-on-surface-variant">{t("templates.help")}</p>
                {templates.length === 0 ? (
                  <p className="text-body text-on-surface-muted">{t("templates.empty")}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-card">
                    {templates.map((tpl) => (
                      <li key={tpl.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[220px]">
                          <p className="text-body font-bold text-on-surface">{tpl.name}</p>
                          <p className="text-caption text-on-surface-muted">
                            {t("templates.meta", {
                              file: tpl.source_file_name,
                              headings: tpl.heading_count,
                              customs: tpl.custom_count,
                              uses: tpl.uses,
                              date: format.dateTime(new Date(tpl.created_at), { dateStyle: "medium" }),
                            })}
                          </p>
                        </div>
                        {canEdit && removeButton(`tpl:${tpl.id}`, () => void run((org) => deleteOrgTemplate(org, tpl.id)))}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="org-lib-content" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 id="org-lib-content" className="text-subtitle font-extrabold text-on-surface flex-1">
                    {t("content.title")}
                  </h2>
                  {canEdit && !draft && (
                    <Button size="sm" variant="secondary" onClick={() => setDraft({ id: null, title: "", text: "" })}>
                      {t("content.add")}
                    </Button>
                  )}
                </div>
                <p className="text-body text-on-surface-variant">{t("content.help")}</p>
                {draft && (
                  <div className="rounded-card border border-outline-variant p-4 flex flex-col gap-3">
                    <label htmlFor={titleId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-variant">
                      {t("content.titleLabel")}
                      <input
                        id={titleId}
                        value={draft.title}
                        maxLength={200}
                        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        className="h-9 rounded-control border border-outline bg-surface-container-lowest px-2 text-body text-on-surface font-normal"
                      />
                    </label>
                    <label htmlFor={textId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-variant">
                      {t("content.textLabel")}
                      <textarea
                        id={textId}
                        value={draft.text}
                        rows={8}
                        onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                        className="rounded-control border border-outline bg-surface-container-lowest p-2 text-body text-on-surface font-normal"
                      />
                    </label>
                    <p className="text-caption text-on-surface-muted">{t("content.textHelp")}</p>
                    <div className="flex gap-3">
                      <Button size="sm" disabled={busy || !draft.title.trim() || textToBlocks(draft.text).length === 0} loading={busy} onClick={saveDraft}>
                        {t("content.save")}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
                        {t("content.cancel")}
                      </Button>
                    </div>
                  </div>
                )}
                {entries.length === 0 ? (
                  <p className="text-body text-on-surface-muted">{t("content.empty")}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-card">
                    {entries.map((entry) => (
                      <li key={entry.id} className="px-4 py-3 flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-body font-bold text-on-surface flex-1">{entry.title}</p>
                          {canEdit && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => setDraft({ id: entry.id, title: entry.title, text: blocksToText(entry.blocks) })}
                              >
                                {t("content.edit")}
                              </Button>
                              {removeButton(`entry:${entry.id}`, () => void run((org) => deleteContentEntry(org, entry.id)))}
                            </>
                          )}
                        </div>
                        <p className="text-caption text-on-surface-variant whitespace-pre-line line-clamp-3">{blocksToText(entry.blocks)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
