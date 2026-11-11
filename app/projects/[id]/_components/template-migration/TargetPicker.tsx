"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import SearchInput from "@/components/ui/SearchInput";
import Skeleton from "@/components/ui/Skeleton";
import { listOrgTemplates } from "@/lib/api/org-library";
import { versionFacts } from "@/lib/org-template-version";
import type { OrgTemplateSummary } from "@/types/org-library";
import type { PreviousTemplate, StartMigrationInput, TemplateCurrent } from "@/types/template-migration";
import type { MigrationTargetQuery } from "./href";

interface TargetPickerProps {
  /** Org của dự án (không phải org đang chọn ở thanh trên). `undefined` = chưa biết (dự án đang tải) ⇒ hiện đang tải, chưa gọi BE. */
  orgId: string | null | undefined;
  /** Lead có thêm "đăng lên thư viện" khi tải file; Analyst chỉ tạo bản riêng của dự án. */
  canPublish: boolean;
  busy: boolean;
  /** Đích điền sẵn từ thông báo bản mới. */
  preselect: MigrationTargetQuery | null;
  /** Mẫu dự án đang theo trước lần đổi gần nhất — lối tắt "quay về". */
  previous: PreviousTemplate | null;
  /** Mẫu + bản dự án đang theo — không cho chọn lại đúng bản đó (BE trả `409 TEMPLATE_MIGRATION_SAME_TEMPLATE`). */
  current?: Pick<TemplateCurrent, "template_id" | "version"> | null;
  onStart: (input: StartMigrationInput) => void;
}

const publishedVersions = (tpl: OrgTemplateSummary): number[] => tpl.versions.filter((v) => v.status === "published").map((v) => v.version);

/** So khớp không phân biệt dấu / hoa thường (gõ "ngan hang" ra "Ngân hàng"). */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

/** Danh sách mẫu của một org; gắn theo `orgId` để đổi org (org dự án về sau mới biết) không hiện danh sách của org cũ. */
interface Loaded {
  orgId: string;
  list: OrgTemplateSummary[];
  failed: boolean;
}

/**
 * Bước 1 — chọn mẫu đích: mẫu của tổ chức (bản bất kỳ, kể cả cũ hơn bản đang theo) hoặc file .docx tải lên.
 * Tổ chức có thể có hàng trăm mẫu ⇒ tìm kiếm + danh sách cuộn riêng, chọn **một** mẫu (một nút chính ở dưới, không phải mỗi dòng
 * một nút). Tải danh sách lỗi hoặc tổ chức chưa có mẫu ⇒ vẫn còn đường tải file.
 */
