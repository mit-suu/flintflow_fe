"use client";

import Link from "next/link";
import type { Flag } from "@/types/spine";
import { crPrefillHref } from "./prefill";

interface Mode1FlagsPanelProps {
  projectId: string;
  /** Cờ đang mở (BE tính). */
  flags: Flag[];
}

const shortText = (s: string, max = 70) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * Cờ của project mode 1 v3 (bám BPMN — Flow 1 ⇒ 3.1, Flow 6): import xong không chạy step, không ký baseline v1, không
 * waive — cờ đỏ chỉ đóng bằng change request, và chặn release (6.1). Mỗi cờ đỏ có nút mở **form 3.1** điền sẵn nguồn
 * gap report; CR đi đủ 3.2 → 3.14 (mục trống ⇒ C-3 dựng vị trí thêm mới).
 */
export default function Mode1FlagsPanel({ projectId, flags }: Mode1FlagsPanelProps) {
  const open = flags.filter((f) => !f.resolved_at && !f.waived_by_user);
  const red = open.filter((f) => f.level === "red");
  const yellow = open.filter((f) => f.level === "yellow");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-[#8A867E] leading-relaxed">
        Tài liệu đã import — mọi thay đổi đi qua change request (tạo từ gap report, panel “Sửa tài liệu có xem trước” hoặc lệnh
        sửa trong chat). Release được khi hết cờ đỏ.
      </p>

      <section className="flex flex-col gap-2" aria-label="Cờ đỏ đang chặn release">
        <h4 className="text-[12px] font-extrabold text-[#191817]">Cờ đỏ đang chặn release ({red.length})</h4>
        {red.length === 0 ? (
          <p className="text-[11.5px] text-[#1F7A45]">Không còn cờ đỏ nào.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {red.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-2.5 py-1.5">
                <span className="text-[11.5px] text-[#33312D]">{f.message}</span>
                <span className="flex items-center gap-2">
                  <code className="text-[10.5px] text-[#8A4141]">{f.rule_id}</code>
                  <Link
                    href={crPrefillHref(projectId, {
                      title: `Xử lý cờ: ${shortText(f.message)}`,
                      description: `${f.message}\n(Cờ ${f.rule_id}${f.section_id ? `, mục ${f.section_id}` : ""})`,
                      source: "gap_report",
                      ref: f.section_id ?? `flag:${f.id}`,
                    })}
                    className="ml-auto text-[11px] font-bold text-[#6A62C4] hover:underline shrink-0"
                  >
                    Tạo CR
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {yellow.length > 0 && (
        <p className="text-[11px] text-[#8A6D1F]">{yellow.length} cờ vàng — không chặn release, xem ở gap report hoặc panel Verification.</p>
      )}
    </div>
  );
}
