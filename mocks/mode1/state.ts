/**
 * Trạng thái mock mode 1 (FLF-171, plan mode 1 §5.8): một project `mode = "import"` đi trọn
 * import → gap report → change request → version → release theo `docs/api/import-change-contract.md` (BE),
 * để FE (P3) làm trên msw trước khi P2 có API thật.
 */
import type { Project } from "@/types/project";
import type { Baseline } from "@/types/spine";
import type { DocBlock, ExtractionSection, ImportedDocument, ReuploadDiff, ReviewField, TemplateProfile } from "@/types/import";
import type { DocVersion } from "@/types/doc-version";
import type { CrDetail } from "@/types/change-request";

export const MODE1_PROJECT_ID = "650000000000000000000002";
export const MODE1_USER_ID = "650000000000000000000010";

export interface Mode1MockState {
  project: Project;
  /** Project tạo thêm qua `POST /projects` trong phiên mock. */
  created: Project[];
  spineVersion: number;
  /** Credit còn lại cho lượt gọi AI — test đặt về 0 để thử pause. */
  credits: number;
  /** Số cờ đỏ còn mở sau import — test đặt 0 để release được. */
  redFlags: number;
  importDoc: ImportedDocument | null;
  profile: TemplateProfile | null;
  sections: ExtractionSection[];
  reviewFields: ReviewField[];
  baselines: Baseline[];
  versions: DocVersion[];
  blocks: Map<string, DocBlock[]>;
  reuploads: ReuploadDiff[];
  crs: Map<string, CrDetail>;
  crSeq: number;
}

const now = () => new Date().toISOString();

const block = (n: number, kind: DocBlock["kind"], text: string, extra: Partial<DocBlock> = {}): DocBlock => ({
  block_id: `B${String(n).padStart(4, "0")}`,
  doc_version: "0.0",
  kind,
  level: kind === "heading" ? 1 : null,
  heading_path: [],
  text,
  section_id: null,
  mentions: [],
  editable: kind !== "unsupported",
  locked_by_cr: null,
  ...extra,
});

/** Tài liệu mẫu 0.0 — theo `doc/sample-baseline.docx` rút gọn. */
export const initialBlocks = (): DocBlock[] => [
  block(1, "heading", "1 Product Overview", { section_id: "fixed:1" }),
  block(2, "paragraph", "Lumen is an online learning platform that lets instructors publish courses and students learn at their own pace.", { heading_path: ["1 Product Overview"], section_id: "fixed:1" }),
  block(3, "list_item", "BR-01: A course must have at least one lesson before publishing.", { heading_path: ["1 Product Overview"], section_id: "fixed:1", mentions: [{ entity: "business_rule", id: "BR-01" }] }),
  block(4, "heading", "2.1 Actors", { level: 2, section_id: "fixed:2.1" }),
  block(5, "table_cell", "Student — Enrolls in courses and completes lessons", { heading_path: ["2 User Requirements", "2.1 Actors"], section_id: "fixed:2.1" }),
  block(6, "table_cell", "Instructor — Creates and publishes courses", { heading_path: ["2 User Requirements", "2.1 Actors"], section_id: "fixed:2.1" }),
  block(7, "heading", "3.2.4 Log out of system", { level: 3, section_id: "fixed:3.1.2", mentions: [{ entity: "use_case", id: "UC-2.4" }] }),
  block(8, "paragraph", "The user logs out of the current browser session.", { heading_path: ["3.2.4 Log out of system"], section_id: "fixed:3.1.2" }),
  block(9, "heading", "4.2.3 Performance", { level: 3, section_id: "fixed:4.2.3" }),
  block(10, "list_item", "NFR-P02: The system responds quickly under load.", { heading_path: ["4.2.3 Performance"], section_id: "fixed:4.2.3", mentions: [{ entity: "nfr", id: "NFR-P02" }] }),
  block(11, "heading", "Phụ lục B — Biên bản họp", { level: 1 }),
  block(12, "unsupported", "[SmartArt]", { heading_path: ["Phụ lục B — Biên bản họp"] }),
];

export const createMode1MockState = (): Mode1MockState => ({
  project: {
    _id: MODE1_PROJECT_ID,
    name: "Lumen SRS (mode 1 mock)",
    domain: "E-learning",
    status: "active",
    mode: "import",
    import_state: null,
    createdAt: now(),
    updatedAt: now(),
  },
  created: [],
  spineVersion: 1,
  credits: 100,
  redFlags: 1,
  importDoc: null,
  profile: null,
  sections: [],
  reviewFields: [],
  baselines: [],
  versions: [],
  blocks: new Map(),
  reuploads: [],
  crs: new Map(),
  crSeq: 0,
});

export let mode1State: Mode1MockState = createMode1MockState();

export const resetMode1MockState = (): Mode1MockState => {
  mode1State = createMode1MockState();
  return mode1State;
};
