"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addCrMaterialFile,
  addCrMaterialText,
  amendCr,
  answerClarifications,
  createCr,
  deleteCrMaterial,
  draftInOwnerStep,
  getCr,
  listCrs,
  patchLocation,
  runCrAction,
  type CrAction,
} from "@/lib/api/change-requests";
import { CR_AMENDABLE_STATUSES, CR_OPEN_STATUSES, CR_REDRAFT_STATUSES, type CrDetail, type CrLocation, type NEW_CR_SOURCE_KINDS } from "@/types/change-request";
import { errorText } from "../../_components/mode1/errors";

/** Nguồn + người yêu cầu chọn ở thẻ 3.1 trong chat. */
export interface CrChatSource {
  kind: (typeof NEW_CR_SOURCE_KINDS)[number];
  requester: string;
  ref?: string | null;
}

/** Việc đang chạy — để luồng chat nói "AI đang …". */
export type CrChatBusy = "create" | CrAction | "amend" | "answers" | "material" | "reject" | "redraft" | "manual";

/** Đề xuất đã đổi (AI làm lại / soạn lại) ⇒ khoá khác ⇒ người dùng phải đồng ý lại. */
export const proposalKey = (l: CrLocation): string =>
  `${l.location_id}|${l.conclusion ?? ""}|${l.proposal?.new_text ?? ""}|${l.proposal?.comment_text ?? ""}|${JSON.stringify(l.proposal?.spine_ops ?? [])}`;

/** Cùng luật `needsProposal` BE: chưa kết luận, hoặc kiểm trượt mà không phải sửa tay. */
const needsProposal = (l: CrLocation): boolean => !l.manual && (l.conclusion === null || (l.verify !== null && !l.verify.code_ok));

/** Vị trí trượt kiểm (3.7) mà người dùng chưa soạn lại / bỏ — soạn lại hoặc bỏ đều xoá kết quả kiểm cũ. */
export const isFailing = (l: CrLocation): boolean => l.verify !== null && !l.verify.code_ok;

const storageKey = (projectId: string, crId: string, what: "accepted" | "impact") => `ff-cr-chat:${projectId}:${crId}:${what}`;
const readStore = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key: string, value: string | null): void => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* chế độ riêng tư / chặn lưu — chỉ mất tiện ích nhớ, luồng vẫn chạy */
  }
};

const EMPTY: ReadonlySet<string> = new Set();

/** Tiêu đề CR từ lệnh sửa đầu tiên: dòng đầu, ≤ 120 ký tự. */
export const titleFromInstruction = (instruction: string): string => {
  const line = instruction.trim().split(/\r?\n/)[0] ?? "";
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
};

/**
 * Mode 1 v3 phase 8 — change request chạy trong khung chat. Lệnh sửa đầu tiên mở CR (sau khi chọn nguồn + người yêu
 * cầu, BPMN 3.1); lệnh sau gộp vào CR đang mở (`/amend`). Bước AI không cần người (làm rõ, tìm vị trí, đề xuất, kiểm)
 * tự chạy tiếp; dừng ở câu hỏi, danh sách phần liên quan, đề xuất chưa được đồng ý, lỗi / hết credit, và "Gửi cho Lead".
 * Mọi trạng thái lấy từ `CrDetail` BE trả — hook chỉ nhớ thêm (localStorage) đề xuất nào người dùng đã đồng ý.
 */
