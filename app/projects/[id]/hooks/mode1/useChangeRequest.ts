"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import {
  addCrMaterialFile,
  addCrMaterialText,
  answerClarifications,
  cancelCr,
  deleteCrMaterial,
  closeCr,
  decideGroup,
  draftInOwnerStep,
  getCr,
  patchLocation,
  runCrAction,
  type CrAction,
} from "@/lib/api/change-requests";
import { getSpine } from "@/lib/api/spine";
import type { CrDetail, PatchLocationRequest } from "@/types/change-request";
import { errorText } from "../../_components/mode1/errors";

export type CrBusy = CrAction | "answers" | "material" | "patch" | "owner_draft" | "decide" | "close" | "cancel";

/**
 * Một change request (UC-48–UC-53, UC-81, UC-82). Mọi hành động trả `CrDetail` mới nhất từ BE — FE không tự
 * chuyển trạng thái. Bước AI chạy đồng bộ; lỗi AI / hết credit trả về dưới dạng `paused` trong CR.
 */
export function useChangeRequest(projectId: string, crId: string) {
  const [detail, setDetail] = useState<CrDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<CrBusy | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(
    () =>
      getCr(projectId, crId)
        .then((res) => alive.current && setDetail(res.data))
        .catch((err: unknown) => alive.current && setError(errorText(err, "Không tải được change request")))
        .finally(() => alive.current && setLoading(false)),
    [projectId, crId]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async (kind: CrBusy, fn: () => Promise<{ data: CrDetail | null }>): Promise<boolean> => {
      setBusy(kind);
      setError(null);
      try {
        const res = await fn();
        if (alive.current && res.data) setDetail(res.data);
        return true;
      } catch (err) {
        if (!alive.current) return false;
        setError(errorText(err));
        // Trạng thái trên máy chủ có thể đã khác (phiên khác, CR khác vừa khoá block) ⇒ đọc lại
        if (err instanceof ApiClientError && (err.status === 409 || err.status === 402)) void reload();
        return false;
      } finally {
        if (alive.current) setBusy(null);
      }
    },
    [reload]
  );

  return {
    detail,
    loading,
    error,
    busy,
    reload,
    clearError: () => setError(null),
    action: (action: CrAction) => run(action, () => runCrAction(projectId, crId, action)),
    answer: (answers: string[]) => run("answers", () => answerClarifications(projectId, crId, answers)),
    /** Phase 7: tài liệu bổ sung — dán chữ / upload file (ảnh tốn 1 credit); chỉ trước 3.4. */
    addMaterialText: (name: string, text: string) => run("material", () => addCrMaterialText(projectId, crId, { name, text })),
    addMaterialFile: (file: File) => run("material", () => addCrMaterialFile(projectId, crId, file)),
    removeMaterial: (materialId: string) => run("material", () => deleteCrMaterial(projectId, crId, materialId)),
    patch: (locationId: string, body: PatchLocationRequest) => run("patch", () => patchLocation(projectId, crId, locationId, body)),
    /** BPMN 3.9: sửa đề xuất trong step sở hữu (AI, tốn credit) — chỉ ghi đề xuất, kiểm lại bằng `verify`. */
    ownerDraft: (locationId: string, instruction: string) =>
      run("owner_draft", () => draftInOwnerStep(projectId, crId, locationId, { instruction })),
    /** Quyết định group ghi Spine khi là group cuối ⇒ mang `base_version` đọc ngay trước khi gửi. */
    /** BPMN 3.12 (mode 1 v3): lý do bắt buộc cả khi duyệt. */
    decide: (groupId: string, decision: "approved" | "rejected", reason: string) =>
      run("decide", async () => {
        const spine = await getSpine(projectId);
        return decideGroup(projectId, crId, groupId, { decision, reason, base_version: spine.data?.spine_version ?? 0 });
      }),
    close: (reason: string) => run("close", () => closeCr(projectId, crId, reason)),
    cancel: (reason: string) => run("cancel", () => cancelCr(projectId, crId, reason)),
  };
}
