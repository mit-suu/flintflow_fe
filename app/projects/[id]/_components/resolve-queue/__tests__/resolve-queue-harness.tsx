import { useState } from "react";
import { vi, type Mock } from "vitest";
import type { Flag } from "@/types/flags";
import type { PendingItem, PendingQueue } from "@/types/pending-queue";
import type { Spine } from "@/types/spine";
import ResolveQueueDock from "../ResolveQueueDock";
import type { ResolveQueueHandlers } from "../resolve-queue-actions";
import { useResolveQueue, type ResolveQueueController, type UseResolveQueueArgs } from "../useResolveQueue";

export const item = (key: string, kind: PendingItem["kind"], refs: PendingItem["refs"], extra: Partial<PendingItem> = {}): PendingItem => ({
  key,
  kind,
  blocking: kind !== "flag_yellow_group",
  owner_step: "B-2.1",
  section_id: "fixed:2.1",
  entity_path: null,
  dependents: 0,
  refs,
  ...extra,
});

export const flag = (id: string, level: "red" | "yellow", message: string): Flag => ({
  id,
  level,
  rule_id: level === "red" ? "section_empty" : "orphan_actor",
  section_id: "fixed:2.1",
  message,
  remediation_step: "S-3.1",
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
});

export const SPINE = {
  assumptions: [
    { id: "AS01", path: "project.stakes", statement: "Users are students", statement_vi: "Người dùng là sinh viên", rationale: "Mentioned", rationale_vi: "Đã nhắc trong brief", origin_step_id: "B-1.1", status: "unconfirmed", confirmed_at: null },
    { id: "AS02", path: "nfrs", statement: "Peak load is 500 users", statement_vi: null, rationale: "", origin_step_id: "B-1.1", status: "unconfirmed", confirmed_at: null },
  ],
  addendum: [{ id: "AD01", topic: "note", content: "Cần đăng nhập bằng email trường", content_en: "", target_section: "fixed:2.1", captured_at: "2026-01-01T00:00:00Z" }],
  screens: [{ id: "S01", feature_id: "F1", name: "Trang chủ", description: "Màn đầu tiên", flow_to: [], is_popup: false, tabs: [], primary_function_id: null, queue_order: 1, detail_status: "pending" }],
} as unknown as Spine;

export const FLAGS: Flag[] = [
  flag("FR1", "red", "Mục fixed:2.1 còn trống"),
  flag("FY1", "yellow", "Actor A mồ côi"),
  flag("FY2", "yellow", "Actor B mồ côi"),
  flag("FY3", "yellow", "Actor C mồ côi"),
];

/** Handler giả: mỗi hàm là `vi.fn` để test đọc `.mock.calls`. */
export type MockHandlers = { [K in keyof Required<ResolveQueueHandlers>]: Mock<NonNullable<ResolveQueueHandlers[K]>> };

export const makeHandlers = (): MockHandlers => ({
  submitOps: vi.fn().mockResolvedValue(true),
  decideAssumption: vi.fn().mockResolvedValue(true),
  markPlaceholder: vi.fn().mockResolvedValue(true),
  keepFlag: vi.fn().mockResolvedValue(undefined),
  waiveFlag: vi.fn().mockResolvedValue(undefined),
  startEditing: vi.fn().mockReturnValue(true),
  postChatLine: vi.fn(),
  showSection: vi.fn(),
  isLocked: vi.fn().mockReturnValue(false),
  createCrFromFlags: vi.fn().mockResolvedValue("CR-001"),
});

interface HarnessProps {
  initial: PendingQueue;
  /** Hàng mà mỗi lần `reload()` lần lượt trả về (hết thì giữ hàng cuối). */
  reloads?: PendingQueue[];
  handlers: ResolveQueueHandlers;
  locked?: boolean;
  yielded?: boolean;
  enabled?: boolean;
  /** Chế độ 1 (FLF-445): thẻ nhóm cờ. */
  mode1?: boolean;
  crLock?: UseResolveQueueArgs["crLock"];
  flags?: Flag[];
  onController?: (controller: ResolveQueueController) => void;
}

/** Dựng hook + Dock như `page.tsx`, hàng việc nằm trong state để `reload()` đổi được. */
export function Harness({ initial, reloads = [], handlers, locked = false, yielded = false, enabled = true, mode1 = false, crLock = null, flags = FLAGS, onController }: HarnessProps) {
  const [queue, setQueue] = useState<PendingQueue | null>(initial);
  const [script] = useState(() => [...reloads]);
  const controller = useResolveQueue({
    projectId: "p1",
    queue,
    loading: false,
    reloadQueue: async () => {
      const next = script.shift() ?? queue;
      setQueue(next);
      return next;
    },
    spine: SPINE,
    flags,
    enabled,
    mode1,
    crLock,
    requester: "BA Lan",
    locked,
    yielded,
    sectionName: (id) => (id === "fixed:2.1" ? "2.1 Actors" : undefined),
    handlers,
  });
  onController?.(controller);
  return (
    <>
      <ResolveQueueDock controller={controller} onShowSection={handlers.showSection} />
      <button type="button" onClick={() => controller.openItem("brief_note:AD01")}>
        open-note
      </button>
    </>
  );
}

export const queueOf = (...items: PendingItem[]): PendingQueue => ({ total: items.length, items });
