"use client";

import Link from "next/link";
import { crPrefillHref } from "./prefill";

interface CrPrefillCardProps {
  projectId: string;
  prefill: { title: string; description: string; change_request?: { cr_id: string; status: string } };
  onDismiss: () => void;
}

/**
 * G9 / BR-03: tài liệu mode 1 đã có baseline nên lệnh sửa trong chat bị BE chặn (`409 CHANGE_REQUIRES_CR`).
 * Thay vì báo lỗi, mời người dùng tạo change request với nội dung điền sẵn từ lệnh vừa gõ.
 */
export default function CrPrefillCard({ projectId, prefill, onDismiss }: CrPrefillCardProps) {
  const created = prefill.change_request;
  if (created) {
    // FLF-186: sau baseline v1, lệnh sửa trong chat đã thành CR nguồn chat — mở CR để làm rõ, tìm vị trí, duyệt
    return (
      <div role="status" className="bg-[#F4F3FE] border border-[#DDD9F6] rounded-[14px] p-3.5 flex flex-col gap-2 text-[12.5px] text-[#3B34B0]">
        <p className="font-bold text-[#191817]">Đã tạo {created.cr_id} từ lệnh sửa</p>
        <p>Tài liệu đã ký baseline v1 — thay đổi đi qua change request: làm rõ, tìm vị trí ảnh hưởng, kiểm, duyệt rồi ghi ngay.</p>
        <blockquote className="border-l-2 border-[#DDD9F6] pl-2 text-[#4B4842] italic">{prefill.description}</blockquote>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onDismiss} className="px-3 py-1.5 rounded-[8px] border border-[#DDD9F6] bg-white font-semibold text-[#4B4842]">
            Đóng
          </button>
          <Link href={`/projects/${projectId}/change-requests/${created.cr_id}`} className="px-3 py-1.5 rounded-[8px] bg-[#4F46E5] text-white font-bold">
            Mở {created.cr_id}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className="bg-[#F4F3FE] border border-[#DDD9F6] rounded-[14px] p-3.5 flex flex-col gap-2 text-[12.5px] text-[#3B34B0]">
      <p className="font-bold text-[#191817]">Muốn sửa tài liệu? Hãy tạo change request</p>
      <p>
        Tài liệu đã có baseline — mọi thay đổi phải qua change request để được tìm vị trí ảnh hưởng, kiểm và duyệt trước khi
        ghi.
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
