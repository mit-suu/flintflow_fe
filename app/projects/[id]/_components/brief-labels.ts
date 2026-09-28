/**
 * Nhãn và phép đọc dữ liệu Brief dùng chung cho `BriefSummaryCard` (Hồ sơ dự án) và `BriefPanel` (khung phải ở pha
 * B-0…B-2). Một bộ nhãn duy nhất — hai nơi hiển thị không được gọi cùng một giá trị bằng hai tên khác nhau.
 */
import type { Addendum, Assumption, AssumptionStatus } from "@/types/spine";

/** Nhãn tiếng Việt cho section đích của addendum — khớp mục của tài liệu, không phải khoá thô. */
export const SECTION_LABEL: Record<string, string> = {
  "fixed:1": "Tổng quan sản phẩm",
  "fixed:2.1": "Actor",
  "fixed:3.1.2": "Mô tả màn",
  "fixed:4.2.2": "Độ tin cậy",
  "fixed:4.2.3": "Hiệu năng",
  "fixed:5.4": "Yêu cầu khác (để dành)",
};

export const FORM_FACTOR_LABEL: Record<string, string> = {
  web_app: "Web",
  mobile_app: "Mobile",
  desktop_app: "Desktop",
  api_service: "API",
  cli: "CLI",
  embedded: "Nhúng",
};

export const STAKES_LABEL: Record<string, string> = {
  internal: "Nội bộ",
  production: "Chạy thật",
  regulated: "Có quản lý ngành",
};

export const OTHER_KIND_LABEL: Record<string, string> = {
  risk: "Rủi ro",
  assumption: "Giả định",
  open_question: "Câu hỏi mở",
  technical_risk: "Rủi ro kỹ thuật",
};

export const ASSUMPTION_STATUS_LABEL: Record<AssumptionStatus, string> = {
  unconfirmed: "Chưa xác nhận",
  confirmed: "Đã xác nhận",
  rejected: "Đã bỏ",
};

export const formFactorLabel = (value: string | null | undefined): string | null =>
  value ? (FORM_FACTOR_LABEL[value] ?? value) : null;

export const stakesLabel = (value: string | null | undefined): string | null => (value ? (STAKES_LABEL[value] ?? value) : null);

/** Câu giả định bằng ngôn ngữ user (FLF-221); dữ liệu cũ chưa có `statement_vi` ⇒ bản EN. */
export const assumptionText = (assumption: Pick<Assumption, "statement" | "statement_vi">): string =>
  assumption.statement_vi?.trim() || assumption.statement;

/** Nhóm addendum theo `target_section` — đúng cách chúng sẽ đi vào tài liệu. */
export const groupByTarget = (addendum: Addendum[]): [string, Addendum[]][] => {
  const groups = new Map<string, Addendum[]>();
  for (const entry of addendum) {
    const list = groups.get(entry.target_section);
    if (list) list.push(entry);
    else groups.set(entry.target_section, [entry]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
};
