import { fireEvent, screen } from "@testing-library/react";
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

describe("ClarifyPanel - FLF-474", () => {
  it("nhãn vòng đọc clarify_round của BE, không tự đếm clarifications", () => {
    const base = cr(5, []);
    renderWithIntl(<ClarifyPanel cr={{ ...base, clarify_round: { n: 1, max: 3, extra: false } } as Cr} pendingQuestions={["Câu 5?"]} onAnswer={vi.fn()} />);
    expect(screen.getByText(/vòng 1\/3/)).toBeInTheDocument();
    expect(screen.queryByText(/vòng 5\/3/)).not.toBeInTheDocument();
  });

  it("clarify_round.extra ⇒ câu 'cần xác nhận thêm', không in x/3", () => {
    const base = cr(4, []);
    renderWithIntl(<ClarifyPanel cr={{ ...base, clarify_round: { n: 4, max: 3, extra: true } } as Cr} pendingQuestions={["Câu 4?"]} onAnswer={vi.fn()} />);
    expect(screen.getByText(/khác với nội dung đang có trong tài liệu/)).toBeInTheDocument();
    expect(screen.queryByText(/4\/3/)).not.toBeInTheDocument();
  });

  const withKinds = (kind: "contradiction" | "ambiguous") => {
    const base = cr(1, ["Giữ như cũ"]);
    const last = base.clarifications[0];
    return { ...base, clarifications: [{ ...last, kinds: [kind] }] } as Cr;
  };

  it("câu mâu thuẫn: nút gửi khoá khi chưa chọn, mở khi đã chọn", () => {
    const onAnswer = vi.fn();
    renderWithIntl(<ClarifyPanel cr={withKinds("contradiction")} pendingQuestions={["Áp dụng số nào?"]} onAnswer={onAnswer} />);
    const submit = screen.getByRole("button", { name: /gửi/i });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByText("Giữ như cũ"));
    expect(screen.getByRole("button", { name: /gửi/i })).toBeEnabled();
  });

  it("câu mơ hồ: vẫn gửi trống được (chưa biết)", () => {
    renderWithIntl(<ClarifyPanel cr={withKinds("ambiguous")} pendingQuestions={["Màn nào?"]} onAnswer={vi.fn()} />);
    expect(screen.getByRole("button", { name: /gửi/i })).toBeEnabled();
  });
});
