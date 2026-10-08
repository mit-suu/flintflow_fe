"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import FilterSelect from "@/components/ui/FilterSelect";
import { getTraceability } from "@/lib/api/spine";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { TraceabilityEntity } from "@/types/flags";
import type { Spine } from "@/types/spine";
import { ENTITY_LABELS, fieldLabel } from "./mode1/spine-labels";
import { groupTrace, traceEntityOptions, type TraceGroupNode, type TraceGroups } from "./mode1/trace-direction";

interface TraceabilityMapProps {
  projectId: string;
  /**
   * Spine đang mở — có thì chọn thực thể từ danh sách tên thay vì gõ mã. Không có (chưa tải, hoặc chỗ gọi
   * không giữ Spine) thì rơi về ô gõ mã, vẫn tra được.
   */
  spine?: Spine;
}

/** 8 loại node của `traceabilityEntitySchema`; nhãn lấy từ `ENTITY_LABELS` để không khai hai bảng tên. */
const ENTITIES: { id: TraceabilityEntity; collection: string }[] = [
  { id: "actor", collection: "actors" },
  { id: "use_case", collection: "use_cases" },
  { id: "function", collection: "functions" },
  { id: "screen", collection: "screens" },
  { id: "entity", collection: "entities" },
  { id: "nfr", collection: "nfrs" },
  { id: "feature", collection: "features" },
  { id: "business_rule", collection: "business_rules" },
];

const ENTITY_OPTIONS = ENTITIES.map((e) => ({ value: e.id, label: ENTITY_LABELS[e.collection] ?? e.id }));

const entityLabel = (kind: TraceabilityEntity): string => {
  const found = ENTITIES.find((e) => e.id === kind);
  return found ? (ENTITY_LABELS[found.collection] ?? kind) : kind;
};

/** Lý do mỗi khối rỗng — nói ra bằng chữ thay vì để trống, vì rỗng ở đây là một thông tin. */
const EMPTY_REASON: Record<"upstream" | "downstream" | "lateral", string> = {
  upstream: "Không sinh ra từ thực thể nào — đây là gốc.",
  downstream: "Chưa có thực thể nào sinh ra từ đây.",
  lateral: "Không có quan hệ ngang.",
};

function NodeRow({ node }: { node: TraceGroupNode }) {
  return (
    <li className="bg-surface-container-lowest rounded-inner px-2.5 py-1.5 flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className="text-caption font-bold uppercase tracking-wide text-primary shrink-0">{entityLabel(node.kind)}</span>
        <span className="text-caption font-mono font-semibold text-on-surface-variant shrink-0">{node.id}</span>
      </div>
      <span className="text-body text-on-surface min-w-0">{node.label}</span>
      <span className="text-caption text-on-surface-muted">nối bằng {fieldLabel(node.field)}</span>
    </li>
  );
}

function Group({ title, nodes, reason }: { title: string; nodes: TraceGroupNode[]; reason: string }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <h4 className="text-caption font-bold uppercase tracking-wide text-on-surface-subtle">{title}</h4>
        <span aria-hidden className="flex-1 h-px bg-surface-container-highest" />
      </div>
      {nodes.length === 0 ? (
        <p className="text-caption text-on-surface-subtle italic">{reason}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {nodes.map((node) => (
            <NodeRow key={`${node.kind}:${node.id}`} node={node} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Bản đồ truy vết (`GET /traceability?entity&id`): một thực thể **từ đâu ra**, **dẫn tới** cái gì, và
 * **liên quan ngang** với cái gì. Chiều do `trace-direction.ts` quyết định, vì hướng cạnh BE trả về là
 * hướng của khoá chứ không phải hướng sinh ra.
 */
export default function TraceabilityMap({ projectId, spine }: TraceabilityMapProps) {
  const [entity, setEntity] = useState<TraceabilityEntity>("actor");
  const [id, setId] = useState("");
  const [groups, setGroups] = useState<TraceGroups | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => (spine ? traceEntityOptions(spine, entity) : []), [spine, entity]);
  /** Đổi loại ⇒ mã cũ không còn thuộc loại mới, nên chọn luôn phần tử đầu của loại vừa chọn. */
  const changeEntity = (next: TraceabilityEntity) => {
    setEntity(next);
    if (spine) setId(traceEntityOptions(spine, next)[0]?.value ?? "");
  };
  // Lần đầu có Spine: ô mã còn trống thì điền phần tử đầu để bấm Tra được ngay
  const selected = id || items[0]?.value || "";

  const search = async () => {
    const wanted = (spine ? selected : id).trim();
    if (!wanted) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTraceability(projectId, { entity, id: wanted });
      setGroups(groupTrace(res.data ?? { nodes: [], edges: [] }, wanted));
    } catch (err) {
      setGroups(null);
      setError(userErrorMessage(err, "Không tra được liên kết. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5" aria-label="Bản đồ truy vết">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect label="Loại" value={entity} options={ENTITY_OPTIONS} onChange={changeEntity} />
        {spine ? (
          items.length === 0 ? (
            <span className="flex-1 min-w-0 text-caption text-on-surface-subtle italic">
              Tài liệu chưa có {entityLabel(entity).toLowerCase()} nào.
            </span>
          ) : (
            <FilterSelect label="Mục" value={selected} options={items} onChange={setId} className="min-w-0" />
          )
        ) : (
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void search()}
            aria-label="Mã thực thể"
            placeholder="ID (vd A01)"
            className="flex-1 min-w-0 h-9 px-3 bg-surface-container rounded-control text-body outline-none focus:bg-surface-container-high"
          />
        )}
        <Button size="sm" onClick={() => void search()} disabled={!(spine ? selected : id.trim())} loading={loading}>
          Tra
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      )}

      {groups &&
        (groups.root === null ? (
          <p className="text-caption text-on-surface-subtle italic">Không tìm thấy thực thể này trong tài liệu.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="bg-primary-soft rounded-control px-2.5 py-2 flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-caption font-bold uppercase tracking-wide text-primary">{entityLabel(groups.root.kind)}</span>
                <span className="text-caption font-mono font-semibold text-on-surface-variant">{groups.root.id}</span>
              </div>
              <span className="text-body font-semibold text-on-surface">{groups.root.label}</span>
            </div>

            <Group title="Từ đâu ra" nodes={groups.upstream} reason={EMPTY_REASON.upstream} />
            <Group title="Dẫn tới" nodes={groups.downstream} reason={EMPTY_REASON.downstream} />
            <Group title="Liên quan ngang" nodes={groups.lateral} reason={EMPTY_REASON.lateral} />

            {groups.downstream.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-caption font-bold uppercase tracking-wide text-on-surface-subtle">Sửa cái này thì kéo theo</h4>
                  <span aria-hidden className="flex-1 h-px bg-surface-container-highest" />
                </div>
                <p className="text-body text-on-surface">
                  {groups.downstream.map((n) => `${entityLabel(n.kind)} ${n.id}`).join(" · ")}
                </p>
                <p className="text-caption text-on-surface-muted">
                  Theo quan hệ khoá. Không bắt được tên thực thể nằm trong văn xuôi của mục khác.
                </p>
              </section>
            )}
          </div>
        ))}
    </div>
  );
}
