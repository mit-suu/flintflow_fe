"use client";

import { useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { createBaseline } from "@/lib/api/export";
import { stepLabel } from "@/lib/constants/step-registry";
import type { StepPlanEntry } from "@/types/import";
import type { StepSummary } from "@/types/pipeline";
import type { Flag } from "@/types/spine";
import { errorText } from "./errors";

interface Mode1PlanPanelProps {
  projectId: string;
  /** Kế hoạch step (`GET /step-plan`) — `null` khi đang tải. */
  plan: StepPlanEntry[] | null;
  planError?: string | null;
  /** Trạng thái step do BE trả (`GET /steps`). */
  steps: StepSummary[];
  /** Cờ đang mở (BE tính). */
  flags: Flag[];
  /** Đã ký baseline v1 (sign-off) — sau đó mọi sửa đi qua change request. */
  signedOff: boolean;
  busyStep: string | null;
  onToggleStep: (stepId: string, enabled: boolean) => void;
  onSelectStep: (stepId: string) => void;
  /** Cờ đỏ trỏ tới step ĐÃ CHỐT (file có đầu mục nhưng Spine trống) ⇒ mở lại bước rồi chạy (B7 reopen). */
  onReopenStep?: (stepId: string) => void;
  /** Waive ngay tại chỗ (L11d). Không truyền ⇒ chỉ nhắc mở panel Verification như cũ. */
  onWaiveFlag?: (flagId: string, reason: string) => Promise<void>;
  getBaseVersion: () => number | null;
  /** Sau khi ký (hoặc 409 lệch version): tải lại Spine/tiến độ/cờ. */
  onSignedOff: () => void;
}

const SIGN_OFF_STEP = "S-9.5";

/** Ba luật là vi phạm bất biến/lỗi kỹ thuật — BE từ chối waive, nên không hiện nút (khớp `NON_WAIVABLE_RULES`). */
const NON_WAIVABLE_RULES = new Set(["array_empty", "dead_reference", "render_error"]);
const WAIVE_REASON_MIN_LENGTH = 20;

/**
 * Kế hoạch step của project mode 1 v2 (FLF-185, plan v2 §7 — D2/D6):
 * - Đầu mục mẫu FPT file không có (hoặc chỉ có heading) và step chưa chốt ⇒ đỏ "Thiếu", bấm để mở step đó chạy.
 * - Step ẩn (Brief, S-1…) ⇒ nút Bật; step đã bật thêm chưa có dữ liệu ⇒ nút Tắt. Step của đầu mục FPT không tắt được.
 * - Ký baseline v1: khoá khi còn cờ đỏ mở; BE quét lại cờ và chặn lần nữa (`BASELINE_BLOCKED`).
 */
export default function Mode1PlanPanel({
  projectId,
  plan,
  planError,
  steps,
  flags,
  signedOff,
  busyStep,
  onToggleStep,
  onSelectStep,
  onReopenStep,
  onWaiveFlag,
  getBaseVersion,
  onSignedOff,
}: Mode1PlanPanelProps) {
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<Flag[]>([]);
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [waiveBusy, setWaiveBusy] = useState(false);
  const [waiveError, setWaiveError] = useState<string | null>(null);

  const submitWaive = async (flagId: string) => {
    if (!onWaiveFlag) return;
    setWaiveBusy(true);
    setWaiveError(null);
    try {
      await onWaiveFlag(flagId, waiveReason.trim());
      setWaivingId(null);
      setWaiveReason("");
    } catch (err) {
      setWaiveError(errorText(err, "Waive cờ thất bại"));
    } finally {
      setWaiveBusy(false);
    }
  };

  const statusOf = (id: string) => steps.find((s) => s.id === id)?.status;
  const missing = (plan ?? []).filter((p) => p.missing && p.state !== "hidden" && statusOf(p.step_id) !== "accepted");
  const hidden = (plan ?? []).filter((p) => p.state === "hidden");
  const enabled = (plan ?? []).filter((p) => p.state === "enabled");
  const redOpen = flags.filter((f) => f.level === "red" && !f.resolved_at && !f.waived_by_user);

  const signReason = signedOff
    ? "Đã ký baseline v1 — sửa tiếp qua change request."
    : redOpen.length > 0
      ? `Còn ${redOpen.length} cờ đỏ${missing.length ? `, trong đó ${missing.length} đầu mục FPT thiếu` : ""} — chạy step hoặc sửa qua chat trước khi ký.`
      : null;

  const signOff = async () => {
    const base = getBaseVersion();
    if (base === null) return;
    setSigning(true);
    setSignError(null);
    setBlocking([]);
    try {
      await createBaseline(projectId, base);
      onSignedOff();
    } catch (err) {
      setSignError(errorText(err, "Không ký được baseline v1"));
      if (err instanceof ApiClientError && err.code === "BASELINE_BLOCKED") setBlocking((err.meta?.flags as Flag[] | undefined) ?? []);
      if (err instanceof ApiClientError && err.code === "SPINE_VERSION_CONFLICT") onSignedOff();
    } finally {
      setSigning(false);
    }
  };

  if (planError) return <p role="alert" className="text-[12px] text-[#B03030]">{planError}</p>;
  if (!plan) return <p className="text-[12px] text-[#8A867E]">Đang tải kế hoạch step…</p>;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2" aria-label="Đầu mục FPT còn thiếu">
        <h4 className="text-[12px] font-extrabold text-[#191817]">Đầu mục FPT còn thiếu</h4>
        {missing.length === 0 ? (
          <p className="text-[11.5px] text-[#1F7A45]">Đủ mọi đầu mục mẫu FPT.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {missing.map((p) => (
              <li key={p.step_id} className="flex items-center gap-2 bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-2.5 py-1.5">
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#B03030] text-white shrink-0">Thiếu</span>
                <span className="text-[11.5px] text-[#4B4842] min-w-0 flex-1" title={p.reason}>
                  {p.step_id} · {stepLabel(p.step_id)}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectStep(p.step_id)}
                  className="text-[11px] font-bold text-[#6A62C4] hover:underline shrink-0 cursor-pointer"
                >
                  Mở step
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Trước đây cột này chỉ nói "còn N cờ đỏ" mà không cho xem là cờ nào — bảng cờ nằm ở panel Verification
          của mode 2, người dùng mode 1 không biết đường mở (gặp thật 2026-09-20). Liệt kê thẳng, kèm step để xử. */}
      <section className="flex flex-col gap-2" aria-label="Cờ đỏ đang chặn">
        <h4 className="text-[12px] font-extrabold text-[#191817]">Cờ đỏ đang chặn ký v1 ({redOpen.length})</h4>
        {redOpen.length === 0 ? (
          <p className="text-[11.5px] text-[#1F7A45]">Không còn cờ đỏ nào.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {redOpen.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-2.5 py-1.5">
                <span className="text-[11.5px] text-[#33312D]">{f.message}</span>
                <span className="flex items-center gap-2">
                  <code className="text-[10.5px] text-[#8A4141]">{f.rule_id}</code>
                  {f.remediation_step ? (
                    (() => {
                      const step = f.remediation_step as string;
                      // Step đã chốt mà mục vẫn trống (trích không ra dữ liệu) ⇒ bấm "Chạy" sẽ bị BE từ chối;
                      // phải mở lại bước (B7) thì mới chạy lại được.
                      const done = statusOf(step) === "accepted";
                      return (
                        <button
                          type="button"
                          onClick={() => (done && onReopenStep ? onReopenStep(step) : onSelectStep(step))}
                          title={done ? `${step} đã chốt nhưng mục vẫn trống — mở lại bước để AI soạn lại` : `Mở ${step}`}
                          className="ml-auto text-[11px] font-bold text-[#6A62C4] hover:underline shrink-0 cursor-pointer"
                        >
                          {done ? `Mở lại ${step}` : `Chạy ${step}`}
                        </button>
                      );
                    })()
                  ) : null}
                  {/* L11d: waive ngay tại đây. Trước đây chỉ có câu nhắc "mở panel Verification", mà cờ như
                      `unconfirmed_assumption` thì chạy lại step bao nhiêu lần cũng không đóng — người dùng
                      kẹt vòng mở-lại-bước cho tới khi cạn trần 8 lượt gọi model (gặp thật 2026-09-20). */}
                  {onWaiveFlag && !NON_WAIVABLE_RULES.has(f.rule_id) && waivingId !== f.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setWaiveError(null);
                        setWaiveReason("");
                        setWaivingId(f.id);
                      }}
                      title="Bỏ qua cờ này kèm lý do — bản ký sẽ là baseline có điều kiện"
                      className={`text-[11px] font-bold text-[#8A6D1F] hover:underline shrink-0 cursor-pointer ${f.remediation_step ? "" : "ml-auto"}`}
                    >
                      Waive
                    </button>
                  )}
                </span>
                {waivingId === f.id && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`waive-${f.id}`} className="text-[11px] font-semibold text-[#4B4842]">
                      Lý do bỏ qua (≥ {WAIVE_REASON_MIN_LENGTH} ký tự)
                    </label>
                    <textarea
                      id={`waive-${f.id}`}
                      rows={2}
                      value={waiveReason}
                      onChange={(e) => setWaiveReason(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-[#E5E3DF] focus:border-[#6A62C4] rounded-[8px] text-[11.5px] outline-none resize-none"
                    />
                    {waiveError && (
                      <p role="alert" className="text-[11px] text-[#B03030]">
                        {waiveError}
                      </p>
                    )}
                    <div className="flex gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={() => setWaivingId(null)}
                        disabled={waiveBusy}
                        className="px-2.5 py-1 rounded-[8px] border border-[#ECEAE5] bg-white text-[11px] font-semibold text-[#4B4842] cursor-pointer disabled:opacity-50"
                      >
                        Huỷ
                      </button>
                      <button
                        type="button"
                        onClick={() => void submitWaive(f.id)}
                        disabled={waiveBusy || waiveReason.trim().length < WAIVE_REASON_MIN_LENGTH}
                        className="px-2.5 py-1 rounded-[8px] bg-[#8A6D1F] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {waiveBusy ? "Đang waive…" : "Xác nhận waive"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-[#8A867E] leading-relaxed">
          Cờ vàng không chặn ký. Waive kèm lý do ⇒ bản ký là baseline <b>có điều kiện</b>, cờ được in vào phụ lục.
          Riêng <code>render_error</code>, <code>dead_reference</code>, <code>array_empty</code> không waive được — phải sửa thật.
        </p>
      </section>

      <section className="flex flex-col gap-2" aria-label="Step ẩn">
        <h4 className="text-[12px] font-extrabold text-[#191817]">Step ẩn</h4>
        <p className="text-[11px] text-[#8A867E] leading-relaxed">Không sinh đầu mục của tài liệu (Brief, phân tích ý tưởng). Bật nếu muốn AI phân tích lại.</p>
        {hidden.length === 0 && enabled.length === 0 && <p className="text-[11.5px] text-[#8A867E]">Không có step ẩn.</p>}
        <ul className="flex flex-col gap-1">
          {[...enabled, ...hidden].map((p) => {
            const on = p.state === "enabled";
            return (
              <li key={p.step_id} className="flex items-center gap-2 text-[11.5px]">
                <span className={`min-w-0 flex-1 ${on ? "text-[#191817]" : "text-[#8A867E]"}`} title={p.reason}>
                  {p.step_id} · {stepLabel(p.step_id)}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleStep(p.step_id, !on)}
                  disabled={busyStep !== null || signedOff}
                  className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    on ? "bg-white border-[#ECEAE5] text-[#6B6862]" : "bg-[#F2F1FB] border-[#DCD8F0] text-[#6A62C4]"
                  }`}
                >
                  {busyStep === p.step_id ? "…" : on ? "Tắt" : "Bật"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2" aria-label="Ký baseline v1">
        <h4 className="text-[12px] font-extrabold text-[#191817]">Ký baseline v1</h4>
        <p className="text-[11px] text-[#8A867E] leading-relaxed">
          Trước v1 sửa tự do như workspace (chạy step, sửa qua chat). Sau khi ký, mọi thay đổi đi qua change request.
        </p>
        <button
          type="button"
          onClick={() => void signOff()}
          disabled={signReason !== null || signing}
          title={signReason ?? `Ký baseline (${SIGN_OFF_STEP})`}
          className="px-4 py-2 rounded-[10px] btn-gradient-primary text-white text-[12.5px] font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {signing ? "Đang ký…" : "Ký baseline v1"}
        </button>
        {signReason && <p className="text-[11.5px] text-[#8A6D1F]">{signReason}</p>}
        {signError && (
          <div role="alert" className="text-[12px] text-[#B03030] bg-[#FDEDED] border border-[#F2CACA] rounded-[10px] px-3 py-2">
            {signError}
            {blocking.length > 0 && (
              <ul className="list-disc pl-4 mt-1">
                {blocking.map((f) => (
                  <li key={f.id}>{f.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
