/**
 * Nguồn định nghĩa duy nhất cho SectionType và metadata trong FlintFlow frontend.
 * Khớp 100% với BE constants (flintflow_be/src/shared/constants/section-types.ts).
 *
 * Phân loại theo SRS Capstone Report 3:
 * - Phase 2 (Foundation / Discovery): 7 loại (toàn bộ mappedToTemplate: true)
 * - Phase 3 (Core Functional Specification): 10 loại (8 mappedToTemplate: true, 2 false)
 * - Phase 4 (Non-functional & Finalization): 8 loại (7 mappedToTemplate: true, 1 false)
 *
 * Tổng cộng: 25 loại (22 mappedToTemplate = true, 3 mappedToTemplate = false).
 */

export const SECTION_TYPE_VALUES = [
  // Phase 2
  "vision_problem",
  "business_goals",
  "value_proposition",
  "high_level_business_rules",
  "stakeholders",
  "user_journey",
  "use_case_spec",

  // Phase 3
  "screen_flow",
  "screen_description",
  "rbac",
  "non_screen_functions",
  "erd",
  "functional_requirements",
  "user_story",
  "acceptance_criteria",
  "priority_ranking",
  "scope_out_of_scope",

  // Phase 4
  "external_interfaces",
  "non_functional_requirements",
  "common_business_rules",
  "common_requirements",
  "application_messages",
  "assumptions_risks",
  "glossary",
  "success_metrics",
] as const;

export type SectionType = (typeof SECTION_TYPE_VALUES)[number];

export interface SectionTypeMetadata {
  phase: 2 | 3 | 4;
  mappedToTemplate: boolean;
  label: string;
  order: number;
}

export const SECTION_METADATA: Record<SectionType, SectionTypeMetadata> = {
  // ─── Phase 2 (Foundation & Overview) ───────────────────────────────────────
  vision_problem: {
    phase: 2,
    mappedToTemplate: true,
    label: "Vision & Problem",
    order: 1,
  },
  business_goals: {
    phase: 2,
    mappedToTemplate: true,
    label: "Business Goals",
    order: 2,
  },
  value_proposition: {
    phase: 2,
    mappedToTemplate: true,
    label: "Value Proposition",
    order: 3,
  },
  high_level_business_rules: {
    phase: 2,
    mappedToTemplate: true,
    label: "High-Level Business Rules",
    order: 4,
  },
  stakeholders: {
    phase: 2,
    mappedToTemplate: true,
    label: "Stakeholders",
    order: 5,
  },
  user_journey: {
    phase: 2,
    mappedToTemplate: true,
    label: "User Journey",
    order: 6,
  },
  use_case_spec: {
    phase: 2,
    mappedToTemplate: true,
    label: "Use Case Specs",
    order: 7,
  },

  // ─── Phase 3 (Core Functional Specification) ──────────────────────────────
  screen_flow: {
    phase: 3,
    mappedToTemplate: true,
    label: "Screen Flow",
    order: 8,
  },
  screen_description: {
    phase: 3,
    mappedToTemplate: true,
    label: "Screen Description",
    order: 9,
  },
  rbac: {
    phase: 3,
    mappedToTemplate: true,
    label: "RBAC / Permissions",
    order: 10,
  },
  non_screen_functions: {
    phase: 3,
    mappedToTemplate: true,
    label: "Non-Screen Functions",
    order: 11,
  },
  erd: {
    phase: 3,
    mappedToTemplate: true,
    label: "ERD Diagram",
    order: 12,
  },
  functional_requirements: {
    phase: 3,
    mappedToTemplate: true,
    label: "Functional Requirements",
    order: 13,
  },
  user_story: {
    phase: 3,
    mappedToTemplate: true,
    label: "User Stories",
    order: 14,
  },
  acceptance_criteria: {
    phase: 3,
    mappedToTemplate: true,
    label: "Acceptance Criteria",
    order: 15,
  },
  priority_ranking: {
    phase: 3,
    mappedToTemplate: false,
    label: "Priority Ranking (MoSCoW)",
    order: 16,
  },
  scope_out_of_scope: {
    phase: 3,
    mappedToTemplate: false,
    label: "Scope & Out-of-Scope",
    order: 17,
  },

  // ─── Phase 4 (Non-functional & Finalization) ───────────────────────────────
  external_interfaces: {
    phase: 4,
    mappedToTemplate: true,
    label: "External Interfaces",
    order: 18,
  },
  non_functional_requirements: {
    phase: 4,
    mappedToTemplate: true,
    label: "Non-Functional Requirements",
    order: 19,
  },
  common_business_rules: {
    phase: 4,
    mappedToTemplate: true,
    label: "Common Business Rules",
    order: 20,
  },
  common_requirements: {
    phase: 4,
    mappedToTemplate: true,
    label: "Common Requirements",
    order: 21,
  },
  application_messages: {
    phase: 4,
    mappedToTemplate: true,
    label: "Application Messages",
    order: 22,
  },
  assumptions_risks: {
    phase: 4,
    mappedToTemplate: true,
    label: "Assumptions & Risks",
    order: 23,
  },
  glossary: {
    phase: 4,
    mappedToTemplate: true,
    label: "Glossary",
    order: 24,
  },
  success_metrics: {
    phase: 4,
    mappedToTemplate: false,
    label: "Success Metrics",
    order: 25,
  },
};

