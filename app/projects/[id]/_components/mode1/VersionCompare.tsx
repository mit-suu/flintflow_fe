"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import FilterSelect from "@/components/ui/FilterSelect";
import { compareVersions } from "@/lib/api/versions";
import type { CompareResponse, DocVersion } from "@/types/doc-version";
import BlockDiffList, { summaryText } from "./BlockDiffList";
import { errorText } from "./errors";

interface VersionCompareProps {
  projectId: string;
  /** Mới nhất trước (như `GET /versions`). */
  versions: DocVersion[];
}

/** So sánh 2 version theo block (UC-55). Mặc định: bản ngay trước ↔ bản mới nhất. */
export default function VersionCompare({ projectId, versions }: VersionCompareProps) {
  const [from, setFrom] = useState(versions[1]?.version ?? "");
  const [to, setTo] = useState(versions[0]?.version ?? "");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (versions.length < 2) return <p className="text-body text-on-surface-muted">Cần ít nhất 2 version để so sánh.</p>;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult((await compareVersions(projectId, from, to)).data);
    } catch (err) {
      setError(errorText(err, "Không so sánh được"));
    } finally {
      setBusy(false);
    }
  };

  const options = versions.map((v) => ({ value: v.version, label: v.version }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Từ" value={from} options={options} onChange={setFrom} />
        <FilterSelect label="Đến" value={to} options={options} onChange={setTo} />
        <Button size="sm" onClick={() => void run()} disabled={from === to} loading={busy}>
          So sánh
        </Button>
        {from === to && <span className="text-body text-on-surface-muted">Chọn hai version khác nhau.</span>}
      </div>
      {error && (
        <p role="alert" className="text-body text-error">
          {error}
        </p>
      )}
      {result && (
        <>
          <p className="text-body font-semibold text-on-surface-medium tabular-nums">
            {result.from} → {result.to}: {summaryText(result.summary)}
          </p>
          <BlockDiffList entries={result.blocks} />
        </>
      )}
    </div>
  );
}
