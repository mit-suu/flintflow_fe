import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { Cr } from "@/types/change-request";
import ClarifyPanel from "./ClarifyPanel";

const round = (n: number, answered: boolean) => ({ round: n, questions: [`Câu ${n}?`], answers: answered ? [`Đáp ${n}`] : [], suggestions: [[]] });

const cr = (rounds: number, pendingSuggestions: string[]) =>
  ({
    cr_id: "CR-001",
    clarifications: [...Array.from({ length: rounds - 1 }, (_, i) => round(i + 1, true)), { ...round(rounds, false), suggestions: [pendingSuggestions] }],
  }) as unknown as Cr;

describe("ClarifyPanel", () => {
  it("vòng trong giới hạn ⇒ in vòng x/3", () => {
    renderWithIntl(<ClarifyPanel cr={cr(2, [])} pendingQuestions={["Câu 2?"]} onAnswer={vi.fn()} />);
    expect(screen.getByText(/vòng 2\/3/)).toBeInTheDocument();
  });

  it("FLF-367: câu hỏi mâu thuẫn sau vòng 3 ⇒ không in 'vòng 4/3'; hai phía + lựa chọn hiện như gợi ý", () => {
    const question = 'CR yêu cầu khoá sau 3 lần, nhưng mục Chính sách bảo mật ghi "khoá sau 5 lần". Áp dụng con số nào?';
    renderWithIntl(
      <ClarifyPanel cr={cr(4, ["Đổi theo CR và sửa cả chỗ cũ", "Giữ như cũ, không áp dụng phần này của CR"])} pendingQuestions={[question]} onAnswer={vi.fn()} />,
    );
    expect(screen.queryByText(/4\/3/)).not.toBeInTheDocument();
    expect(screen.getByText(/khác với nội dung đang có trong tài liệu/)).toBeInTheDocument();
    expect(screen.getByText(question)).toBeInTheDocument();
    expect(screen.getByText("Đổi theo CR và sửa cả chỗ cũ")).toBeInTheDocument();
    expect(screen.getByText("Giữ như cũ, không áp dụng phần này của CR")).toBeInTheDocument();
  });
});