/**
 * Nhãn hiển thị cho từng SectionType (tương thích ngược với SECTION_TYPE_LABELS cũ).
 */
export const SECTION_TYPE_LABELS: Record<SectionType, string> = Object.fromEntries(
  SECTION_TYPE_VALUES.map((t) => [t, SECTION_METADATA[t].label])
) as Record<SectionType, string>;

/**
 * Danh sách phases cho tab navigation.
 */
export const PHASES = [
  { id: 2 as const, name: "Phase 2: Discovery & Foundation", shortName: "Phase 2" },
  { id: 3 as const, name: "Phase 3: Core Functional Specs", shortName: "Phase 3" },
  { id: 4 as const, name: "Phase 4: Non-Functional & Release", shortName: "Phase 4" },
] as const;

export const getSectionsByPhase = (phase: 2 | 3 | 4): SectionType[] => {
  return SECTION_TYPE_VALUES.filter((type) => SECTION_METADATA[type].phase === phase);
};

// ─── WorkspacePhase (UI-level phase, matching Prototype B2 & file step.md) ───

export type WorkspacePhase =
  | "discovery"
  | "product_overview"
  | "functional_spec"
  | "nfr_appendix"
  | "export";

export interface WorkspacePhaseInfo {
  id: WorkspacePhase;
  label: string;
  shortLabel: string;
  description: string;
  order: number;
}

export const WORKSPACE_PHASES: WorkspacePhaseInfo[] = [
  {
    id: "discovery",
    label: "Discovery",
    shortLabel: "Discovery",
    description: "Khảo sát, phỏng vấn và chốt Product Brief",
    order: 1
  },
  {
    id: "product_overview",
    label: "Product Overview",
    shortLabel: "Overview",
    description: "S-2: Tổng quan sản phẩm, Business Rules, Context Diagram",
    order: 2
  },
  {
    id: "functional_spec",
    label: "Functional Spec",
    shortLabel: "Functional",
    description: "S-3 & S-4: Screen Flow, ERD, Functional Requirements, User Stories",
    order: 3
  },
  {
    id: "nfr_appendix",
    label: "NFR & Appendix",
    shortLabel: "NFR & Appx",
    description: "S-5 & S-6: Phi chức năng, External Interfaces, Phụ lục, Glossary",
    order: 4
  },
  {
    id: "export",
    label: "Export & Handoff",
    shortLabel: "Export",
    description: "S-7 & S-8: Assemble, Verify, Baseline v1.0 & Export",
    order: 5
  }
];

export const PHASE_SECTION_MAP: Record<WorkspacePhase, SectionType[]> = {
  discovery: [],
  product_overview: [
    "vision_problem",
    "business_goals",
    "value_proposition",
    "high_level_business_rules",
    "stakeholders",
    "user_journey",
    "use_case_spec"
  ],
  functional_spec: [
    "screen_flow",
    "screen_description",
    "rbac",
    "non_screen_functions",
    "erd",
    "functional_requirements",
    "user_story",
    "acceptance_criteria",
    "priority_ranking",
    "scope_out_of_scope"
  ],
  nfr_appendix: [
    "external_interfaces",
    "non_functional_requirements",
    "common_business_rules",
    "common_requirements",
    "application_messages",
    "assumptions_risks",
    "glossary",
    "success_metrics"
  ],
  export: []
};

// ─── SRS Document Tree — 5 chương FPT Template (cho DocumentPane) ──────

export interface SRSChapter {
  id: string;
  chapterNumber: number;
  title: string;
  sections: SectionType[];
}

export const SRS_CHAPTERS: SRSChapter[] = [
  {
    id: "ch1",
    chapterNumber: 1,
    title: "1. Product Overview",
    sections: [
      "vision_problem",
      "business_goals",
      "value_proposition",
      "high_level_business_rules"
    ]
  },
  {
    id: "ch2",
    chapterNumber: 2,
    title: "2. User Requirements",
    sections: ["stakeholders", "user_journey", "use_case_spec"]
  },
  {
    id: "ch3",
    chapterNumber: 3,
    title: "3. Functional Requirements",
    sections: [
      "screen_flow",
      "screen_description",
      "rbac",
      "non_screen_functions",
      "erd",
      "functional_requirements",
      "user_story",
      "acceptance_criteria",
      "priority_ranking",
      "scope_out_of_scope"
    ]
  },
  {
    id: "ch4",
    chapterNumber: 4,
    title: "4. Non-Functional Requirements",
    sections: ["external_interfaces", "non_functional_requirements"]
  },
  {
    id: "ch5",
    chapterNumber: 5,
    title: "5. Requirement Appendix",
    sections: [
      "common_business_rules",
      "common_requirements",
      "application_messages",
      "assumptions_risks",
      "glossary",
      "success_metrics"
    ]
  }
];

