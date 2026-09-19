"use client";

import type { StepEvent } from "@/types/pipeline";

interface StepEventLogProps {
  events: StepEvent[];
}

/** Một dòng mô tả cho mỗi sự kiện SSE của step. */
export const describeEvent = (event: StepEvent): string => {
  switch (event.type) {
    case "intake":
      return event.empty_fields.length > 0 ? `Tiếp nhận: còn thiếu ${event.empty_fields.join(", ")}` : "Tiếp nhận: đủ dữ liệu đầu vào";
    case "elicit":
      return "AI đang hỏi làm rõ";
    case "answer_needed":
      return `Chờ bạn trả lời ${event.questions.length} câu hỏi`;
    case "draft":
      return `Đang soạn (lượt ${event.attempt})`;
    case "ops_applied":
      return `Đã ghi ${event.changes.length} thay đổi (phiên bản ${event.spine_version})`;
    case "render":
      return event.render_status === "ok" ? `Đã vẽ hình ${event.diagram_id}` : `Vẽ hình ${event.diagram_id} lỗi: ${event.error ?? ""}`;
    case "flags":
      return `Kiểm tra: ${event.red_open} cờ đỏ, ${event.yellow_open} cờ vàng`;
    case "gate_ready":
      return "Sẵn sàng duyệt";
    case "error":
      return `Lỗi ${event.code}: ${event.message}`;
  }
};

export default function StepEventLog({ events }: StepEventLogProps) {
  const visible = events.filter((e) => e.type !== "elicit");
  if (visible.length === 0) return null;
  return (
    <ol className="flex flex-col gap-1 bg-white border border-[#ECEAE5] rounded-[12px] p-3" aria-label="Nhật ký bước">
      {visible.map((event, index) => (
        <li key={index} className={`text-[11.5px] flex items-center gap-2 ${event.type === "error" ? "text-[#B03030]" : "text-[#4B4842]"}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
          {describeEvent(event)}
        </li>
      ))}
    </ol>
  );
}
