"use client";

import { useState } from "react";
import { getTraceability } from "@/lib/api/spine";
import type { TraceabilityEntity, TraceabilityResponse } from "@/types/flags";

interface TraceabilityMapProps {
  projectId: string;
}

const ENTITIES: { id: TraceabilityEntity; label: string }[] = [
  { id: "actor", label: "Actor" },
  { id: "use_case", label: "Use case" },
  { id: "function", label: "Function" },
  { id: "screen", label: "Screen" },
  { id: "entity", label: "Entity" },
  { id: "nfr", label: "NFR" },
  { id: "feature", label: "Feature" },
  { id: "business_rule", label: "Business rule" },
];

/** `GET /traceability?entity&id` — bảng actor/use case/function/screen/entity liên quan tới một id. */
export default function TraceabilityMap({ projectId }: TraceabilityMapProps) {
  const [entity, setEntity] = useState<TraceabilityEntity>("actor");
  const [id, setId] = useState("");
  const [result, setResult] = useState<TraceabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTraceability(projectId, { entity, id: id.trim() });
      setResult(res.data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Không tra được traceability");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2" aria-label="Traceability map">
      <div className="flex items-center gap-1.5">
        <select
          value={entity}
          onChange={(e) => setEntity(e.target.value as TraceabilityEntity)}
          className="px-2 py-1 border border-[#E5E3DF] rounded-[8px] text-[11.5px] outline-none"
        >
          {ENTITIES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void search()}
          placeholder="ID (vd A01)"
          className="flex-1 px-2 py-1 border border-[#E5E3DF] rounded-[8px] text-[11.5px] outline-none focus:border-[#4F46E5]"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading || !id.trim()}
          className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#191817] text-white disabled:opacity-50 cursor-pointer"
        >
          {loading ? "…" : "Tra"}
        </button>
      </div>

      {error && <div className="text-[11px] text-[#B03030]">{error}</div>}

      {result && (
        <div className="flex flex-col gap-2">
          {result.nodes.length === 0 ? (
            <div className="text-[11px] text-[#A8A49C] italic">Không có liên kết nào.</div>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">Loại</th>
                  <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">ID</th>
                  <th className="border border-[#ECEAE5] bg-[#FAF9F7] px-2 py-1 text-left font-bold">Nhãn</th>
                </tr>
              </thead>
              <tbody>
                {result.nodes.map((node) => (
                  <tr key={`${node.kind}:${node.id}`}>
                    <td className="border border-[#ECEAE5] px-2 py-1 font-mono">{node.kind}</td>
                    <td className="border border-[#ECEAE5] px-2 py-1 font-mono">{node.id}</td>
                    <td className="border border-[#ECEAE5] px-2 py-1">{node.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result.edges.length > 0 && (
            <div className="flex flex-col gap-1 text-[10.5px] text-[#6B6862]">
              {result.edges.map((edge, i) => (
                <div key={i}>
                  <span className="font-mono">{edge.from}</span> → <span className="font-mono">{edge.to}</span>{" "}
                  <span className="text-[#A8A49C]">({edge.field})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
