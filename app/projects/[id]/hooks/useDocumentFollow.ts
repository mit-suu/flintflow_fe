"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getProjectVersion } from "@/lib/api/pipeline";

/** Nhịp hỏi `GET /version` khi tab đang hiện. */
export const VERSION_TICK_MS = 20_000;
/** Hai lần tự áp bản mới cách nhau tối thiểu chừng này — revision đổi dồn dập (pipeline chạy nền) thì gộp vào lần sau. */
export const MIN_APPLY_GAP_MS = 10_000;

export interface UseDocumentFollowOptions {
  projectId: string;
  /** Tắt hẳn (workspace chưa sẵn sàng, đang xem bản khác bản nháp…). */
  enabled: boolean;
  /** `meta.document_revision` của tài liệu đang hiển thị; `null` (BE cũ / chưa tải) ⇒ lấy kết quả `/version` đầu tiên làm mốc. */
  shownRevision: string | null;
  /** `spine_version` tab đang giữ — `/version` báo lớn hơn mà revision tài liệu không đổi ⇒ chỉ đồng bộ Spine. */
  knownSpineVersion: number | null;
  /** User đang thao tác dở (xem trước sửa, chọn chỗ góp ý, ô chat có chữ + chip Sửa tài liệu): không thay nội dung dưới tay. */
  busy: boolean;
  /** Tab này đang mở luồng SSE chạy step / chat: không hỏi, không áp. */
  streaming: boolean;
  /** Tài liệu đang tải lại — chờ xong rồi mới so (revision hiển thị sắp đổi). */
  documentReloading: boolean;
  /** Revision tài liệu đổi: đường `onSpineChanged` sẵn có (tải Spine + tiến độ + tài liệu cùng nhau). */
  onApply: () => void;
  /** Chỉ `spine_version` đổi (tính lại cờ / waive…): đọc lại Spine + cờ, KHÔNG tải lại tài liệu. */
  onSpineOnly: () => void;
}

export interface UseDocumentFollowResult {
  /** Đã biết có bản tài liệu mới hơn bản đang hiển thị mà chưa áp. */
  hasNewer: boolean;
  /** Đã biết Spine hoặc tài liệu ở BE mới hơn bản tab này giữ — cổng trước khi gửi sửa dựa vào đây. */
  behind: boolean;
  /** Áp ngay (nút "Cập nhật" trên dải báo), bỏ qua khoảng tối thiểu. */
  apply: () => void;
}

interface Observation {
  revision: string;
  spineVersion: number;
  /** Revision đang hiển thị lúc hỏi — tài liệu đã đổi sau đó thì quan sát này cũ, chờ nhịp hỏi sau mới kết luận. */
  basis: string | null;
}

/**
 * Tài liệu tự bám bản mới nhất khi thay đổi đến từ nơi khác (tab khác, thành viên khác, việc nền ở BE).
 * Hỏi `GET /version` — nhẹ, không dựng tài liệu — mỗi `VERSION_TICK_MS` khi tab hiện và ngay khi tab hiện lại; tab ẩn,
 * đang có luồng SSE ở tab này ⇒ không hỏi. Một lượt hỏi tại một thời điểm; lỗi mạng im lặng, chờ nhịp sau.
 * Không bao giờ dùng số của `/version` làm `base_version`: chỉ Spine thật đọc về mới nâng được nó.
 */
export function useDocumentFollow({
  projectId,
  enabled,
  shownRevision,
  knownSpineVersion,
  busy,
  streaming,
  documentReloading,
  onApply,
  onSpineOnly,
}: UseDocumentFollowOptions): UseDocumentFollowResult {
  const [observed, setObserved] = useState<Observation | null>(null);
  const [fallbackBaseline, setFallbackBaseline] = useState<string | null>(null);
  const shownRef = useRef(shownRevision);
  const lastApplyAt = useRef(0);
  const onApplyRef = useRef(onApply);
  const onSpineOnlyRef = useRef(onSpineOnly);
  useEffect(() => {
    shownRef.current = shownRevision;
    onApplyRef.current = onApply;
    onSpineOnlyRef.current = onSpineOnly;
  }, [shownRevision, onApply, onSpineOnly]);

  const active = enabled && Boolean(projectId) && !streaming;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let inFlight = false;
    const poll = () => {
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      const basis = shownRef.current;
      void getProjectVersion(projectId)
        .then(
          (res) => {
            const data = res.data;
            if (cancelled || !data) return;
            setFallbackBaseline((current) => current ?? data.document_revision);
            setObserved((current) =>
              current &&
              current.revision === data.document_revision &&
              current.spineVersion === data.spine_version &&
              current.basis === basis
                ? current
                : { revision: data.document_revision, spineVersion: data.spine_version, basis }
            );
          },
          () => undefined
        )
        .finally(() => {
          inFlight = false;
        });
    };
    poll();
    const timer = setInterval(poll, VERSION_TICK_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [active, projectId]);

  const baseline = shownRevision ?? fallbackBaseline;
  const fresh = observed !== null && observed.basis === shownRevision;
  const hasNewer = fresh && baseline !== null && observed.revision !== baseline;
  const spineBehind = fresh && knownSpineVersion !== null && observed.spineVersion > knownSpineVersion;
  const observedRevision = observed?.revision ?? null;

  // Bản mới + user rảnh ⇒ tự áp, cách lần trước ≥ MIN_APPLY_GAP_MS
  useEffect(() => {
    if (!enabled || !hasNewer || busy || streaming || documentReloading) return;
    const wait = Math.max(0, lastApplyAt.current + MIN_APPLY_GAP_MS - Date.now());
    const timer = setTimeout(() => {
      lastApplyAt.current = Date.now();
      onApplyRef.current();
    }, wait);
    return () => clearTimeout(timer);
  }, [enabled, hasNewer, busy, streaming, documentReloading, observedRevision]);

  // Chỉ Spine đổi (revision tài liệu giữ nguyên) ⇒ đồng bộ version + cờ, không động tới tài liệu
  const observedSpine = observed?.spineVersion ?? null;
  useEffect(() => {
    if (!enabled || hasNewer || !spineBehind || streaming) return;
    onSpineOnlyRef.current();
  }, [enabled, hasNewer, spineBehind, streaming, observedSpine]);

  const apply = useCallback(() => {
    lastApplyAt.current = Date.now();
    if (observed) setFallbackBaseline(observed.revision);
    onApplyRef.current();
  }, [observed]);

  return { hasNewer, behind: hasNewer || spineBehind, apply };
}