export function useCrChat(projectId: string, enabled = true) {
  const [detail, setDetail] = useState<CrDetail | null>(null);
  const [loading, setLoading] = useState(enabled);
  /** Lệnh sửa đầu tiên đang chờ chọn nguồn + người yêu cầu. */
  const [pending, setPending] = useState<string | null>(null);
  /** CR vừa gửi cho Lead — hiện thẻ xác nhận cho tới lệnh sửa kế tiếp. */
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState<CrChatBusy | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Vị trí đang chờ người dùng gõ hướng "Sửa lại". */
  const [redraftFor, setRedraftFor] = useState<string | null>(null);
  /** Đề xuất người dùng đã đồng ý, theo CR (khởi tạo từ localStorage khi mở CR). */
  const [acceptedByCr, setAcceptedByCr] = useState<Readonly<Record<string, ReadonlySet<string>>>>({});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const crId = detail?.change_request.cr_id ?? null;

  // Đồng ý của CR đang mở: đã chọn trong phiên này, không thì đọc lại từ localStorage
  const accepted = useMemo<ReadonlySet<string>>(() => {
    if (!crId) return EMPTY;
    if (acceptedByCr[crId]) return acceptedByCr[crId];
    try {
      const raw = readStore(storageKey(projectId, crId, "accepted"));
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return EMPTY;
    }
  }, [acceptedByCr, crId, projectId]);

  const saveAccepted = useCallback(
    (id: string, next: ReadonlySet<string>) => {
      setAcceptedByCr((prev) => ({ ...prev, [id]: next }));
      writeStore(storageKey(projectId, id, "accepted"), JSON.stringify([...next]));
    },
    [projectId]
  );

  // CR đang mở = CR chưa nộp mới nhất (danh sách BE trả mới nhất trước)
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listCrs(projectId)
      .then(async (res) => {
        const open = (res.data ?? []).find((c) => CR_OPEN_STATUSES.includes(c.status));
        if (!open) return;
        const full = await getCr(projectId, open.cr_id);
        if (!cancelled && alive.current && full.data) setDetail(full.data);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && alive.current && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, enabled]);

  const isAccepted = useCallback((l: CrLocation) => accepted.has(proposalKey(l)), [accepted]);

  /** Mọi vị trí đã có kết luận và mọi đề xuất sửa / comment đã được người dùng đồng ý. */
  const allDecided = useCallback(
    (d: CrDetail, set: ReadonlySet<string> = accepted) =>
      d.locations.length > 0 && d.locations.every((l) => l.conclusion !== null && (l.conclusion === "not_related" || set.has(proposalKey(l)))),
    [accepted]
  );

  const needImpact = useCallback(
    (d: CrDetail) =>
      d.change_request.status === "impact_review" &&
      (d.locations.length === 0 || readStore(storageKey(projectId, d.change_request.cr_id, "impact")) !== String(d.change_request.amendments.length)),
    [projectId]
  );

  /** Bước AI kế tiếp chạy được mà không cần người — `null` nếu đang chờ người dùng. */
  const nextAuto = useCallback(
    (d: CrDetail, set: ReadonlySet<string> = accepted): CrAction | null => {
      const c = d.change_request;
      if (c.paused) return null;
      if (c.status === "draft" || c.status === "clarifying") return "clarify";
      if (needImpact(d)) return "impact";
      if (c.status === "proposing" && d.locations.some(needsProposal)) return "propose";
      if ((c.status === "proposing" || c.status === "verifying") && allDecided(d, set)) return "verify";
      // 3.9: người dùng đã soạn lại / bỏ hết phần trượt và đồng ý mọi đề xuất ⇒ kiểm lại luôn
      if (c.status === "manual_fix" && allDecided(d, set) && !d.locations.some(isFailing)) return "verify";
      return null;
    },
    [accepted, allDecided, needImpact]
  );

  /** Chạy một lời gọi; lỗi ⇒ báo tiếng Việt và đọc lại CR (trạng thái có thể đã khác). */
  const call = useCallback(
    async (kind: CrChatBusy, fn: () => Promise<{ data: CrDetail | null }>): Promise<CrDetail | null> => {
      setBusy(kind);
      setError(null);
      try {
        const res = await fn();
        if (alive.current && res.data) setDetail(res.data);
        return res.data;
      } catch (err) {
        if (!alive.current) return null;
        setError(errorText(err));
        if (crId) void getCr(projectId, crId).then((r) => alive.current && r.data && setDetail(r.data)).catch(() => undefined);
        return null;
      } finally {
        if (alive.current) setBusy(null);
      }
    },
    [projectId, crId]
  );

  /**
   * Tự chạy các bước AI không cần người, dừng ở chỗ cần người dùng (tối đa 8 lượt). Cùng một bước hai lần liền (vd AI
   * đề xuất xong vẫn bỏ sót vị trí) ⇒ dừng để người dùng quyết, không gọi AI lặp tốn credit.
   */
  const advance = useCallback(
    async (start: CrDetail | null, set: ReadonlySet<string> = accepted, previous: CrAction | null = null) => {
      let cur = start;
      let last = previous;
      for (let i = 0; cur && i < 8; i++) {
        const action = nextAuto(cur, set);
        if (!action || action === last) return;
        last = action;
        const id = cur.change_request.cr_id;
        const amendments = cur.change_request.amendments.length;
        cur = await call(action, () => runCrAction(projectId, id, action));
        if (action === "impact" && cur) writeStore(storageKey(projectId, id, "impact"), String(amendments));
      }
    },
    [accepted, call, nextAuto, projectId]
  );

  /** 3.1 trong chat: người dùng chọn nguồn + người yêu cầu cho lệnh sửa đầu tiên ⇒ tạo CR ⇒ chạy tiếp. */
  const startCr = useCallback(
    async (source: CrChatSource) => {
      if (!pending) return;
      const instruction = pending;
      const created = await call("create", () =>
        createCr(projectId, {
          title: titleFromInstruction(instruction),
          description: instruction.slice(0, 5000),
          source: { kind: source.kind, ref: source.ref?.trim() || null, note: "Tạo từ khung chat" },
          requester: source.requester.trim(),
        })
      );
      if (!created) return;
      setPending(null);
      setSent(null);
      await advance(created, new Set());
    },
    [advance, call, pending, projectId]
  );

  /** Ô chat (chip "Sửa tài liệu" bật): định tuyến theo bước đang ở. */
  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value) return;
      if (!detail) {
        setSent(null);
        setPending(value);
        return;
      }
      const c = detail.change_request;
      if (redraftFor) {
        const locId = redraftFor;
        const d = await call("redraft", () => draftInOwnerStep(projectId, c.cr_id, locId, { instruction: value }));
        if (d) {
          setRedraftFor(null);
          await advance(d);
        }
        return;
      }
      if (c.status === "awaiting_answers") {
        if (detail.pending_questions.length === 1) {
          const d = await call("answers", () => answerClarifications(projectId, c.cr_id, [value]));
          await advance(d);
        } else {
          setError("AI đang hỏi nhiều câu — trả lời ở thẻ câu hỏi phía trên (chọn gợi ý hoặc gõ từng câu).");
        }
        return;
      }
      if (c.paused) return setError("Bước AI đang tạm dừng — bấm “Tiếp tục” ở phía trên trước.");
      if (!CR_AMENDABLE_STATUSES.includes(c.status)) return setError("AI đang chạy — đợi xong bước này rồi gõ tiếp.");
      const d = await call("amend", () => amendCr(projectId, c.cr_id, value));
      await advance(d);
    },
    [advance, call, detail, projectId, redraftFor]
  );

  const withCr = <T,>(fn: (id: string, d: CrDetail) => T): T | undefined => (detail ? fn(detail.change_request.cr_id, detail) : undefined);

  return {
    loading,
    detail,
    pending,
    sent,
    busy,
    error,
    redraftFor,
    /** Placeholder ô chat theo bước đang ở. */
    inputHint: !detail
      ? "Gõ yêu cầu sửa tài liệu, vd: Thêm yêu cầu hiệu năng cho màn tra cứu"
      : redraftFor
        ? "Gõ hướng sửa lại cho đề xuất đang chọn…"
        : detail.change_request.status === "awaiting_answers"
          ? "Trả lời câu hỏi của AI…"
          : `Gõ thêm lệnh sửa để gộp vào ${detail.change_request.cr_id}…`,
    clearError: () => setError(null),
    cancelPending: () => setPending(null),
    isAccepted,
    /** Có bước AI chạy tiếp được (vd mở lại trang giữa chừng) ⇒ nút "Tiếp tục". */
    canContinue: detail ? nextAuto(detail) !== null : false,
    send,
    startCr,
    continueFlow: () => void advance(detail),
    /** Phần AI chưa kết luận / trượt kiểm — để luồng chat nói rõ chỗ nào cần xử lý. */
    unconcluded: detail ? detail.locations.filter((l) => l.conclusion === null) : [],
    failing: detail ? detail.locations.filter(isFailing) : [],
    resume: () =>
      void withCr(async (id) => {
        const d = await call("resume", () => runCrAction(projectId, id, "resume"));
        await advance(d);
      }),
    answer: (answers: string[]) =>
      void withCr(async (id) => {
        const d = await call("answers", () => answerClarifications(projectId, id, answers));
        await advance(d);
      }),
    addMaterialText: (name: string, text: string) => withCr((id) => call("material", () => addCrMaterialText(projectId, id, { name, text })).then((d) => d !== null)),
    addMaterialFile: (file: File) => withCr((id) => call("material", () => addCrMaterialFile(projectId, id, file))),
    removeMaterial: (materialId: string) => withCr((id) => call("material", () => deleteCrMaterial(projectId, id, materialId))),
    /** "Tiếp tục" sau danh sách phần liên quan ⇒ AI đề xuất (3.6). */
    proposeNow: () =>
      void withCr(async (id) => {
        const d = await call("propose", () => runCrAction(projectId, id, "propose"));
        await advance(d, accepted, "propose");
      }),
    /** Kiểm lại ngay (3.7) — nút "Kiểm lại" ở bước kiểm tra. */
    verifyNow: () =>
      void withCr(async (id) => {
        const d = await call("verify", () => runCrAction(projectId, id, "verify"));
        await advance(d, accepted, "verify");
      }),
    /**
     * Tự sửa một vị trí (3.9): giá trị mới của cả phần tử ⇒ PATCH `new_value`. Người dùng tự viết nên tính luôn là đã đồng ý;
     * hết phần trượt thì tự kiểm lại.
     */
    manualEdit: (locId: string, value: unknown) =>
      withCr(async (id) => {
        const d = await call("manual", () =>
          patchLocation(projectId, id, locId, { conclusion: "edit", new_value: value, reason: "Người yêu cầu tự sửa trong khung chat" })
        );
        if (!d) return false;
        const loc = d.locations.find((l) => l.location_id === locId);
        const next = new Set(accepted);
        if (loc) next.add(proposalKey(loc));
        saveAccepted(id, next);
        setRedraftFor(null);
        await advance(d, next);
        return true;
      }),
    /** Soạn lại một vị trí theo hướng người dùng gõ ngay ở thẻ đề xuất (3.9). */
    redraft: (locId: string, instruction: string) =>
      withCr(async (id) => {
        const d = await call("redraft", () => draftInOwnerStep(projectId, id, locId, { instruction }));
        if (!d) return false;
        setRedraftFor(null);
        await advance(d);
        return true;
      }),
    accept: (loc: CrLocation) =>
      void withCr(async (id, d) => {
        const next = new Set(accepted);
        next.add(proposalKey(loc));
        saveAccepted(id, next);
        await advance(d, next);
      }),
    reject: (loc: CrLocation) =>
      void withCr(async (id) => {
        const d = await call("reject", () =>
          patchLocation(projectId, id, loc.location_id, { conclusion: "not_related", reason: "Người yêu cầu bỏ đề xuất này trong khung chat" })
        );
        await advance(d);
      }),
    canRedraft: detail ? CR_REDRAFT_STATUSES.includes(detail.change_request.status) && !detail.change_request.paused : false,
    startRedraft: (locId: string) => setRedraftFor(locId),
    cancelRedraft: () => setRedraftFor(null),
    /** 3.11: gửi cho Lead duyệt ⇒ CR `in_review`; lệnh sửa tiếp theo mở CR mới. */
    submit: () =>
      void withCr(async (id) => {
        const d = await call("submit", () => runCrAction(projectId, id, "submit"));
        if (d && d.change_request.status === "in_review") {
          writeStore(storageKey(projectId, id, "accepted"), null);
          writeStore(storageKey(projectId, id, "impact"), null);
          setSent(id);
          setDetail(null);
          setRedraftFor(null);
        }
      }),
  };
}

export type CrChat = ReturnType<typeof useCrChat>;