export default function TargetPicker({ orgId, canPublish, busy, preselect, previous, current = null, onStart }: TargetPickerProps) {
  const t = useTranslations("mode1.templateMigration.picker");
  const fileRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const familyPickId = useId();
  const versionPickId = useId();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(preselect?.templateId ?? null);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [fileOpen, setFileOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [publish, setPublish] = useState(false);
  const [name, setName] = useState("");
  /** Đăng thành bản mới của họ mẫu có sẵn (`""` = họ mẫu mới, cần tên). */
  const [familyId, setFamilyId] = useState("");

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    listOrgTemplates(orgId)
      .then((list) => !cancelled && setLoaded({ orgId, list, failed: false }))
      .catch(() => !cancelled && setLoaded({ orgId, list: [], failed: true }));
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // `undefined` hoặc danh sách còn là của org khác ⇒ đang tải; `null` (dự án không thuộc org) ⇒ không có mẫu, vẫn tải file được
  const ready = orgId === null || (orgId !== undefined && loaded?.orgId === orgId);
  const loadFailed = ready && orgId !== null && !!loaded?.failed;
  const usable = useMemo(
    () => (orgId && loaded?.orgId === orgId ? loaded.list : []).filter((tpl) => publishedVersions(tpl).length > 0),
    [loaded, orgId]
  );
  const visible = useMemo(() => {
    const q = fold(query.trim());
    const hits = q ? usable.filter((tpl) => fold(`${tpl.name} ${tpl.source_file_name}`).includes(q)) : usable;
    // Mẫu có bản mới (từ thông báo) lên đầu
    return preselect ? [...hits].sort((a, b) => Number(b.id === preselect.templateId) - Number(a.id === preselect.templateId)) : hits;
  }, [usable, query, preselect]);

  const versionOf = (tpl: OrgTemplateSummary): number => chosen[tpl.id] ?? (preselect?.templateId === tpl.id ? preselect.version : tpl.latest_version);
  const selected = usable.find((tpl) => tpl.id === selectedId) ?? null;
  const selectedVersion = selected ? versionOf(selected) : null;
  const selectedIsCurrent = !!selected && current?.template_id === selected.id && current.version === selectedVersion;
  const publishNeedsName = canPublish && publish && !familyId && !name.trim();
  // Không có mẫu nào để chọn (org trống / tải lỗi) ⇒ tải file là đường duy nhất, mở sẵn
  const fileShown = fileOpen || (ready && usable.length === 0);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-on-surface-variant leading-relaxed">{t("intro")}</p>

      {previous && (
        <div className="rounded-card bg-surface-container-low p-4 flex flex-wrap items-center gap-3">
          <Icon name="history" size={18} className="shrink-0 text-on-surface-muted" />
          <p className="flex-1 min-w-[200px] text-body text-on-surface leading-relaxed">
            {t(previous.visibility === "project" ? "previousPrivate" : "previousNamed", { name: previous.name, version: previous.version })}
          </p>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onStart({ kind: "template", template_id: previous.template_id, version: previous.version })}>
            {t("usePrevious")}
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-3" aria-label={t("orgTitle")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-body font-extrabold text-on-surface">
            {t("orgTitle")}
            {ready && usable.length > 0 && <span className="ml-2 text-caption font-bold text-on-surface-muted tabular-nums">{usable.length}</span>}
          </h4>
          {ready && usable.length > 0 && (
            <SearchInput value={query} onChange={setQuery} label={t("searchLabel")} placeholder={t("searchPlaceholder")} className="w-full sm:w-[320px]" />
          )}
        </div>

        {!ready ? (
          <ul aria-label={t("loading")} className="flex flex-col gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-[60px] w-full" />
              </li>
            ))}
          </ul>
        ) : usable.length === 0 ? (
          <p className="rounded-card bg-surface-container-low px-4 py-5 text-body text-on-surface-muted">{loadFailed ? t("loadFailed") : t("orgEmpty")}</p>
        ) : visible.length === 0 ? (
          <p className="rounded-card bg-surface-container-low px-4 py-5 text-body text-on-surface-muted">{t("noMatch", { query: query.trim() })}</p>
        ) : (
          // Vùng cuộn riêng: hàng trăm mẫu không đẩy phần tải file và nút chính xuống tận đáy
          <div role="radiogroup" aria-label={t("orgTitle")} className="max-h-[min(46vh,440px)] overflow-y-auto ff-scroll -mr-3 flex flex-col gap-1.5">
            {visible.map((tpl) => {
              const isSelected = tpl.id === selectedId;
              const version = versionOf(tpl);
              const isCurrentFamily = current?.template_id === tpl.id;
              const hasNew = preselect?.templateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={busy}
                  onClick={() => setSelectedId(tpl.id)}
                  className={`w-full text-left flex items-center gap-3 rounded-control px-3.5 py-3 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed ${
                    isSelected ? "bg-primary-soft" : "bg-surface-container-low hover:bg-surface-container"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${isSelected ? "bg-primary" : "bg-surface-container-lowest ring-1 ring-inset ring-on-surface-muted/40"}`}
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-on-primary" />}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-body font-semibold text-on-surface line-clamp-2 break-words" title={tpl.name}>
                        {tpl.name}
                      </span>
                      {isCurrentFamily && <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-caption font-bold text-on-surface-variant">{t("badgeCurrent")}</span>}
                      {hasNew && <span className="px-2 py-0.5 rounded-full bg-primary text-caption font-bold text-on-primary">{t("badgeNew")}</span>}
                    </span>
                    <span className="text-caption text-on-surface-muted truncate">
                      {t("meta", versionFacts(tpl, version))} · {version === tpl.latest_version ? t("versionLatest", { version }) : t("versionOption", { version })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Một nút chính cho mẫu đang chọn; nhiều bản thì chọn bản ngay cạnh */}
        {ready && usable.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-card bg-surface-container-lowest pt-1">
            <p className="flex-1 min-w-[200px] text-caption text-on-surface-variant" aria-live="polite">
              {selected ? (selectedIsCurrent ? t("isCurrent") : t("selectedLabel", { name: selected.name })) : t("pickHint")}
            </p>
            {selected && publishedVersions(selected).length > 1 && (
              <label htmlFor={versionPickId} className="flex items-center gap-2 text-caption font-bold text-on-surface-medium">
                {t("versionPick")}
                <select
                  id={versionPickId}
                  aria-label={t("versionLabel", { name: selected.name })}
                  value={selectedVersion ?? undefined}
                  disabled={busy}
                  onChange={(e) => setChosen((prev) => ({ ...prev, [selected.id]: Number(e.target.value) }))}
                  className="h-8 rounded-control bg-surface-container-low px-2 text-caption font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {publishedVersions(selected).map((v) => (
                    <option key={v} value={v}>
                      {v === selected.latest_version ? t("versionLatest", { version: v }) : t("versionOption", { version: v })}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Button
              size="sm"
              iconRight="arrow-right"
              disabled={!selected || selectedIsCurrent}
              loading={busy}
              onClick={() => selected && selectedVersion && onStart({ kind: "template", template_id: selected.id, version: selectedVersion })}
              aria-label={selected && selectedVersion ? t("useAria", { name: selected.name, version: selectedVersion }) : undefined}
            >
              {t("use")}
            </Button>
          </div>
        )}
      </section>

      {/* Tải file là lối phụ: thu gọn để danh sách mẫu là thứ nhìn thấy trước */}
      <section className="flex flex-col gap-3 rounded-card bg-surface-container-low p-4" aria-label={t("fileTitle")}>
        <button
          type="button"
          onClick={() => setFileOpen((v) => !v)}
          aria-expanded={fileShown}
          className="self-start inline-flex items-center gap-2 text-body font-extrabold text-on-surface cursor-pointer"
        >
          <Icon name="upload" size={16} className="text-primary" />
          {t("fileTitle")}
          <Icon name="chevron-down" size={16} className={`text-on-surface-muted transition-transform ${fileShown ? "rotate-180" : ""}`} />
        </button>
        {fileShown && (
          <>
            <p className="text-caption text-on-surface-muted leading-relaxed">{canPublish ? t("fileHelpLead") : t("fileHelpAnalyst")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-caption font-bold text-on-surface-medium">{t("fileLabel")}</span>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    hidden
                    aria-label={t("fileLabel")}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                    {t("chooseFile")}
                  </Button>
                  <span className="text-body text-on-surface-variant truncate max-w-[240px]">{file ? file.name : t("noFile")}</span>
                </div>
              </div>
              {canPublish && (
                <label className="inline-flex items-center gap-2 text-caption font-bold text-on-surface-variant cursor-pointer">
                  <input type="checkbox" checked={publish} disabled={busy} onChange={(e) => setPublish(e.target.checked)} />
                  {t("publish")}
                </label>
              )}
              {canPublish && publish && usable.length > 0 && (
                <label htmlFor={familyPickId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-medium">
                  {t("familyLabel")}
                  <select
                    id={familyPickId}
                    value={familyId}
                    disabled={busy}
                    onChange={(e) => setFamilyId(e.target.value)}
                    className="h-9 w-[240px] max-w-full rounded-control bg-surface-container-lowest px-2 text-body font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">{t("familyNew")}</option>
                    {usable.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {t("familyNext", { name: tpl.name })}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {canPublish && publish && !familyId && (
                <label htmlFor={nameId} className="flex flex-col gap-1 text-caption font-bold text-on-surface-medium">
                  {t("nameLabel")}
                  <input
                    id={nameId}
                    value={name}
                    maxLength={120}
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 w-[240px] max-w-full rounded-control bg-surface-container-lowest px-3 text-body font-normal text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>
              )}
              <Button
                size="sm"
                variant="secondary"
                icon="upload"
                disabled={!file || publishNeedsName}
                loading={busy}
                onClick={() => file && onStart({ kind: "file", file, ...(canPublish && publish ? { publish_to_org: true, ...(familyId ? { template_id: familyId } : { name: name.trim() }) } : {}) })}
              >
                {t("useFile")}
              </Button>
            </div>
            {publishNeedsName && (
              <p className="text-caption text-on-surface-muted flex items-center gap-1">
                <Icon name="info" size={14} />
                {t("nameRequired")}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
