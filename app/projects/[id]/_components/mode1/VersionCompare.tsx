"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import FilterSelect from "@/components/ui/FilterSelect";
import { compareVersions } from "@/lib/api/versions";
import type { CompareResponse, DocVersion } from "@/types/doc-version";
import VersionDiffView, { DiffSummary } from "./VersionDiffView";
import { useMode1Labels } from "./i18n";

interface VersionCompareProps {
  projectId: string;
  /** Mới nhất trước (như `GET /versions`). */
  versions: DocVersion[];
}

/** So sánh 2 version kiểu code review (UC-50). Mặc định: bản ngay trước ↔ bản mới nhất; đổi version là so lại ngay. */
export default function VersionCompare({ projectId, versions }: VersionCompareProps) {
  const t = useTranslations("mode1.versionCompare");
  const L = useMode1Labels();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Mặc định suy từ `versions` mỗi lần render, không chốt trong `useState`: component có thể mount lúc
   * danh sách còn rỗng (popup tải xong mới có), mà initializer thì chỉ đọc một lần. Mã không còn trong danh sách
   * (version bị xoá) cũng rơi về mặc định thay vì query mã đã mất.
   */
  const has = (version: string) => versions.some((v) => v.version === version);
  const effectiveFrom = has(from) ? from : (versions[1]?.version ?? "");
  const effectiveTo = has(to) ? to : (versions[0]?.version ?? "");
  const same = effectiveFrom === effectiveTo;
  const ready = versions.length >= 2 && !same && !!effectiveFrom && !!effectiveTo;

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- so lại mỗi khi đổi cặp version
    setBusy(true);
    setError(null);
    compareVersions(projectId, effectiveFrom, effectiveTo)
      .then((res) => alive && setResult(res.data))
      .catch((err: unknown) => {
        if (!alive) return;
        setResult(null);
        setError(L.errorText(err, t("failed")));
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // L / t đổi theo ngôn ngữ, không cần so lại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, effectiveFrom, effectiveTo, ready]);

  if (versions.length < 2) return <p className="text-body text-on-surface-muted">{t("needTwo")}</p>;

  const options = versions.map((v) => ({ value: v.version, label: v.version }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label={t("from")} value={effectiveFrom} options={options} onChange={setFrom} align="start" />
        <span aria-hidden className="text-on-surface-muted">→</span>
        <FilterSelect label={t("to")} value={effectiveTo} options={options} onChange={setTo} align="start" />
        {same && <span className="text-body text-on-surface-muted">{t("pickDifferent")}</span>}
        {busy && (
          <span role="status" className="text-caption text-on-surface-muted">
            {t("loading")}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      )}
      {result && !same && (
        <VersionDiffView
          entries={result.blocks}
          sections={result.sections}
          fromLabel={result.from}
          toLabel={result.to}
          heading={
            <>
              {result.from} → {result.to}
              <span className="ml-2 text-caption font-semibold text-on-surface-muted">
                <DiffSummary summary={result.summary} />
              </span>
            </>
          }
        />
      )}
    </div>
  );
}
