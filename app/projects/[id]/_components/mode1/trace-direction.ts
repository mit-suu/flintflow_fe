/**
 * Chiều của bản đồ truy vết (UC 6.7).
 *
 * `GET /traceability` dựng cạnh từ `reference_fields[]` của BE, nên `edge.from → edge.to` là hướng của
 * **khoá** — "ai nhắc tới ai" — chứ không phải "ai sinh ra ai". `use_cases[].actor_ids[]` cho cạnh
 * `UC-03 → A01`, nhưng về nghiệp vụ actor là *nguồn* của use case. Dùng thẳng hướng khoá thì giao diện
 * nói ngược. `TRACE_DIR` là lớp ngữ nghĩa bù cho chỗ đó.
 *
 * Chiều lấy theo thứ tự phase sinh ra thực thể: actor/use case (S-3) → feature/screen (S-4) →
 * function (S-5) → business rule (S-7).
 *
 * Danh sách field dưới đây là đúng những field có thể thành cạnh: cả phía sở hữu và phía đích đều phải là
 * một trong 8 loại node của `traceabilityEntitySchema`, nên cạnh của `roles` / `messages` / `diagrams` bị
 * BE bỏ, trừ cầu phân quyền (`permissions`) mà BE gộp thành một cạnh `actor → screen`.
 * Nguồn: `flintflow_be/src/modules/spine/reference-fields.ts` + `traceability.service.ts`.
 *
 * BE thêm reference field mới mà đây chưa biết ⇒ cạnh đó rơi vào `lateral`: hiện ở "Liên quan ngang",
 * không mất node và không nói sai chiều, nhưng sai nhóm. Bảng này chép tay nên không tự phát hiện được
 * việc đó — khi sửa BE phải sửa cả đây.
 */
import type { Spine } from "@/types/spine";
import type { TraceabilityEdge, TraceabilityEntity, TraceabilityResponse } from "@/types/flags";

/** Đầu nào của cạnh là nguồn: phía `from`, phía `to`, hay không có trên dưới. */
export type TraceDirection = "from" | "to" | "lateral";

export const TRACE_DIR: Readonly<Record<string, TraceDirection>> = {
  actor_ids: "to", // use_case → actor; actor là nguồn
  function_ids: "from", // use_case → function; use case có trước function
  includes: "lateral", // use_case ↔ use_case
  extends: "lateral", // use_case ↔ use_case
  feature_id: "to", // screen → feature, function → feature; feature là nguồn của cả hai
  flow_to: "lateral", // screen ↔ screen, luồng chuyển màn
  primary_function_id: "from", // screen → function; màn là nguồn
  screen_id: "to", // function → screen; màn là nguồn
  business_rule_ids: "from", // function → business_rule; luật suy từ validation của function
  relations: "lateral", // entity ↔ entity
  source_validation_ids: "to", // business_rule → function; function là nguồn
  permissions: "from", // actor → screen (cầu phân quyền); actor là nguồn
};

export const traceDirection = (field: string): TraceDirection => TRACE_DIR[field] ?? "lateral";

export interface TraceGroupNode {
  kind: TraceabilityEntity;
  id: string;
  label: string;
  /** Field đã nối nó về phía gốc — để nói "nối bằng cái gì". */
  field: string;
}

export interface TraceGroups {
  root: { kind: TraceabilityEntity; id: string; label: string } | null;
  /** Thực thể mà gốc sinh ra từ đó. */
  upstream: TraceGroupNode[];
  /** Thực thể sinh ra từ gốc — cũng chính là tập "sửa gốc thì kéo theo". */
  downstream: TraceGroupNode[];
  /** Quan hệ ngang: include/extend, chuyển màn, quan hệ thực thể, phân quyền cùng mức. */
  lateral: TraceGroupNode[];
}

const EMPTY: TraceGroups = { root: null, upstream: [], downstream: [], lateral: [] };

/** Chiều của cả đường đi từ gốc tới một node. `lateral` nghĩa là "chỉ liên quan", không trên không dưới. */
type Chain = "down" | "up" | "lateral";

/** Hợp hai chặng: cùng chiều thì giữ chiều, lẫn chiều hoặc có chặng ngang thì cả đường chỉ là liên quan. */
const chain = (sofar: Chain | undefined, step: Chain): Chain => (sofar === undefined ? step : sofar === step ? step : "lateral");

