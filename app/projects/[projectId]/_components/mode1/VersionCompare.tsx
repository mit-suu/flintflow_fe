"use client";

import { useState } from "react";
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

  if (versions.length < 2) return <p className="text-[12.5px] text-[#8A867E]">Cần ít nhất 2 version để so sánh.</p>;

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

  const select = (label: string, value: string, onChange: (v: string) => void) => (
    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#4B4842]">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="px-2 py-1 rounded-[8px] border border-[#E4E1DC] bg-white">
        {versions.map((v) => (
          <option key={v.version} value={v.version}>
            {v.version}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {select("Từ", from, setFrom)}
        {select("Đến", to, setTo)}
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy || from === to}
          className="px-3 py-1.5 rounded-[8px] bg-[#191817] text-white text-[12px] font-bold disabled:opacity-50"
        >
          {busy ? "Đang so sánh…" : "So sánh"}
        </button>
        {from === to && <span className="text-[11.5px] text-[#8A867E]">Chọn hai version khác nhau.</span>}
      </div>
      {error && <p className="text-[12px] text-[#B03030]">{error}</p>}
      {result && (
        <>
          <p className="text-[12px] font-semibold text-[#4B4842]">
            {result.from} → {result.to}: {summaryText(result.summary)}
          </p>
          <BlockDiffList entries={result.blocks} />
        </>
      )}
    </div>
  );
}
