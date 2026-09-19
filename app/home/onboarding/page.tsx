"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { createProject } from "@/lib/api/projects";
import { applyChanges, getSpine } from "@/lib/api/spine";
import WorkingModeSelect from "../../projects/[id]/_components/WorkingModeSelect";
import type { Op } from "@/types/pipeline";
import type { WorkingMode } from "@/types/spine";
import { patchMe } from "./api";

type Step = 1 | 2 | 3;

/** Onboarding (UC 1.12): tên/mục tiêu → working mode mặc định → tạo dự án đầu tiên. */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [workingMode, setWorkingMode] = useState<WorkingMode>("fast");
  const [projectName, setProjectName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dự án đã tạo ở lần bấm trước (nếu bước ghi Spine hoặc patchMe sau đó lỗi) — bấm lại chỉ retry
  // phần còn thiếu, không tạo dự án trùng lặp.
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const goToStep2 = () => {
    setProjectName((prev) => prev || goal.trim());
    setStep(2);
  };

  const finish = async () => {
    if (!projectName.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      let projectId = createdProjectId;
      if (!projectId) {
        const projectRes = await createProject(projectName.trim());
        const project = projectRes.data;
        if (!project) throw new Error("Không tạo được dự án");
        projectId = project._id;
        setCreatedProjectId(projectId);
      }

      // working_mode + mục tiêu ban đầu (project.vision): đọc `spine_version` thật thay vì
      // hard-code `base_version: 1` (Spine tạo lười ở BE — GET đầu tiên mới getOrCreate, version có
      // thể khác 1). Lỗi ở bước này chặn tiếp tục, không nuốt lặng lẽ như trước.
      const spineRes = await getSpine(projectId);
      const spineVersion = spineRes.data?.spine_version;
      if (spineVersion === undefined) throw new Error("Không đọc được Spine của dự án vừa tạo");
      const ops: Op[] = [{ op: "set", path: "project.working_mode", value: workingMode, reason: "Onboarding" }];
      if (goal.trim()) {
        ops.push({ op: "set", path: "project.vision", value: goal.trim(), reason: "Onboarding — mục tiêu ban đầu" });
      }
      await applyChanges(projectId, { base_version: spineVersion, ops });

      if (name.trim()) await patchMe({ name: name.trim() }).catch(() => undefined);

      // Đánh dấu đã onboard SAU khi dự án + Spine đã ghi xong; lỗi ở đây (khác thao tác trên) phải
      // chặn `router.push` — nếu không, `app/home/page.tsx` sẽ đẩy user quay lại đây ở lần ghé sau
      // dù đã có project, dẫn tới nguy cơ tạo dự án lặp nếu không giữ `createdProjectId`.
      await patchMe({ onboardedAt: new Date().toISOString() });

      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không hoàn tất được thiết lập ban đầu — bấm lại để thử tiếp");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-[520px] bg-white border border-[#ECEAE5] rounded-[24px] p-8 flex flex-col items-center gap-6 custom-shadow-card">
        <Logo sizeClassName="w-8 h-8" theme="light" />

        <div className="flex items-center gap-1.5">
          {([1, 2, 3] as Step[]).map((s) => (
            <span
              key={s}
              className={`w-2 h-2 rounded-full ${s <= step ? "bg-[#4F46E5]" : "bg-[#E4E1DC]"}`}
              aria-label={`Bước ${s}${s === step ? " (hiện tại)" : ""}`}
            />
          ))}
        </div>

        {error && (
          <div className="w-full bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-3.5 py-2.5 rounded-[10px] text-[12px]">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="w-full flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-[18px] font-extrabold text-[#191817]">Chào mừng đến với FlintFlow</h2>
              <p className="text-[12.5px] text-[#8A867E] mt-1">Vài bước để chuẩn bị không gian làm việc của bạn.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-[#4B4842]">Tên của bạn</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Hiệp"
                className="w-full px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] outline-none text-[13.5px] bg-[#FAF9F7]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-[#4B4842]">Mục tiêu chính của bạn lúc này là gì?</label>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Ví dụ: Viết SRS cho app đặt xe cho đồ án tốt nghiệp"
                className="w-full px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] outline-none text-[13.5px] bg-[#FAF9F7]"
              />
            </div>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={goToStep2}
              className="w-full py-3 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Tiếp tục →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="w-full flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-[18px] font-extrabold text-[#191817]">Chọn cách làm việc mặc định</h2>
              <p className="text-[12.5px] text-[#8A867E] mt-1">Có thể đổi lại bất cứ lúc nào trong dự án.</p>
            </div>
            <div className="flex justify-center">
              <WorkingModeSelect value={workingMode} onChange={setWorkingMode} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-[10px] border-[1.5px] border-[#E4E1DC] text-[13px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold cursor-pointer"
              >
                Tiếp tục →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="w-full flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-[18px] font-extrabold text-[#191817]">Tạo dự án đầu tiên</h2>
              <p className="text-[12.5px] text-[#8A867E] mt-1">Bạn có thể đổi tên dự án sau.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-bold text-[#4B4842]">Tên dự án</label>
              <input
                autoFocus
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ví dụ: App Đặt Xe Online"
                className="w-full px-3.5 py-2.5 rounded-[10px] border-[1.5px] border-[#E4E1DC] focus:border-[#4F46E5] outline-none text-[13.5px] bg-[#FAF9F7]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-[10px] border-[1.5px] border-[#E4E1DC] text-[13px] font-semibold text-[#4B4842] hover:bg-[#FAF9F7] disabled:opacity-50 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                disabled={submitting || !projectName.trim()}
                onClick={() => void finish()}
                className="flex-1 py-2.5 rounded-[10px] btn-gradient-primary text-white text-[13.5px] font-bold disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Đang tạo dự án…" : "Tạo dự án →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
