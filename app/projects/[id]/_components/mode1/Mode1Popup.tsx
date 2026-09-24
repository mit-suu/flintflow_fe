"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/ui/Modal";
import ChangeRequestList from "./ChangeRequestList";
import CrWorkspace from "./CrWorkspace";
import GapReportView from "./GapReportView";
import { crListHref, readCrPrefill } from "./prefill";

interface Mode1PopupProps {
  projectId: string;
  projectName?: string;
  /** CR ghi xong / gap report đổi trạng thái ⇒ màn tài liệu đọc lại (version, cờ, nội dung). */
  onChanged?: () => void;
}

/**
 * Mode 1: gap report và change request là popup trên màn "Tài liệu & version" — mở theo query `panel=gap` /
 * `panel=cr` (+ `cr=<id>` ⇒ chi tiết ngay trong popup, `new=1&…` ⇒ form tạo CR điền sẵn). Đóng ⇒ bỏ query.
 */
export default function Mode1Popup({ projectId, projectName, onChanged }: Mode1PopupProps) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const panel = params?.get("panel");
  if (panel !== "gap" && panel !== "cr") return null;

  const crId = panel === "cr" ? params?.get("cr") : null;
  const close = () => router.replace(pathname ?? `/projects/${projectId}`, { scroll: false });
  const title = panel === "gap" ? "Gap report" : crId ? `Change request ${crId}` : "Change request";

  return (
    <Modal open onClose={close} title={title} size="xl">
      {panel === "gap" && <GapReportView projectId={projectId} projectName={projectName} onChanged={onChanged} />}
      {panel === "cr" && crId && (
        <div className="flex flex-col gap-3">
          <Link href={crListHref(projectId)} scroll={false} className="self-start text-[12px] font-bold text-[#6A62C4] hover:underline">
            ← Danh sách change request
          </Link>
          <CrWorkspace key={crId} projectId={projectId} crId={crId} onChanged={onChanged} />
        </div>
      )}
      {panel === "cr" && !crId && (
        <ChangeRequestList key={params?.toString() ?? ""} projectId={projectId} prefill={readCrPrefill(new URLSearchParams(params?.toString() ?? ""))} />
      )}
    </Modal>
  );
}