// ─── Discovery 6-Step Mapping (file step.md) ──────────────────────────

export type DiscoveryStepNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface DiscoveryStepInfo {
  step: DiscoveryStepNumber;
  label: string;
  shortLabel: string;
  chatStepName: SectionType;
  description: string;
  sampleQuestions: string[];
}

/**
 * T20: nhãn 6 bước Discovery cũ. Nguồn sự thật giờ là **step registry**
 * (`lib/constants/step-registry.json`, 13 step B-0…B-2 + 4 step S-1) — dùng `stepLabel()` / `getStepDef()`
 * thay cho danh sách này. Giữ lại vì `sampleQuestions` còn là gợi ý cho skill `product-brief`; cả file
 * `section-types.ts` bị xoá ở T21.
 */
export const DISCOVERY_STEPS: DiscoveryStepInfo[] = [
  {
    step: 1,
    label: "Product Vision, Problem & Opportunity",
    shortLabel: "Vision & Problem",
    chatStepName: "vision_problem",
    description: "Vấn đề gốc, cơ hội, vision, why-now, mục tiêu kinh doanh",
    sampleQuestions: [
      "Sản phẩm giải quyết vấn đề gì và cho ai?",
      "Tại sao giải pháp này cần thiết vào lúc này?",
      "Mục tiêu kinh doanh cụ thể là gì?"
    ]
  },
  {
    step: 2,
    label: "Target Users & Jobs-to-be-Done",
    shortLabel: "Users & JTBD",
    chatStepName: "stakeholders",
    description: "Người dùng mục tiêu, vai trò liên quan, job cần hoàn thành",
    sampleQuestions: [
      "Ai là người dùng chính của hệ thống?",
      "Có các vai trò nào khác (admin, quản trị viên, đối tác)?",
      "Mỗi nhóm người dùng cần hoàn thành công việc gì?"
    ]
  },
  {
    step: 3,
    label: "Value Proposition & Differentiation",
    shortLabel: "Value Prop",
    chatStepName: "value_proposition",
    description: "Giá trị cốt lõi, khác biệt so với giải pháp hiện tại",
    sampleQuestions: [
      "Giá trị lớn nhất mà hệ thống mang lại là gì?",
      "Điểm khác biệt so với các giải pháp trên thị trường?",
      "Tại sao người dùng nên chọn sản phẩm này?"
    ]
  },
  {
    step: 4,
    label: "MVP Scope & Feature Hypotheses",
    shortLabel: "Scope & Features",
    chatStepName: "functional_requirements",
    description: "Tính năng MUST HAVE cho MVP, ràng buộc kỹ thuật & thời gian",
    sampleQuestions: [
      "Những tính năng nào bắt buộc phải có trong phiên bản MVP?",
      "Có những tính năng nào quyết định KHÔNG làm ở bản đầu?",
      "Ràng buộc về công nghệ, ngân sách hoặc thời gian?"
    ]
  },
  {
    step: 5,
    label: "Success Metrics & Learning Goals",
    shortLabel: "Metrics",
    chatStepName: "success_metrics",
    description: "Tiêu chí thành công, KPI đo lường hiệu quả",
    sampleQuestions: [
      "Chỉ số nào dùng để đo lường thành công của sản phẩm?",
      "Mục tiêu số lượng người dùng / giao dịch trong 3 tháng đầu?",
      "Các chỉ số về hiệu năng và độ ổn định mong đợi?"
    ]
  },
  {
    step: 6,
    label: "Risks, Assumptions & Open Questions",
    shortLabel: "Risks & Questions",
    chatStepName: "assumptions_risks",
    description: "Rủi ro lớn nhất, giả định cần kiểm chứng, câu hỏi mở",
    sampleQuestions: [
      "Rủi ro lớn nhất về mặt kỹ thuật hoặc thị trường là gì?",
      "Những giả định ngầm nào cần được xác thực sớm?",
      "Còn thắc mắc hoặc câu hỏi mở nào chưa được giải đáp?"
    ]
  }
];

// ─── Discovery Evaluation (from AI Chat response) ──────────────────────────

export interface DiscoveryEvaluation {
  currentStep: number;
  stepCompleteness: number;
  isStepComplete: boolean;
  isDiscoveryComplete: boolean;
  recommendedAction:
    | "ask_clarification"
    | "propose_next_step"
    | "show_summary"
    | "continue_discussion";
  stepSummary?: string;
  missingInfo?: string[];
}

export interface DiscoveryQuestion {
  question: string;
  suggestedAnswers: string[];
  multiple?: boolean;
}