/**
 * Nhóm đồ thị quanh một gốc thành 3 chiều.
 *
 * Đồ thị BE sâu 2 bước (`DEFAULT_DEPTH`, không có query `depth`). Node cách gốc 2 bước xếp theo **hợp
 * thành của cả đường đi**, không theo cạnh đầu: chuỗi toàn xuống mới là "dẫn tới" (nên "sửa thì kéo theo"
 * vẫn lan được 2 bước: actor → use case → function), chuỗi toàn lên mới là "từ đâu ra", còn đường lẫn
 * chiều thì chỉ là "liên quan ngang".
 *
 * Xếp theo cạnh đầu thì sai bản chất: feature của một function nằm cách use case 2 bước (xuống rồi lên)
 * sẽ bị gọi là use case "dẫn tới" feature, trong khi feature có trước use case.
 *
 * `field` của mỗi node là field của **cạnh nối chính nó**, không phải cạnh đầu — để câu "nối bằng" nói
 * đúng quan hệ của node đó.
 */
export const groupTrace = (response: TraceabilityResponse, rootId: string): TraceGroups => {
  const root = response.nodes.find((n) => n.id === rootId);
  if (!root) return EMPTY;

  const byId = new Map(response.nodes.map((n) => [n.id, n]));
  const neighbours = new Map<string, TraceabilityEdge[]>();
  for (const edge of response.edges) {
    for (const side of [edge.from, edge.to]) {
      const list = neighbours.get(side);
      if (list) list.push(edge);
      else neighbours.set(side, [edge]);
    }
  }

  const groups: TraceGroups = { root, upstream: [], downstream: [], lateral: [] };
  const chains = new Map<string, Chain>();
  const via = new Map<string, TraceabilityEdge>();
  const seen = new Set([rootId]);
  let frontier = [rootId];

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of neighbours.get(id) ?? []) {
        const other = edge.from === id ? edge.to : edge.from;
        if (seen.has(other) || !byId.has(other)) continue;
        const direction = traceDirection(edge.field);
        // Chặng này đi xuống khi phía nguồn của cạnh là node đang đứng; đi lên khi nguồn là node kia
        const step: Chain = direction === "lateral" ? "lateral" : (direction === "from" ? edge.from : edge.to) === id ? "down" : "up";
        seen.add(other);
        chains.set(other, chain(chains.get(id), step));
        via.set(other, edge);
        next.push(other);
      }
    }
    frontier = next;
  }

  for (const [id, edge] of via) {
    const node = byId.get(id)!;
    const entry: TraceGroupNode = { kind: node.kind, id: node.id, label: node.label, field: edge.field };
    const where = chains.get(id);
    if (where === "down") groups.downstream.push(entry);
    else if (where === "up") groups.upstream.push(entry);
    else groups.lateral.push(entry);
  }

  return groups;
};

/** Loại node ↔ collection Spine. Chỉ 8 loại này có mặt trong `traceabilityEntitySchema`. */
const COLLECTION: Readonly<Record<TraceabilityEntity, keyof Spine>> = {
  actor: "actors",
  use_case: "use_cases",
  function: "functions",
  screen: "screens",
  entity: "entities",
  nfr: "nfrs",
  feature: "features",
  business_rule: "business_rules",
};

/** Nhãn dài (statement của NFR / business rule) cắt cho vừa một dòng dropdown. */
const SHORT = 56;

/**
 * Danh sách phần tử của một loại, lấy từ Spine đang mở — để chọn thực thể bằng tên thay vì gõ mã.
 * Nhãn theo cùng luật `labelOf` của BE: `name` trước, không có thì `statement`, cuối cùng là `id`.
 */
export const traceEntityOptions = (spine: Spine, kind: TraceabilityEntity): { value: string; label: string }[] => {
  const list = spine[COLLECTION[kind]];
  if (!Array.isArray(list)) return [];
  return (list as { id: string; name?: string; statement?: string }[]).map((item) => {
    const text = item.name ?? item.statement ?? "";
    const short = text.length > SHORT ? `${text.slice(0, SHORT - 1)}…` : text;
    return { value: item.id, label: short ? `${item.id} — ${short}` : item.id };
  });
};
