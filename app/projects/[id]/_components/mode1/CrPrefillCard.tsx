"use client";

import Link from "next/link";
import { NEW_CR_SOURCE_KINDS, type ChangeRequiresCrMeta } from "@/types/change-request";
import { crPrefillHref } from "./prefill";

interface CrPrefillCardProps {
  projectId: string;
  prefill: ChangeRequiresCrMeta["prefill"];
  onDismiss: () => void;
}

type SourceKind = (typeof NEW_CR_SOURCE_KINDS)[number];

/**
 * G9 / BR-03, mode 1 v3 (BPMN 3.1): tài liệu mode 1 đã import nên lệnh sửa trong chat bị BE chặn (`409 CHANGE_REQUIRES_CR`)
 * — BE **không** tự tạo CR. Mời người dùng mở form 3.1 điền sẵn từ lệnh vừa gõ (nguồn gợi ý: yêu cầu miệng, `ref` trỏ về
 * chat); nguồn và người yêu cầu do BA xác nhận.
 */
export default function CrPrefillCard({ projectId, prefill, onDismiss }: CrPrefillCardProps) {
  const kind = prefill.source?.kind;
  const source: SourceKind = kind && (NEW_CR_SOURCE_KINDS as readonly string[]).includes(kind) ? (kind as SourceKind) : "verbal";
  return (
    <div role="status" className="bg-[#F2F1FB] border border-[#DCD8F0] rounded-[14px] p-3.5 flex flex-col gap-2 text-[12.5px] text-[#554DB0]">
      <p className="font-bold text-[#191817]">Muốn sửa tài liệu? Hãy tạo change request</p>
      <p>
        Tài liệu đã import — mọi thay đổi phải qua change request để được làm rõ, tìm vị trí ảnh hưởng, kiểm và duyệt trước khi
        ghi.
      </p>
      <blockquote className="border-l-2 border-[#DCD8F0] pl-2 text-[#4B4842] italic">{prefill.description}</blockquote>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onDismiss} className="px-3 py-1.5 rounded-[8px] border border-[#DCD8F0] bg-white font-semibold text-[#4B4842]">
          Bỏ qua
        </button>
        <Link
          href={crPrefillHref(projectId, { title: prefill.title, description: prefill.description, source, ref: prefill.source?.ref ?? undefined })}
          className="px-3 py-1.5 rounded-[8px] bg-[#6A62C4] text-white font-bold"
        >
          Tạo change request
        </Link>
      </div>
    </div>
  );
}
