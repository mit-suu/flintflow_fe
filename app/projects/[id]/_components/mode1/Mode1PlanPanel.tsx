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
  getBaseVersion: () => number | null;
  /** Sau khi ký (hoặc 409 lệch version): tải lại Spine/tiến độ/cờ. */
  onSignedOff: () => void;
}

const SIGN_OFF_STEP = "S-9.5";

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
  getBaseVersion,
  onSignedOff,
}: Mode1PlanPanelProps) {
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<Flag[]>([]);

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
                  className="text-[11px] font-bold text-[#4F46E5] hover:underline shrink-0 cursor-pointer"
                >
                  Mở step
                </button>
              </li>
            ))}
          </ul>
        )}
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
                    on ? "bg-white border-[#ECEAE5] text-[#6B6862]" : "bg-[#F4F3FE] border-[#DDD9F6] text-[#4F46E5]"
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
