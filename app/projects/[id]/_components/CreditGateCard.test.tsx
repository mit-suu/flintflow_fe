import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import CreditGateCard from "./CreditGateCard";

const base = {
  title: "Soạn phần còn lại của SRS",
  lines: [
    { label: "Giai đoạn S-1 · 4 bước", credits: 17 },
    { label: "Giai đoạn S-2 · 5 bước", credits: 21 },
  ],
  total: 38,
};

describe("CreditGateCard (FLF-332 - cổng cứng xác nhận credit)", () => {
  it("hiện từng dòng, tổng ước tính và số khả dụng; Chạy / Huỷ gọi đúng callback", () => {
    const onRun = vi.fn();
    const onCancel = vi.fn();
    renderWithIntl(<CreditGateCard {...base} available={120} onRun={onRun} onCancel={onCancel} />);
    expect(screen.getByRole("dialog", { name: "Xác nhận credit trước khi chạy" })).toBeInTheDocument();
    expect(screen.getByText("Giai đoạn S-2 · 5 bước")).toBeInTheDocument();
    expect(screen.getByText("Tổng ước tính: ~38 credit")).toBeInTheDocument();
    expect(screen.getByText("Khả dụng: 120 credit")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("FLF-466: dải màn ước tính hiện ở dòng ghi chú", () => {
    renderWithIntl(<CreditGateCard {...base} available={120} note="Phần màn là ước tính" onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Phần màn là ước tính")).toBeInTheDocument();
  });

  it("số dư thấp hơn ước tính ⇒ cảnh báo kèm link nạp", () => {
    renderWithIntl(<CreditGateCard {...base} available={10} onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Số dư chưa đủ/);
    expect(screen.getByRole("link", { name: "Nạp thêm" })).toHaveAttribute("href", "/home/billing");
  });

  it("không biết số dư ⇒ không hiện dòng khả dụng, không cảnh báo", () => {
    renderWithIntl(<CreditGateCard {...base} available={null} onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByText(/Khả dụng/)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("FLF-449: có lưu ý (cảnh báo PDF khi đính kèm) ⇒ hiện trước nút Chạy; không có ⇒ không hiện", () => {
    const pdfNote = "PDF: bảng nhiều cột có thể bị đọc lộn thứ tự, PDF scan không đọc được chữ. Gặp hai trường hợp này, hãy gửi bản .docx.";
    const { unmount } = renderWithIntl(<CreditGateCard {...base} available={120} notes={[pdfNote]} onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("note")).toHaveTextContent(pdfNote);
    unmount();
    renderWithIntl(<CreditGateCard {...base} available={120} onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  describe("FLF-485: khoảng ước tính vòng màn hình", () => {
    const ranged = {
      title: "Soạn phần còn lại của SRS",
      lines: [
        { label: "Giai đoạn S-1 · 4 bước", credits: 17 },
        { label: "Chi tiết màn hình · khoảng 6–14 màn", credits: 78, creditsMax: 195 },
      ],
      total: 222,
      totalMax: 339,
    };

    it("có totalMax ⇒ hiện khoảng ở dòng và ở tổng", () => {
      renderWithIntl(<CreditGateCard {...ranged} available={500} onRun={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByText("~78–195 credit")).toBeInTheDocument();
      expect(screen.getByText("Tổng ước tính: ~222 – 339 credit")).toBeInTheDocument();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("số dư 276 nằm giữa 222 và 339 ⇒ cảnh báo vàng có thể thiếu, không báo đỏ, nút Chạy vẫn bấm được", () => {
      renderWithIntl(<CreditGateCard {...ranged} available={276} onRun={vi.fn()} onCancel={vi.fn()} />);
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(/có thể thiếu nếu nhiều màn/);
      expect(status).not.toHaveClass("text-error");
      expect(screen.getByRole("button", { name: "Chạy" })).toBeEnabled();
    });

    it("số dư 100 thấp hơn cận dưới ⇒ cảnh báo đỏ như cũ", () => {
      renderWithIntl(<CreditGateCard {...ranged} available={100} onRun={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.getByRole("status")).toHaveTextContent(/Số dư chưa đủ/);
      expect(screen.getByRole("status")).toHaveClass("text-error");
    });

    it("ước tính lỗi (totalUnknown) ⇒ không in tổng, không cảnh báo số dư, vẫn hiện lưu ý và nút Chạy", () => {
      renderWithIntl(<CreditGateCard title="Soạn phần còn lại của SRS" lines={[]} total={0} totalUnknown available={null} notes={["Chưa ước tính được credit."]} onRun={vi.fn()} onCancel={vi.fn()} />);
      expect(screen.queryByText(/Tổng ước tính/)).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByRole("note")).toHaveTextContent("Chưa ước tính được credit.");
      expect(screen.getByRole("button", { name: "Chạy" })).toBeEnabled();
    });
  });

  it("đang chạy ⇒ hai nút khoá, nút Chạy đổi chữ", () => {
    renderWithIntl(<CreditGateCard {...base} available={120} busy onRun={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Đang chạy…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Huỷ" })).toBeDisabled();
  });
});
