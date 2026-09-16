/**
 * Trạng thái của mock server (T12) — một project chạy pipeline theo `pipeline-contract.md`
 * trên dữ liệu fixture T02 (`spine-fixture-minimal.json`), để FE chạy trọn trước khi T13 có API thật.
 */
import minimalFixture from "./fixtures/spine-fixture-minimal.json";
import { STEP_REGISTRY, orderedSteps } from "@/lib/constants/step-registry";
import type { ChatSession } from "@/types/chat";
import type { Project } from "@/types/project";
import type { Spine, StepStatus } from "@/types/spine";
import type { StepAnswer } from "@/types/pipeline";
import type { User } from "@/types/user";

export const MOCK_PROJECT_ID = "650000000000000000000001";
export const MOCK_SESSION_ID = "650000000000000000000abc";

/** Step bắt đầu của kịch bản mock: mọi step trước S-3.1 đã accepted. */
export const MOCK_START_STEP = "S-3.1";

export interface MockStepCounters {
  regenerate_used: number;
  calls_used: number;
  answered: boolean;
}

export interface MockState {
  project: Project;
  user: User;
  sessions: ChatSession[];
  spine: Spine;
  counters: Map<string, MockStepCounters>;
  /** Step đang chờ `POST /answer` — luồng SSE đợi promise này. */
  waiting: Map<string, (answers: StepAnswer[]) => void>;
}

const now = () => new Date().toISOString();

const initialSpine = (): Spine => {
  const base = structuredClone(minimalFixture) as unknown as Omit<Spine, "projectId">;
  const before = STEP_REGISTRY.filter((s) => s.kind !== "loop")
    .map((s) => s.id)
    .slice(0, STEP_REGISTRY.findIndex((s) => s.id === MOCK_START_STEP));
  return {
    ...base,
    projectId: MOCK_PROJECT_ID,
    spine_version: before.length + 1,
    progress: { ...base.progress, current_phase: "S-3", current_step: MOCK_START_STEP },
    steps: before.map((id, i) => ({ id, status: "accepted" as const, first_seq: i + 1, last_seq: i + 1, accepted_at: now() })),
  };
};

export const createMockState = (): MockState => ({
  project: {
    _id: MOCK_PROJECT_ID,
    name: "FlintFlow (mock)",
    domain: "SaaS",
    status: "active",
    currentStep: MOCK_START_STEP,
    progressPercent: 0,
    createdAt: now(),
    updatedAt: now(),
  },
  user: { id: "650000000000000000000010", email: "mock@flintflow.local", balance: 500 },
  sessions: [{ _id: MOCK_SESSION_ID, projectId: MOCK_PROJECT_ID, messages: [], isActive: true, createdAt: now() }],
  spine: initialSpine(),
  counters: new Map(),
  waiting: new Map(),
});

export let mockState: MockState = createMockState();

export const resetMockState = (): MockState => {
  mockState = createMockState();
  return mockState;
};

export const countersOf = (state: MockState, stepId: string): MockStepCounters => {
  const existing = state.counters.get(stepId);
  if (existing) return existing;
  const created = { regenerate_used: 0, calls_used: 0, answered: false };
  state.counters.set(stepId, created);
  return created;
};

export const stepStatusOf = (state: MockState, stepId: string): StepStatus =>
  state.spine.steps.find((s) => s.id === stepId)?.status ?? "pending";

export const setStepStatus = (state: MockState, stepId: string, status: StepStatus): void => {
  const existing = state.spine.steps.find((s) => s.id === stepId);
  const accepted_at = status === "accepted" ? now() : null;
  if (existing) Object.assign(existing, { status, accepted_at });
  else state.spine.steps.push({ id: stepId, status, first_seq: null, last_seq: null, accepted_at });
};

/** Step kế tiếp chưa accepted theo registry. */
export const nextMockStep = (state: MockState): string | null =>
  orderedSteps(state.spine).find((s) => stepStatusOf(state, s.id) !== "accepted")?.id ?? null;
