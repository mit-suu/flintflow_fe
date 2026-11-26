"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchCrDiagramImage } from "@/lib/api/change-requests";
import type { CrLocation } from "@/types/change-request";
import type { OriginalDiagramKind } from "@/types/spine";
import type { CrChat } from "../../hooks/mode1/useCrChat";
import { diagramLocationTitle, replacedDiagrams } from "./OriginalDiagramChange";

const btn = "px-3 py-1 rounded-[8px] text-body font-bold disabled:opacity-50 cursor-pointer";

type ImageState = { status: "loading" } | { status: "ready"; urls: string[] } | { status: "error" };

/**
 * Ảnh của một vị trí sơ đồ gốc (#23a): `original` = ảnh gốc của file, `after` = sơ đồ FlintFlow vẽ từ dữ liệu sau CR (use case
 * tách theo feature ⇒ nhiều phần, lấy đủ). Object URL được thu hồi khi đổi / gỡ.
 */
function useDiagramImage(projectId: string, crId: string, locationId: string, kind: OriginalDiagramKind, owner: string | null, variant: "after" | "original", version: string): ImageState {
  const [state, setState] = useState<{ key: string; value: ImageState }>({ key: "", value: { status: "loading" } });
  const key = [projectId, crId, locationId, kind, owner, variant, version].join("|");
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const load = async () => {
      try {
        const first = await fetchCrDiagramImage(projectId, crId, locationId, { kind, owner, variant, part: 0 });
        urls.push(first.url);
        for (let part = 1; part < first.parts && !cancelled; part++) {
          urls.push((await fetchCrDiagramImage(projectId, crId, locationId, { kind, owner, variant, part })).url);
        }
        if (!cancelled) setState({ key, value: { status: "ready", urls: [...urls] } });
      } catch {
        if (!cancelled) setState({ key, value: { status: "error" } });
      }
    };
    void load();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [key, projectId, crId, locationId, kind, owner, variant]);
  return state.key === key ? state.value : { status: "loading" };
}

function DiagramImage({ label, state, alt }: { label: string; state: ImageState; alt: string }) {
  const t = useTranslations("mode1.originalDiagram.group");
  return (
    <figure className="flex flex-col gap-1 min-w-0">
      <figcaption className="text-caption font-bold text-on-surface-muted">{label}</figcaption>
      <div className="rounded-[8px] bg-white p-1.5 min-h-[120px] flex flex-col items-center justify-center gap-1.5">
        {state.status === "loading" && <span className="text-caption text-on-surface-muted">{t("loading")}</span>}
        {state.status === "error" && <span className="text-caption text-on-surface-muted text-center px-2">{t("imageFailed")}</span>}
        {state.status === "ready" &&
          state.urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- object URL của ảnh tải bằng token, next/image không tối ưu được
            <img key={url} src={url} alt={state.urls.length > 1 ? `${alt} (${i + 1}/${state.urls.length})` : alt} className="max-h-[260px] w-full object-contain" />
          ))}
      </div>
    </figure>
  );
}

/** Một hình gốc sẽ bị thay: ảnh gốc ↔ sơ đồ FlintFlow sau CR, cạnh nhau. */
function DiagramCompare({ projectId, crId, loc, kind, ownerId, caption }: { projectId: string; crId: string; loc: CrLocation; kind: OriginalDiagramKind; ownerId: string | null; caption: string }) {
  const t = useTranslations("mode1.originalDiagram");
  const tg = useTranslations("mode1.originalDiagram.group");
  // Đề xuất đổi (vd sau "Xét lại") ⇒ vẽ lại hình sau CR
  const version = loc.proposal?.new_text ?? "";
  const original = useDiagramImage(projectId, crId, loc.location_id, kind, ownerId, "original", "");
  const after = useDiagramImage(projectId, crId, loc.location_id, kind, ownerId, "after", version);
  const name = t(`kinds.${kind}`);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-body text-on-surface">
        {name}
        {caption ? <span className="text-on-surface-muted">{t("caption", { caption })}</span> : null}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <DiagramImage label={tg("before")} state={original} alt={tg("beforeAlt", { name })} />
        <DiagramImage label={tg("after")} state={after} alt={tg("afterAlt", { name })} />
      </div>
    </div>
  );
}

/**
 * Các hình gốc mà change request làm lệch, gộp một khối thay cho mỗi hình một thẻ chỉ có chữ: mỗi hình có ảnh gốc và sơ đồ
 * FlintFlow vẽ từ dữ liệu sau CR để so, nút Thay / Giữ từng chỗ và "Thay tất cả / Giữ tất cả". Giữ hình gốc ⇒ BE ghi nhận lúc
 * ghi CR, không bị hỏi lại tới khi dữ liệu đổi tiếp.
 */
export default function OriginalDiagramGroup({ projectId, locations, chat }: { projectId: string; locations: CrLocation[]; chat: CrChat }) {
  const t = useTranslations("mode1.originalDiagram.group");
  const tDiagram = useTranslations("mode1.originalDiagram");
  const crId = chat.detail?.change_request.cr_id;
  if (!crId || !locations.length) return null;
  const busy = chat.busy !== null;
  const pending = locations.filter((l) => !chat.isAccepted(l));
  return (
    <section aria-label={t("aria")} className="rounded-[12px] bg-[#F2F1FB] p-3 flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <p className="font-bold text-[#3F3894]">{t("title", { count: locations.length })}</p>
        <p className="text-caption text-[#6B6862]">{t("hint")}</p>
      </div>
      {locations.map((loc) => {
        const accepted = chat.isAccepted(loc);
        return (
          <article key={loc.location_id} id={`cr-loc-${loc.location_id}`} className="scroll-mt-4 flex flex-col gap-2" aria-label={diagramLocationTitle(loc, tDiagram)}>
            {replacedDiagrams(loc).map((d) => (
              <DiagramCompare key={`${d.kind}@${d.ownerId ?? ""}`} projectId={projectId} crId={crId} loc={loc} kind={d.kind} ownerId={d.ownerId} caption={d.caption} />
            ))}
            {accepted ? (
              <span className="self-start px-2 py-0.5 rounded-full bg-[#1F7A45] text-white text-caption font-bold">{t("replaced")}</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={busy} onClick={() => chat.accept(loc)} className={`${btn} bg-[#1F7A45] text-white`}>
                  {t("replace")}
                </button>
                <button type="button" disabled={busy} onClick={() => chat.reject(loc)} className={`${btn} bg-white text-on-surface`}>
                  {t("keep")}
                </button>
              </div>
            )}
          </article>
        );
      })}
      {pending.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={busy} onClick={() => chat.acceptMany(pending)} className={`${btn} bg-[#1F7A45] text-white`}>
            {t("replaceAll", { count: pending.length })}
          </button>
          <button type="button" disabled={busy} onClick={() => chat.rejectMany(pending)} className={`${btn} bg-white text-on-surface`}>
            {t("keepAll")}
          </button>
        </div>
      )}
    </section>
  );
}
