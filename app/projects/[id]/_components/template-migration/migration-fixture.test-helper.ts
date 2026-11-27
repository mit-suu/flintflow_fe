import type { Migration, MigrationGroups } from "@/types/template-migration";

export const emptyGroups = (over: Partial<MigrationGroups> = {}): MigrationGroups => ({
  matched: [],
  missing: [],
  extra: [],
  conflict: [],
  edited_since: [],
  structure_only_dropped: [],
  restored_from_snapshot: null,
  ...over,
});

/** `MigrationDto` mẫu cho test: hai heading cũ, ba heading mới, một mục thiếu. */
export const migrationFixture = (over: Partial<Migration> = {}): Migration => ({
  id: "m1",
  project_id: "p1",
  state: "mapping_review",
  direction: "forward",
  reverse_of: null,
  from: {
    template_ref: { template_id: "t1", version: 1 },
    language: "vi",
    template_family: null,
    headings: [
      { key: "o0", heading_text: "Giới thiệu", level: 1, section_id: "fixed:1" },
      { key: "o1", heading_text: "Ghi chú triển khai", level: 1, section_id: "custom:c1" },
    ],
  },
  to: {
    template_id: "t1",
    version: 2,
    name: "Mẫu ngân hàng",
    visibility: "org",
    language: "vi",
    template_family: null,
    headings: [
      { key: "n0", heading_text: "1 Introduction", section_id: "fixed:1" },
      { key: "n1", heading_text: "Phạm vi", section_id: "custom:new", guidance: "[Nêu phạm vi]" },
      { key: "n2", heading_text: "Phụ lục", section_id: "unmapped", auto_confirmed: true },
    ],
  },
  pairing: {
    pairs: [
      { old_key: "o0", new_key: "n0", by: "section_id", score: 1, needs_review: false },
      { old_key: "o1", new_key: null, by: null, score: 0, needs_review: false },
    ],
    followers: [],
    ignored_new: [],
    split: [],
  },
  groups: emptyGroups({
    matched: [{ id: "m:o0", old_key: "o0", new_key: "n0", by: "section_id", needs_review: false }],
    missing: [{ id: "x:n1", new_key: "n1", heading_text: "Phạm vi", section_id: "custom:new", needs_content: true, guidance: "[Nêu phạm vi]" }],
    extra: [{ id: "e:o1", old_key: "o1", heading_text: "Ghi chú triển khai", section_id: "custom:c1", follower_keys: [], choices: ["keep_custom", "drop_from_print", "move_to:n1"], ai_choices: [], decision_required: true, suggested: "move_to:n1", suggested_reason: "close_name", confidence: "guess" }],
  }),
  decisions: [],
  undecided: ["e:o1"],
  outline: [
    { heading_text: "1 Introduction", level: 1, status: "kept" },
    { heading_text: "Phạm vi", level: 1, status: "receives", from_heading: ["Ghi chú triển khai"] },
    { heading_text: "Phụ lục", level: 1, status: "needs_content" },
  ],
  language: { source: "vi", target: "vi", needs_translation: false, switches_document_language: false },
  credit_estimate: { translation: { chars: 0, batches: 0, credits: 0 }, structural_moves: { count: 0, credits: 0 }, ai_resolve: { count: 0, credits: 0 }, total: 0 },
  warnings: [],
  broken_links: [],
  revertable: null,
  revert_blocked_reason: null,
  previous_template: null,
  prepared_spine_version: null,
  prepared_source_sha256: null,
  applied_at: null,
  created_by: "u1",
  created_at: "2026-11-11T00:00:00.000Z",
  updated_at: "2026-11-11T00:00:00.000Z",
  ...over,
});

/**
 * Mẫu đích có cấu trúc: heading nhóm "1 Giới thiệu" (mục con 1.1 trống, 1.2 đã ghép với "Phạm vi"), "3.4 Tuân thủ" ghép theo id với
 * "Yêu cầu khác". Mục thừa "Mục tiêu" (12 phần tử) chuyển được vào mọi mục, gợi ý 1.2.
 */
export const placeableFixture = (): Migration =>
  migrationFixture({
    undecided: [],
    from: {
      template_ref: { template_id: "t1", version: 1 },
      language: "vi",
      template_family: null,
      headings: [
        { key: "o0", heading_text: "Yêu cầu khác", level: 1, section_id: "fixed:5.4" },
        { key: "o1", heading_text: "Mục tiêu", level: 1, section_id: "custom:goals" },
        { key: "o2", heading_text: "Phạm vi", level: 1, section_id: "fixed:1.2" },
      ],
    },
    to: {
      template_id: "t1",
      version: 2,
      name: "Mẫu IEEE",
      visibility: "org",
      language: "vi",
      template_family: null,
      headings: [
        { key: "n0", heading_text: "1 Giới thiệu", section_id: "group:1", level: 1 },
        { key: "n1", heading_text: "1.1 Mục đích", section_id: "fixed:1.1", level: 2 },
        { key: "n2", heading_text: "1.2 Phạm vi", section_id: "fixed:1.2", level: 2, guidance: "[Phạm vi và mục tiêu sản phẩm]" },
        { key: "n3", heading_text: "3.4 Tuân thủ", section_id: "fixed:5.4", level: 1 },
      ],
    },
    pairing: {
      pairs: [
        { old_key: "o0", new_key: "n3", by: "section_id", score: 1, needs_review: false },
        { old_key: "o1", new_key: null, by: null, score: 0, needs_review: false },
        { old_key: "o2", new_key: "n2", by: "section_id", score: 1, needs_review: false },
      ],
      followers: [],
      ignored_new: [],
      split: [],
    },
    groups: emptyGroups({
      matched: [
        { id: "m:o0", old_key: "o0", new_key: "n3", by: "section_id", needs_review: false },
        { id: "m:o2", old_key: "o2", new_key: "n2", by: "section_id", needs_review: false },
      ],
      missing: [{ id: "x:n1", new_key: "n1", heading_text: "1.1 Mục đích", section_id: "fixed:1.1", needs_content: true, guidance: null }],
      extra: [
        {
          id: "e:o1",
          old_key: "o1",
          heading_text: "Mục tiêu",
          section_id: "custom:goals",
          follower_keys: [],
          choices: ["keep_custom", "drop_from_print", "move_to:n0", "move_to:n1", "move_to:n2", "move_to:n3"],
          ai_choices: [],
          decision_required: true,
          suggested: "move_to:n2",
          suggested_reason: "best_fit",
          confidence: "high",
          targets: [{ new_key: "n2", score: 0.72, why: ["guidance", "data_fit"] }],
          data_size: 12,
        },
      ],
    }),
  });
