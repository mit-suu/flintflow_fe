/** Nhãn tiếng Việt cho trạng thái và mã của mode 1 — chỉ hiển thị, không suy diễn trạng thái ở FE. */
import type { CrSourceKind, CrStatus, LocationConclusion, LocationFoundBy } from "@/types/change-request";
import type { DocVersionKind } from "@/types/doc-version";
import type { DocBlockKind, ImportStatus } from "@/types/import";

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  uploaded: "Đã tải lên",
  preflight_rejected: "File bị từ chối",
  awaiting_latest_confirm: "Chờ xác nhận bản mới nhất",
  parsing: "Đang tách block",
  mapping_review: "Chờ xác nhận mapping",
  extracting: "Đang trích field",
  fields_review: "Chờ xác nhận field",
  baselining: "Sẵn sàng tạo baseline",
  checking: "Đang kiểm tra",
  gap_review: "Chờ xem gap report",
  delivered: "Đã giao gap report",
  change_requested: "Đang sửa qua change request",
};

/** Import đã có baseline v0 ⇒ tài liệu, gap report và change request dùng được. */
export const IMPORT_DONE_STATUSES: readonly ImportStatus[] = ["gap_review", "delivered", "change_requested"];

export const CR_STATUS_LABELS: Record<CrStatus, string> = {
  draft: "Nháp",
  clarifying: "AI đang làm rõ",
  awaiting_answers: "Chờ trả lời",
  impact_review: "Tìm vị trí ảnh hưởng",
  proposing: "Đề xuất sửa",
  verifying: "Đang kiểm",
  manual_fix: "Cần sửa tay",
  ready_to_submit: "Sẵn sàng nộp",
  in_review: "Chờ duyệt",
  written: "Đã ghi vào tài liệu",
  rejected: "Đã đóng (từ chối)",
  cancelled: "Đã huỷ",
};

export const CR_SOURCE_LABELS: Record<CrSourceKind, string> = {
  stakeholder_email: "Email của stakeholder",
  meeting_minutes: "Biên bản họp",
  gap_report: "Gap report",
  reupload: "File tải lại (khác biệt)",
  viewer_comment: "Góp ý của người xem",
  verbal: "Trao đổi miệng",
};

export const CR_SOURCE_KINDS = Object.keys(CR_SOURCE_LABELS) as CrSourceKind[];

export const FOUND_BY_LABELS: Record<LocationFoundBy, string> = {
  spine_link: "Liên kết field",
  mention: "Nhắc mã",
  keyword: "Từ khoá",
};

export const CONCLUSION_LABELS: Record<LocationConclusion, string> = {
  edit: "Sửa",
  comment: "Chỉ comment",
  not_related: "Không liên quan",
};

export const VERSION_KIND_LABELS: Record<DocVersionKind, string> = {
  imported: "Bản import",
  cr_revision: "Bản nháp sau CR",
  release: "Bản release",
};

export const BLOCK_KIND_LABELS: Record<DocBlockKind, string> = {
  heading: "Tiêu đề",
  paragraph: "Đoạn văn",
  list_item: "Mục danh sách",
  table: "Bảng",
  table_row: "Hàng bảng",
  table_cell: "Ô bảng",
  image: "Ảnh",
  caption: "Chú thích",
  unsupported: "Không hỗ trợ",
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
};

export const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;
