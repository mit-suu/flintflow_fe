"use client";

import Link from "next/link";
import { crPrefillHref } from "./prefill";

interface CrPrefillCardProps {
  projectId: string;
  prefill: { title: string; description: string };
  onDismiss: () => void;
}

/**
 * G9 / BR-03: tài liệu mode 1 đã có baseline nên lệnh sửa trong chat bị BE chặn (`409 CHANGE_REQUIRES_CR`).
 * Thay vì báo lỗi, mời người dùng tạo change request với nội dung điền sẵn từ lệnh vừa gõ.
 */
export default function CrPrefillCard({ projectId, prefill, onDismiss }: CrPrefillCardProps) {
  return (
    <div role="status" className="bg-[#F4F3FE] border border-[#DDD9F6] rounded-[14px] p-3.5 flex flex-col gap-2 text-[12.5px] text-[#3B34B0]">
      <p className="font-bold text-[#191817]">Muốn sửa tài liệu? Hãy tạo change request</p>
      <p>
        Tài liệu đã có baseline — mọi thay đổi phải qua change request để được tìm vị trí ảnh hưởng, kiểm và duyệt trước khi ghi
        Track Changes. Chat ở đây chỉ để hỏi đáp.
      </p>
      <blockquote className="border-l-2 border-[#DDD9F6] pl-2 text-[#4B4842] italic">{prefill.description}</blockquote>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onDismiss} className="px-3 py-1.5 rounded-[8px] border border-[#DDD9F6] bg-white font-semibold text-[#4B4842]">
          Bỏ qua
        </button>
        <Link href={crPrefillHref(projectId, { ...prefill, source: "verbal" })} className="px-3 py-1.5 rounded-[8px] bg-[#4F46E5] text-white font-bold">
          Tạo change request
        </Link>
      </div>
    </div>
  );
}
