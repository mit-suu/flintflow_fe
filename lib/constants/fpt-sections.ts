/**
 * Danh mục section template FPT để chọn khi xác nhận mapping heading (mode 1, UC-21) — bản sao chỉ đọc của
 * `FIXED_SECTIONS` (`flintflow_be/src/modules/spine/section-registry.ts`, hợp đồng đóng băng) và heading nhóm
 * của `import/section-catalog.ts`. Section feature/function có id tạm `feature:@B…` do BE sinh — lấy từ profile.
 */

export interface FptSectionOption {
  id: string;
  number: string;
  title: string;
  required: boolean;
  /** Heading nhóm (`group:2`…) không có nội dung riêng, không trích. */
  group: boolean;
}

const fixed = (number: string, title: string, required = true): FptSectionOption => ({
  id: `fixed:${number}`,
  number,
  title,
  required,
  group: false,
});

const group = (number: string, title: string): FptSectionOption => ({
  id: `group:${number}`,
  number,
  title,
  required: false,
  group: true,
});

/** Theo thứ tự tài liệu. */
export const FPT_SECTIONS: readonly FptSectionOption[] = [
  fixed("I", "Record of Changes", false),
  fixed("1", "Product Overview"),
  group("2", "User Requirements"),
  fixed("2.1", "Actors"),
  group("2.2", "Use Cases"),
  fixed("2.2.1", "Use Case Diagram"),
  fixed("2.2.2", "Use Case Descriptions"),
  group("3", "Functional Requirements"),
  group("3.1", "System Functional Overview"),
  fixed("3.1.1", "Screens Flow"),
  fixed("3.1.2", "Screen Descriptions"),
  fixed("3.1.3", "Screen Authorization"),
  fixed("3.1.4", "Non-Screen Functions"),
  fixed("3.1.5", "Entity Relationship Diagram"),
  group("4", "Non-Functional Requirements"),
  fixed("4.1", "External Interfaces"),
  group("4.2", "Quality Attributes"),
  fixed("4.2.1", "Usability"),
  fixed("4.2.2", "Reliability"),
  fixed("4.2.3", "Performance"),
  fixed("4.2.4", "Domain-Specific Attributes", false),
  group("5", "Requirement Appendix"),
  fixed("5.1", "Business Rules"),
  fixed("5.2", "Common Requirements"),
  fixed("5.3", "Application Messages List"),
  fixed("5.4", "Other Requirements"),
  fixed("5.5", "Glossary"),
];

const PROVISIONAL = /^(feature|function):@(B\d{4,})$/;

const KIND = /^(feature|function|custom|group):(.+)$/;

/**
 * Nhãn hiển thị của một section id — không bao giờ trả mã thô cho người dùng: `2.1 Actors`, `Tính năng (tạm)`,
 * `Tính năng F2`, `Chức năng FN01`, `Mục riêng`, `Không khớp`. Section tạm cần phân biệt thì ghép tiêu đề heading ở nơi gọi.
 */
export const sectionLabel = (id: string | null): string => {
  if (!id || id === "unmapped") return "Không khớp (giữ nguyên, không trích)";
  const known = FPT_SECTIONS.find((s) => s.id === id);
  if (known) return `${known.number} ${known.title}`;
  const provisional = PROVISIONAL.exec(id);
  if (provisional) return `${provisional[1] === "feature" ? "Tính năng" : "Chức năng"} (tạm)`;
  const kind = KIND.exec(id);
  if (kind) {
    if (kind[1] === "custom") return "Mục riêng";
    if (kind[1] === "group") return `Mục ${kind[2]}`;
    return `${kind[1] === "feature" ? "Tính năng" : "Chức năng"} ${kind[2]}`;
  }
  if (id.startsWith("fixed:")) return `Mục ${id.slice("fixed:".length)}`;
  return id;
};
