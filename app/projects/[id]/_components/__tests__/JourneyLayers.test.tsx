import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import JourneyBar, { phaseStates, remainingGates } from "../JourneyBar";
import StepIntroCard, { formatEstimate, readableInputs } from "../StepIntroCard";
import DecisionsPanel, { topicLabel } from "../DecisionsPanel";
import { stepDividers } from "../ChatPane";
import { writeBadgeOf } from "../ChatBubble";
import type { StepSummary } from "@/types/pipeline";
import type { Decision, Spine } from "@/types/spine";

const step = (over: Partial<StepSummary> & Pick<StepSummary, "id" | "phase">): StepSummary => ({
  label_vi: "Bước",
  label_en: "Step",
  kind: "soft",
  status: "pending",
  deterministic: false,
  calls_used: 0,
  calls_limit: 8,
  regenerate_used: 0,
  regenerate_limit: 3,
  accepted_at: null,
  running: false,
  ...over,
});

describe("JourneyBar — Lớp 1 bản đồ hành trình", () => {
  const steps: StepSummary[] = [
    step({ id: "B-0.1", phase: "B-0", status: "accepted" }),
    step({ id: "S-4.1", phase: "S-4" }),
    step({ id: "S-4.2", phase: "S-4" }),
    step({ id: "S-5.1@S03", phase: "S-5" }),
    step({ id: "S-5.5@S03", phase: "S-5" }),
    step({ id: "S-5.1@S04", phase: "S-5" }),
  ];

  it("đếm điểm duyệt còn lại theo chế độ, không đếm 91 bước", () => {
    // Chặt: mỗi bước chưa chốt là một lần bấm
    expect(remainingGates(steps, "strict")).toBe(5);
    // Cân bằng: mỗi đơn vị giai đoạn một cổng (S-4, S-5@S03, S-5@S04) + S-4.1 luôn cần người
    expect(remainingGates(steps, "balanced")).toBe(4);
  });

  it("đánh dấu giai đoạn đã xong / đang làm, và vị trí màn trong vòng S-5", () => {
    const states = phaseStates(steps, "S-5.1@S04");
    expect(states.find((s) => s.phase === "B-0")).toMatchObject({ done: true, current: false });
    expect(states.find((s) => s.phase === "S-5")).toMatchObject({ current: true, loop: { index: 2, total: 2 } });
  });

  it("hiện % tài liệu và số điểm duyệt còn lại; bấm vào giai đoạn thì nhảy tới bước đầu của nó", () => {
    const onSelectPhase = vi.fn();
    renderWithIntl(<JourneyBar steps={steps} currentStepId="S-4.1" readinessPercent={46} credits={118} onSelectPhase={onSelectPhase} />);
    expect(screen.getByText("Tài liệu: 46%")).toBeInTheDocument();
    expect(screen.getByText("118 credit")).toBeInTheDocument();
    expect(screen.getByText(/còn khoảng \d+ điểm duyệt/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onSelectPhase).toHaveBeenCalled();
  });
});

describe("StepIntroCard — Lớp 2 bước này sẽ…", () => {
  it("đổi selector `reads` thành tên người đọc được", () => {
    expect(readableInputs(["screens", "functions[screen_id=@loop]:id,name", "documents"])).toEqual([
      "màn hình",
      "chức năng",
      "tài liệu bạn tải lên",
    ]);
  });

  it("ước lượng chỉ nói về lần chạy thật, làm tròn thô", () => {
    expect(formatEstimate({ duration_ms: 58_000, credits: 4 })).toBe("Lần trước mất khoảng 60 giây · 4 credit");
    expect(formatEstimate({ duration_ms: 185_000, credits: 12 })).toBe("Lần trước mất khoảng 3 phút · 12 credit");
  });

  it("có nút chạy cả giai đoạn khi chế độ duyệt cho phép", () => {
    const onRun = vi.fn();
    const onRunPhase = vi.fn();
    renderWithIntl(<StepIntroCard step={step({ id: "S-4.3", phase: "S-4" })} onRun={onRun} onRunPhase={onRunPhase} />);
    fireEvent.click(screen.getByRole("button", { name: "Chạy bước này" }));
    fireEvent.click(screen.getByRole("button", { name: "Chạy cả giai đoạn" }));
    expect(onRun).toHaveBeenCalled();
    expect(onRunPhase).toHaveBeenCalled();
  });
});

describe("DecisionsPanel — tab Đã chốt (R4)", () => {
  const decision = (over: Partial<Decision> = {}): Decision => ({
    id: "DC01",
    topic_key: "uptime",
    question: "Uptime?",
    answer: "99%",
    step_id: "S-1.4",
    at: "2026-09-22T10:00:00.000Z",
    superseded_by: null,
    ...over,
  });
  const spineWith = (decisions: Decision[]): Spine => ({ decisions } as unknown as Spine);

  it("chỉ hiện quyết định còn hiệu lực, sửa được tại chỗ", () => {
    const onSubmitOps = vi.fn();
    renderWithIntl(
      <DecisionsPanel spine={spineWith([decision(), decision({ id: "DC02", topic_key: "deposit_amount", superseded_by: "DC03" })])} onSubmitOps={onSubmitOps} />
    );
    expect(screen.getByText("Uptime")).toBeInTheDocument();
    expect(screen.queryByText("Tiền cọc")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Sửa quyết định Uptime"), { target: { value: "99.9%" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(onSubmitOps).toHaveBeenCalledWith([expect.objectContaining({ path: "decisions[id=DC01].answer", value: "99.9%" })]);
  });

  it("chưa chốt gì thì nói thẳng, không hiện bảng rỗng", () => {
    renderWithIntl(<DecisionsPanel spine={spineWith([])} onSubmitOps={vi.fn()} />);
    expect(screen.getByText("Chưa có quyết định nào được chốt.")).toBeInTheDocument();
    expect(topicLabel("slot_hold_minutes")).toBe("Giữ chỗ (phút)");
  });
});

describe("Chat — phân đoạn theo bước và nhãn ghi (BUG-24, BUG-09)", () => {
  it("chèn dấu phân đoạn mỗi khi đổi bước", () => {
    const messages = [
      { role: "user" as const, content: "a", step: "S-5.4@S04", createdAt: "" },
      { role: "ai" as const, content: "b", step: "S-5.4@S04", createdAt: "" },
      { role: "user" as const, content: "c", step: "S-5.3@S05", createdAt: "" },
    ];
    expect(stepDividers(messages)).toEqual([1, null, 1]);
  });

  it("tin nhắn AI thường là “Chỉ trao đổi”; bản xem trước nói rõ chờ xác nhận", () => {
    expect(writeBadgeOf({ role: "user", content: "x", createdAt: "" })).toBeNull();
    expect(writeBadgeOf({ role: "ai", content: "Tôi sẽ bổ sung UC18", createdAt: "" })).toMatchObject({ text: "Chỉ trao đổi", wrote: false });
    const preview = JSON.stringify({ kind: "change_preview", changes: [{}, {}] });
    expect(writeBadgeOf({ role: "ai", content: preview, createdAt: "" })).toMatchObject({ text: "Chờ bạn xác nhận (2 thay đổi)" });
  });
});
