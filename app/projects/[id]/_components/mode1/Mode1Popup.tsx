"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useDocVersions } from "../../hooks/mode1/useDocVersions";
import ChangeRequestList from "./ChangeRequestList";
import CrWorkspace from "./CrWorkspace";
import GapReportView from "./GapReportView";
import VersionCompare from "./VersionCompare";
import { crListHref, readCrPrefill } from "./prefill";

interface Mode1PopupProps {
  projectId: string;
  projectName?: string;
  /** CR ghi xong / gap report đổi trạng thái ⇒ màn tài liệu đọc lại (version, cờ, nội dung). */
  onChanged?: () => void;
  /** Viewer: xem gap report / CR nhưng không tạo hay thao tác CR. */
  readOnly?: boolean;
}

/**
 * Danh sách version chỉ cần khi popup so sánh đang mở, nên hook nằm ở component con — `Mode1Popup`
 * thoát sớm khi không có panel, gọi hook sau cái `return null` đó là sai thứ tự hook.
 *
 * Chờ `loading` xong mới dựng `VersionCompare`: nó chọn sẵn hai version trong `useState`, mà initializer
 * chỉ đọc ở lần render đầu — mount lúc danh sách còn rỗng thì hai ô chọn mắc ở chuỗi rỗng vĩnh viễn.
 * Popup không cần đếm cờ đỏ (chỉ panel Release cần) nên tắt để khỏi gọi thừa `GET /flags`.
 */
function CompareBody({ projectId }: { projectId: string }) {
  const docs = useDocVersions(projectId, { redFlags: false });
  if (docs.loading) return <p className="text-body text-on-surface-muted">Đang tải danh sách version…</p>;
  return (
    <div className="flex flex-col gap-3">
      {docs.error && (
        <p role="alert" className="text-body text-error">
          {docs.error}
        </p>
      )}
      <VersionCompare projectId={projectId} versions={docs.versions} />
    </div>
  );
}

/**
 * Mode 1: gap report, change request và so sánh version là popup trên màn "Tài liệu & version" — mở theo query
 * `panel=gap` / `panel=cr` (+ `cr=<id>` ⇒ chi tiết ngay trong popup, `new=1&…` ⇒ form tạo CR điền sẵn) /
 * `panel=compare`. Đóng ⇒ bỏ query.
 */
export default function Mode1Popup({ projectId, projectName, onChanged, readOnly = false }: Mode1PopupProps) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const panel = params?.get("panel");
  if (panel !== "gap" && panel !== "cr" && panel !== "compare") return null;

  const crId = panel === "cr" ? params?.get("cr") : null;
  const close = () => router.replace(pathname ?? `/projects/${projectId}`, { scroll: false });
  const title =
    panel === "gap" ? "Gap report" : panel === "compare" ? "So sánh version" : crId ? `Change request ${crId}` : "Change request";

  return (
    <Modal open onClose={close} title={title} size="xl">
      {panel === "gap" && <GapReportView projectId={projectId} projectName={projectName} onChanged={onChanged} readOnly={readOnly} />}
      {/* So sánh chỉ đọc nên viewer cũng xem được — không gác theo `readOnly` */}
      {panel === "compare" && <CompareBody projectId={projectId} />}
      {panel === "cr" && crId && (
        <div className="flex flex-col gap-3">
          <Link href={crListHref(projectId)} scroll={false} className="self-start text-body font-bold text-primary hover:underline">
            ← Danh sách change request
          </Link>
          <CrWorkspace key={crId} projectId={projectId} crId={crId} onChanged={onChanged} readOnly={readOnly} />
        </div>
      )}
      {panel === "cr" && !crId && (
        <ChangeRequestList
          key={params?.toString() ?? ""}
          projectId={projectId}
          prefill={readOnly ? null : readCrPrefill(new URLSearchParams(params?.toString() ?? ""))}
          readOnly={readOnly}
        />
      )}
    </Modal>
  );
}
