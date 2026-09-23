import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
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
