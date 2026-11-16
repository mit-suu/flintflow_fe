import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { ScreenMockupRunView } from "@/types/project";
import ScreenMockupRunCard from "./ScreenMockupRunCard";

const NAMES: Record<string, string> = { "SCR-01": "Sign Up", "SCR-02": "Cart", "SCR-03": "Checkout" };
const nameOf = (id: string) => NAMES[id] ?? id;
const view = (over: Partial<ScreenMockupRunView> = {}): ScreenMockupRunView => ({
  run_id: "r1",
  status: "running",
  stopping: false,
  total: 3,
  completed: 1,
  done: ["SCR-01"],
  failed: [],
  fell_back_to_system: [],
  pending: ["SCR-02", "SCR-03"],
  suggested_color: null,
  ...over,
});
const handlers = () => ({
  onCancel: vi.fn(async () => {}),
  onDismiss: vi.fn(),
  onRetry: vi.fn(async () => {}),
  onApplyColor: vi.fn(async () => {}),
});

describe("ScreenMockupRunCard (FLF-410)", () => {
  afterEach(() => vi.useRealTimers());

  it("đang chạy: pill tiến độ; mở popover ⇒ Dừng gọi onCancel; đang dừng ⇒ ẩn nút Dừng", async () => {
    const h = handlers();
    const { rerender } = renderWithIntl(<ScreenMockupRunCard run={view()} nameOf={nameOf} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: "Mockup 1/3" }));
    expect(screen.getByRole("dialog", { name: "Đang vẽ mockup 1/3 màn" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dừng" }));
    await waitFor(() => expect(h.onCancel).toHaveBeenCalled());

    rerender(<ScreenMockupRunCard run={view({ stopping: true })} nameOf={nameOf} {...h} />);
    expect(screen.getByRole("dialog", { name: "Đang dừng sau màn hiện tại (1/3)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dừng" })).not.toBeInTheDocument();
  });

  it("xong có màn lỗi: pill đỏ, tên màn lỗi, 'Thử lại' gửi đúng màn; Esc đóng popover", async () => {
    const h = handlers();
    renderWithIntl(
      <ScreenMockupRunCard
        run={view({ status: "done", completed: 3, done: ["SCR-01"], failed: [{ screen_id: "SCR-02", reason: "x" }, { screen_id: "SCR-03", reason: "y" }], pending: [] })}
        nameOf={nameOf}
        {...h}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "2 màn lỗi" }));
    expect(screen.getByText("Chưa vẽ được (giữ ảnh gốc): Cart, Checkout.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại các màn lỗi" }));
    await waitFor(() => expect(h.onRetry).toHaveBeenCalledWith(["SCR-02", "SCR-03"]));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gợi ý màu + màn rơi về kiểu chuẩn: hiện ghi chú, 'Áp dụng' gửi màu; không tự ẩn", () => {
    vi.useFakeTimers();
    const h = handlers();
    renderWithIntl(
      <ScreenMockupRunCard run={view({ status: "done", completed: 3, done: ["SCR-01", "SCR-02", "SCR-03"], fell_back_to_system: ["SCR-03"], suggested_color: "#E4572E", pending: [] })} nameOf={nameOf} {...h} />
    );
    // Popover đóng (điều kiện tự ẩn chỉ còn phụ thuộc "cần chú ý") ⇒ qua mốc 8 giây vẫn không ẩn
    act(() => vi.advanceTimersByTime(20_000));
    expect(h.onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Đã vẽ 3 màn" }));
    expect(screen.getByText("Ảnh gốc không đọc được, đã vẽ theo mockup chuẩn: Checkout.")).toBeInTheDocument();
    expect(screen.getByText("Ảnh gốc dùng màu #E4572E. Áp cho cả dự án?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(h.onApplyColor).toHaveBeenCalledWith("#E4572E");
  });

  it("chỉ có màn rơi về kiểu chuẩn (không lỗi, không gợi ý màu) ⇒ vẫn không tự ẩn", () => {
    vi.useFakeTimers();
    const h = handlers();
    renderWithIntl(<ScreenMockupRunCard run={view({ status: "done", completed: 3, done: ["SCR-01", "SCR-02", "SCR-03"], fell_back_to_system: ["SCR-02"], pending: [] })} nameOf={nameOf} {...h} />);
    act(() => vi.advanceTimersByTime(20_000));
    expect(h.onDismiss).not.toHaveBeenCalled();
  });

  it("xong gọn ⇒ tự ẩn sau 8 giây", () => {
    vi.useFakeTimers();
    const h = handlers();
    renderWithIntl(<ScreenMockupRunCard run={view({ status: "done", completed: 3, done: ["SCR-01", "SCR-02", "SCR-03"], pending: [] })} nameOf={nameOf} {...h} />);
    expect(screen.getByRole("button", { name: "Đã vẽ 3 màn" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(7_999));
    expect(h.onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  it("không có gì để vẽ ⇒ 'Đã là mockup'; chỉ bật lại ⇒ báo 0 credit; lỗi thao tác ⇒ hiện lỗi", async () => {
    const h = handlers();
    const { rerender } = renderWithIntl(<ScreenMockupRunCard run={view({ status: "done", total: 0, completed: 0, done: [], pending: [] })} nameOf={nameOf} {...h} />);
    expect(screen.getByRole("button", { name: "Đã là mockup" })).toBeInTheDocument();

    rerender(<ScreenMockupRunCard run={view({ status: "done", total: 0, completed: 0, done: ["SCR-01"], pending: [] })} nameOf={nameOf} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: "Đã vẽ 1 màn" }));
    expect(screen.getByRole("dialog", { name: "Đã bật lại mockup cho 1 màn (0 credit)" })).toBeInTheDocument();

    h.onRetry.mockRejectedValueOnce(new Error("boom"));
    rerender(<ScreenMockupRunCard run={view({ status: "done", total: 1, completed: 1, done: [], failed: [{ screen_id: "SCR-01", reason: "x" }], pending: [] })} nameOf={nameOf} {...h} />);
    expect(screen.getByRole("dialog", { name: "Chưa vẽ được 1 màn" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại các màn lỗi" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
