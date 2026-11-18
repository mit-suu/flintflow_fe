"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import FilterSelect from "@/components/ui/FilterSelect";
import { compareVersions } from "@/lib/api/versions";
import type { CompareResponse, DocVersion } from "@/types/doc-version";
import BlockDiffList, { DiffSummary } from "./BlockDiffList";
import { useMode1Labels } from "./i18n";

interface VersionCompareProps {
  projectId: string;
  /** Mới nhất trước (như `GET /versions`). */
  versions: DocVersion[];
}

/** So sánh 2 version theo block (UC-55). Mặc định: bản ngay trước ↔ bản mới nhất. */
export default function VersionCompare({ projectId, versions }: VersionCompareProps) {
  const t = useTranslations("mode1.versionCompare");
  const L = useMode1Labels();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (versions.length < 2) return <p className="text-body text-on-surface-muted">{t("needTwo")}</p>;

  /**
   * Mặc định suy từ `versions` mỗi lần render, không chốt trong `useState`: component có thể mount lúc
   * danh sách còn rỗng (popup tải xong mới có), mà initializer thì chỉ đọc một lần — chốt sớm là hai ô
   * chọn mắc ở chuỗi rỗng và nút So sánh khoá cứng. Cũng nhờ vậy không bao giờ gọi API với `from`/`to` rỗng.
   * Mã không còn trong danh sách (version bị xoá) cũng rơi về mặc định thay vì query mã đã mất.
   */
  const has = (version: string) => versions.some((v) => v.version === version);
  const effectiveFrom = has(from) ? from : (versions[1]?.version ?? "");
  const effectiveTo = has(to) ? to : (versions[0]?.version ?? "");
  const same = effectiveFrom === effectiveTo;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult((await compareVersions(projectId, effectiveFrom, effectiveTo)).data);
    } catch (err) {
      setError(L.errorText(err, t("failed")));
    } finally {
      setBusy(false);
    }
  };

  const options = versions.map((v) => ({ value: v.version, label: v.version }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label={t("from")} value={effectiveFrom} options={options} onChange={setFrom} align="start" />
        <FilterSelect label={t("to")} value={effectiveTo} options={options} onChange={setTo} align="start" />
        <Button size="sm" onClick={() => void run()} disabled={same} loading={busy}>
          {t("compare")}
        </Button>
        {same && <span className="text-body text-on-surface-muted">{t("pickDifferent")}</span>}
      </div>
      {error && (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      )}
      {result && (
        <>
          <p className="text-body font-semibold text-on-surface-medium tabular-nums">
            {result.from} → {result.to}: <DiffSummary summary={result.summary} />
          </p>
          <BlockDiffList entries={result.blocks} />
        </>
      )}
    </div>
  );
}
