/**
 * Step registry FE — dữ liệu copy từ BE `assets/step-registry.json` (nguồn sự thật, Phases §6.4)
 * bằng `npm run sync:registry`. Logic đếm/mở rộng phải khớp BE `modules/pipeline/step-registry.ts`.
 *
 *   Tổng = 50 + 5 × N,  N = số màn + 1 nếu có non-screen function
 */
import registry from "./step-registry.json";
import type { StepStatus } from "@/types/spine";

/** FLF-466: S-1 phân tích chạy trước B-2 (Approve Brief B-2.3 mở S-2) — thứ tự lấy từ BE `PHASES`. */
export const PHASES = ["B-0", "B-1", "S-1", "B-2", "S-2", "S-3", "S-4", "S-5", "S-6", "S-7", "S-8", "S-9"] as const;
export type PhaseId = (typeof PHASES)[number];

export type StepKind = "soft" | "fixed" | "loop" | "gate";

export interface StepDef {
  id: string;
  phase: PhaseId;
  phase_label_en: string;
  label_vi: string;
  label_en: string;
  kind: StepKind;
  reads: string[];
  writes: string[];
  renders: string[];
  uc: string[];
  deterministic: boolean;
  description: string;
}

export const STEP_REGISTRY: readonly StepDef[] = registry as unknown as StepDef[];

/** Nhãn phase trên UI (tiếng Việt). */
export const PHASE_LABELS_VI: Readonly<Record<PhaseId, string>> = {
  "B-0": "Tiếp nhận",
  "B-1": "Soạn Brief",
  "B-2": "Chốt Brief",
  "S-1": "Phân tích Brief",
  "S-2": "Tổng quan sản phẩm",
  "S-3": "Yêu cầu người dùng",
  "S-4": "Tổng quan chức năng",
  "S-5": "Chi tiết màn & chức năng",
  "S-6": "Yêu cầu phi chức năng",
  "S-7": "Phụ lục yêu cầu",
  "S-8": "Thuật ngữ & ghép tài liệu",
  "S-9": "Kiểm tra & baseline",
};

export const LOOP_PHASE: PhaseId = "S-5";
export const NONSCREEN_LOOP = "nonscreen";
export const FIXED_STEP_COUNT = 50;
export const STEPS_PER_LOOP = 5;
/** Phases §3: trần 8 lượt gọi model / step, 3 lần Regenerate / step. */
export const CALLS_LIMIT = 8;
export const REGENERATE_LIMIT = 3;
/** N chốt ở S-4.1; trước đó thanh tiến độ không hiện %. */
export const N_LOCKED_AT_STEP = "S-4.1";

export interface ExpandedStep extends StepDef {
  template_id: string;
  loop: string | null;
}

export interface LoopSource {
  screens: { id: string; queue_order: number | null; detail_status?: string }[];
  functions: { screen_id: string | null }[];
}

/** So mã màn theo số: `SCR-02` < `SCR-03` < `SCR-10` (cùng luật BE `compareScreenIds`). */
export const compareScreenIds = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

const LOOP_RANK: Readonly<Record<string, number>> = { signed_off: 0, in_progress: 1 };

/**
 * Thứ tự vòng S-5 (P06, chốt 17/11: theo số màn) — giống BE `screenLoopOrder`: màn đã xong / đang làm đứng trước, màn còn chờ
 * theo số màn. Trước đây theo `queue_order` model đặt ⇒ thanh tiến độ S02 → S07 → S03.
 */
export const screenLoopOrder = <T extends { id: string; detail_status?: string }>(screens: readonly T[]): T[] =>
  [...screens].sort((a, b) => (LOOP_RANK[a.detail_status ?? ""] ?? 2) - (LOOP_RANK[b.detail_status ?? ""] ?? 2) || compareScreenIds(a.id, b.id));

/**
 * P06: tên màn cho nhãn bước vòng S-5 ("Hàng đợi màn · Book Appointment" thay vì "· S06"). Trang workspace nạp theo Spine
 * (`setStepScreenNames`) trước khi các thành phần con dựng nhãn; chưa nạp / màn chưa có tên ⇒ giữ mã như cũ.
 */
let stepScreenNames: ReadonlyMap<string, string> = new Map();
export const setStepScreenNames = (names: ReadonlyMap<string, string>): void => {
  stepScreenNames = names;
};
export const loopDisplayName = (loop: string): string => stepScreenNames.get(loop) ?? loop;

export const parseStepId = (stepId: string): { base: string; loop: string | null } => {
  const at = stepId.indexOf("@");
  return at < 0 ? { base: stepId, loop: null } : { base: stepId.slice(0, at), loop: stepId.slice(at + 1) };
};

const expand = (def: StepDef, loop: string | null): ExpandedStep => ({
  ...def,
  id: loop ? `${def.id}@${loop}` : def.id,
  template_id: def.id,
  loop,
});

export const getStepDef = (stepId: string): ExpandedStep | undefined => {
  const { base, loop } = parseStepId(stepId);
  const def = STEP_REGISTRY.find((s) => s.id === base);
  if (!def || (def.kind === "loop") !== (loop !== null) || loop === "") return undefined;
  return expand(def, loop);
};

export const phaseOfStep = (stepId: string): PhaseId | undefined => getStepDef(stepId)?.phase;

export const loopKeys = (spine: LoopSource): string[] => {
  const screens = screenLoopOrder(spine.screens).map((s) => s.id);
  return spine.functions.some((f) => f.screen_id === null) ? [...screens, NONSCREEN_LOOP] : screens;
};

export const expandS5 = (spine: LoopSource): ExpandedStep[] => {
  const templates = STEP_REGISTRY.filter((s) => s.kind === "loop");
  return loopKeys(spine).flatMap((key) => templates.map((t) => expand(t, key)));
};

export const orderedSteps = (spine: LoopSource): ExpandedStep[] =>
  PHASES.flatMap((phase) =>
    phase === LOOP_PHASE ? expandS5(spine) : STEP_REGISTRY.filter((s) => s.phase === phase).map((s) => expand(s, null))
  );

export const totalSteps = (spine: LoopSource): number => FIXED_STEP_COUNT + STEPS_PER_LOOP * loopKeys(spine).length;

/** `Actor` · `Chi tiết chức năng · S07` · `Chi tiết chức năng · không màn hình`. */
export const stepLabel = (stepId: string): string => {
  const def = getStepDef(stepId);
  if (!def) return stepId;
  if (!def.loop) return def.label_vi;
  return `${def.label_vi} · ${def.loop === NONSCREEN_LOOP ? "không màn hình" : loopDisplayName(def.loop)}`;
};

export const isStepDone = (status: StepStatus | undefined): boolean => status === "accepted";
