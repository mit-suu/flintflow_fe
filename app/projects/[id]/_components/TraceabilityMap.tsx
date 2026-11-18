"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import FilterSelect from "@/components/ui/FilterSelect";
import { getTraceability } from "@/lib/api/spine";
import { userErrorMessage } from "@/lib/api/error-messages";
import type { TraceabilityEntity } from "@/types/flags";
import type { Spine } from "@/types/spine";
import { useMode1Labels } from "./mode1/i18n";
import { groupTrace, traceEntityOptions, TRACE_COLLECTION, type TraceGroupNode, type TraceGroups } from "./mode1/trace-direction";

interface TraceabilityMapProps {
  projectId: string;
  /**
   * Spine đang mở — có thì chọn thực thể từ danh sách tên thay vì gõ mã. Không có (chưa tải, hoặc chỗ gọi
   * không giữ Spine) thì rơi về ô gõ mã, vẫn tra được.
   */
  spine?: Spine;
}

/**
 * Loại node và nhãn của nó đều suy từ bảng có sẵn: `TRACE_COLLECTION` (loại → collection Spine) ghép với nhãn collection
 * của mode 1 (`useMode1Labels().entityLabel`, theo ngôn ngữ). Không khai bảng loại thứ hai ở đây.
 */
function useEntityLabel(): (kind: TraceabilityEntity) => string {
  const { entityLabel } = useMode1Labels();
  return (kind) => entityLabel(TRACE_COLLECTION[kind]) || kind;
}

const TRACE_KINDS = Object.keys(TRACE_COLLECTION) as TraceabilityEntity[];

// Lý do mỗi khối rỗng (`workspace.trace.empty.*`) — nói ra bằng chữ thay vì để trống, vì rỗng ở đây là một thông tin.

function NodeRow({ node }: { node: TraceGroupNode }) {
  const t = useTranslations("workspace.trace");
  const { fieldLabel } = useMode1Labels();
  const entityLabel = useEntityLabel();
  return (
    <li className="bg-surface-container-lowest rounded-inner px-2.5 py-1.5 flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className="text-caption font-bold uppercase tracking-wide text-primary shrink-0">{entityLabel(node.kind)}</span>
        <span className="text-caption font-mono font-semibold text-on-surface-variant shrink-0">{node.id}</span>
      </div>
      <span className="text-body text-on-surface min-w-0">{node.label}</span>
      <span className="text-caption text-on-surface-muted">{t("linkedBy", { field: fieldLabel(node.field) })}</span>
    </li>
  );
}

/**
 * Số mục hiện sẵn mỗi nhóm. Một actor gốc kéo theo vài chục use case, đổ hết ra thì panel thành một cột
 * dài vô tận và nhóm bên dưới ("Dẫn tới" che mất "Quan hệ ngang") không ai cuộn tới. Xem đủ thì bấm mở.
 */
const PREVIEW_COUNT = 5;

function Group({ title, nodes, reason }: { title: string; nodes: TraceGroupNode[]; reason: string }) {
  const t = useTranslations("workspace.trace");
  const [expanded, setExpanded] = useState(false);
  const hidden = nodes.length - PREVIEW_COUNT;
  const shown = expanded ? nodes : nodes.slice(0, PREVIEW_COUNT);

  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-caption font-bold uppercase tracking-wide text-on-surface-subtle">
        {title}
        {/* `aria-hidden`: số chỉ nhắc lại độ dài danh sách ngay bên dưới, và giữ tên nhóm sạch cho trình đọc màn hình */}
        {nodes.length > 0 && (
          <span aria-hidden className="ml-1.5 font-mono text-on-surface-muted">
            {nodes.length}
          </span>
        )}
      </h4>
      {nodes.length === 0 ? (
        <p className="text-caption text-on-surface-subtle italic">{reason}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {shown.map((node) => (
              <NodeRow key={`${node.kind}:${node.id}`} node={node} />
            ))}
          </ul>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="self-start text-caption font-bold text-primary hover:underline cursor-pointer"
            >
              {expanded ? t("collapse") : t("showMore", { count: hidden })}
            </button>
          )}
        </>
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
  const t = useTranslations("workspace.trace");
  const entityLabel = useEntityLabel();
  const entityOptions = TRACE_KINDS.map((kind) => ({ value: kind, label: entityLabel(kind) }));
  const [entity, setEntity] = useState<TraceabilityEntity>("actor");
  const [id, setId] = useState("");
  const [groups, setGroups] = useState<TraceGroups | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => (spine ? traceEntityOptions(spine, entity) : []), [spine, entity]);
  /** Đổi loại ⇒ mã cũ thuộc loại khác, và kết quả đang hiện là của thực thể khác loại nên phải dọn. */
  const changeEntity = (next: TraceabilityEntity) => {
    setEntity(next);
    setGroups(null);
    setError(null);
    if (spine) setId(traceEntityOptions(spine, next)[0]?.value ?? "");
  };
  /**
   * Mã đang chọn phải là mã **đang có trong danh sách**: Spine tải lại sau mỗi lần sửa, thực thể đã chọn
   * có thể vừa bị xoá. Không kiểm thì dropdown hiện phần tử đầu (`FilterSelect` quy giá trị lạ về index 0)
   * mà nút Tra lại query mã đã mất.
   */
  const selected = items.some((o) => o.value === id) ? id : (items[0]?.value ?? "");

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
      setError(userErrorMessage(err, t("loadFailed")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5" aria-label={t("aria")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect label={t("colKind")} value={entity} options={entityOptions} onChange={changeEntity} align="start" />
        {spine ? (
          items.length === 0 ? (
            <span className="flex-1 min-w-0 text-caption text-on-surface-subtle italic">
              {t("noEntities", { entity: entityLabel(entity).toLowerCase() })}
            </span>
          ) : (
            <FilterSelect label={t("itemLabel")} value={selected} options={items} onChange={setId} align="start" className="min-w-0" />
          )
        ) : (
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void search()}
            aria-label={t("idAria")}
            placeholder={t("placeholder")}
            className="flex-1 min-w-0 h-9 px-3 bg-surface-container rounded-control text-body outline-none focus:bg-surface-container-high"
          />
        )}
        <Button size="sm" onClick={() => void search()} disabled={!(spine ? selected : id.trim())} loading={loading}>
          {t("search")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      )}

      {groups &&
        (groups.root === null ? (
          <p className="text-caption text-on-surface-subtle italic">{t("notFound")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="bg-primary-soft rounded-control px-2.5 py-2 flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-caption font-bold uppercase tracking-wide text-primary">{entityLabel(groups.root.kind)}</span>
                <span className="text-caption font-mono font-semibold text-on-surface-variant">{groups.root.id}</span>
              </div>
              <span className="text-body font-semibold text-on-surface">{groups.root.label}</span>
            </div>

            <Group title={t("upstream")} nodes={groups.upstream} reason={t("empty.upstream")} />
            <Group title={t("downstream")} nodes={groups.downstream} reason={t("empty.downstream")} />
            <Group title={t("lateral")} nodes={groups.lateral} reason={t("empty.lateral")} />

            {groups.downstream.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <h4 className="text-caption font-bold uppercase tracking-wide text-on-surface-subtle">{t("impact")}</h4>
                <p className="text-body text-on-surface">
                  {groups.downstream.map((n) => `${entityLabel(n.kind)} ${n.id}`).join(" · ")}
                </p>
                <p className="text-caption text-on-surface-muted">
                  {t("impactNote")}
                </p>
              </section>
            )}
          </div>
        ))}
    </div>
  );
}
