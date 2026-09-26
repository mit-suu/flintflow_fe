"use client";

import { useState } from "react";
import { stepLabel } from "@/lib/constants/step-registry";
import type { Op } from "@/types/pipeline";
import type { Spine } from "@/types/spine";

/**
 * Tab "Đã chốt" — sổ quyết định (`02-reduce-stops-plan.md` R4).
 *
 * Trong lượt test, user trả lời uptime ba lần và vẫn thấy AI gợi ý ngược lại điều mình vừa nói. Sổ này là
 * chỗ để họ **thấy** hệ thống nhớ gì, và sửa nếu nhớ sai — sửa ở đây là sửa nguồn, không phải sửa từng
 * chỗ hệ quả (việc lan toả do cờ `derived_from_changed_assumption` nhắc).
 */

interface DecisionsPanelProps {
  spine: Spine | null;
  onSubmitOps: (ops: Op[]) => void | Promise<void>;
  busy?: boolean;
}

/** Nhãn tiếng Việt cho các chủ đề chuẩn; chủ đề tự do hiện nguyên khoá. */
const TOPIC_LABELS: Record<string, string> = {
  system_name: "Tên hệ thống",
  uptime: "Uptime",
  concurrent_users: "Số người dùng đồng thời",
  response_time: "Thời gian phản hồi",
  data_retention: "Lưu dữ liệu bao lâu",
  slot_hold_minutes: "Giữ chỗ (phút)",
  deposit_amount: "Tiền cọc",
  cancel_window: "Hạn huỷ",
  no_show_policy: "Chính sách no-show",
  reminder_channel: "Kênh nhắc lịch",
  notification_channels: "Kênh thông báo",
  ui_languages: "Ngôn ngữ giao diện",
  roles: "Vai trò",
  working_hours: "Giờ làm việc",
  payment_method: "Cách thanh toán",
  screen_scope: "Phạm vi màn hình",
  release_scope: "Phạm vi bản phát hành",
};

export const topicLabel = (topicKey: string): string => TOPIC_LABELS[topicKey] ?? topicKey.replace(/_/g, " ");

export default function DecisionsPanel({ spine, onSubmitOps, busy = false }: DecisionsPanelProps) {
  const [editing, setEditing] = useState<{ id: string; answer: string } | null>(null);
  const decisions = (spine?.decisions ?? []).filter((d) => d.superseded_by === null);

  if (decisions.length === 0) {
    return <p className="text-[11.5px] text-on-surface-muted italic">Chưa có quyết định nào được chốt.</p>;
  }

  const save = () => {
    if (!editing || editing.answer.trim() === "") return;
    void onSubmitOps([
      { op: "set", path: `decisions[id=${editing.id}].answer`, value: editing.answer.trim(), reason: "Sửa quyết định đã chốt" },
    ]);
    setEditing(null);
  };

  return (
    <ul className="flex flex-col gap-2" aria-label="Quyết định đã chốt">
      {decisions.map((decision) => (
        <li key={decision.id} className="bg-white border border-[#ECEAE5] rounded-[10px] p-2.5 flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] font-bold text-[#191817]">{topicLabel(decision.topic_key)}</span>
            <span className="text-[10.5px] text-[#8A867E] shrink-0" title={decision.question}>
              {decision.step_id} · {stepLabel(decision.step_id)}
            </span>
          </div>
          {editing?.id === decision.id ? (
            <div className="flex gap-1.5">
              <input
                aria-label={`Sửa quyết định ${topicLabel(decision.topic_key)}`}
                value={editing.answer}
                onChange={(e) => setEditing({ id: decision.id, answer: e.target.value })}
                className="flex-1 px-2 py-1 border border-[#E5E3DF] rounded-[8px] text-[12px] outline-none"
              />
              <button
                type="button"
                disabled={busy || editing.answer.trim() === ""}
                onClick={save}
                className="px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-[#191817] text-white disabled:opacity-50 cursor-pointer"
              >
                Lưu
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#4B4842] min-w-0 break-words">{decision.answer}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing({ id: decision.id, answer: decision.answer })}
                className="text-[10.5px] font-bold text-[#6A62C4] hover:underline cursor-pointer shrink-0"
              >
                Sửa
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
