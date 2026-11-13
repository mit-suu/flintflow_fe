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
  state: "decisions",
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
    extra: [{ id: "e:o1", old_key: "o1", heading_text: "Ghi chú triển khai", section_id: "custom:c1", follower_keys: [], choices: ["keep_custom", "delete", "move_to:n1"], ai_choices: [], decision_required: true }],
  }),
  decisions: [],
  undecided: ["e:o1"],
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
