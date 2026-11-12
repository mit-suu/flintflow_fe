import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";
import { estimateScreenMockups, fetchScreenOriginalImage, runScreenMockups } from "@/lib/api/projects";
import type { ScreenMockupEstimate, ScreenMockupMode, ScreenMockupRunView, ScreenMockupScope } from "@/types/project";
import ScreenMockupDialog from "./ScreenMockupDialog";

vi.mock("@/lib/api/projects", () => ({ estimateScreenMockups: vi.fn(), runScreenMockups: vi.fn(), fetchScreenOriginalImage: vi.fn() }));

const SCREENS = [
  { screen_id: "SCR-01", name: "Sign Up" },
  { screen_id: "SCR-02", name: "Cart" },
  { screen_id: "SCR-03", name: "Checkout" },
];
const est = (draw: string[], reenable: string[] = [], skip: string[] = []): ScreenMockupEstimate => ({
  screens: draw.length + reenable.length + skip.length,
  ai_calls: draw.length,
  credits: draw.length,
  reenable: reenable.length,
  groups: { draw, reenable, skip },
});
/** Ước tính theo kiểu + phạm vi, như BE: màn SCR-02 đã là mockup chuẩn. */
const ESTIMATES: Record<`${ScreenMockupMode}:${ScreenMockupScope}`, ScreenMockupEstimate> = {
  "system:screen": est(["SCR-01"]),
  "system:all": est(["SCR-01", "SCR-03"], [], ["SCR-02"]),
  "original:screen": est([], ["SCR-01"]),
  "original:all": est([], [], ["SCR-01", "SCR-02", "SCR-03"]),
};
const RUN: ScreenMockupRunView = {
  run_id: "r1",
  status: "running",
  stopping: false,
  total: 1,
  completed: 0,
  done: [],
  failed: [],
  fell_back_to_system: [],
  pending: ["SCR-01"],
  suggested_color: null,
};

describe("ScreenMockupDialog (FLF-410)", () => {
  beforeEach(() => {
    vi.mocked(estimateScreenMockups)
      .mockReset()
      .mockImplementation(async (_p, mode, scope) => ({ data: ESTIMATES[`${mode}:${scope}`], error: null }) as never);
    vi.mocked(runScreenMockups).mockReset().mockResolvedValue({ data: RUN, error: null } as never);
    vi.mocked(fetchScreenOriginalImage).mockReset().mockRejectedValue(new ApiClientError(404, "SCREEN_HAS_NO_ORIGINAL", "none"));
  });

  it("mở từ một màn: mặc định 'Màn này' + mockup chuẩn; nút nói việc làm; bấm ⇒ POST screen_ids, báo bắt đầu, đóng", async () => {
    const onStarted = vi.fn();
    const onClose = vi.fn();
    renderWithIntl(<ScreenMockupDialog projectId="p1" screens={SCREENS} screenId="SCR-01" onClose={onClose} onStarted={onStarted} />);
    expect(screen.getByText("Màn Sign Up")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Màn này" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /^Mockup chuẩn/ })).toHaveAttribute("aria-checked", "true");

    const cta = await screen.findByRole("button", { name: "Vẽ lại 1 màn" });
    expect(estimateScreenMockups).toHaveBeenCalledWith("p1", "system", "screen", "SCR-01");
    expect(screen.getByText("Tốn 1 credit · chạy nền, hộp đóng ngay")).toBeInTheDocument();
    fireEvent.click(cta);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(runScreenMockups).toHaveBeenCalledWith("p1", "system", "screen", ["SCR-01"]);
    expect(onStarted).toHaveBeenCalledWith(RUN);
  });

  it("đổi phạm vi ⇒ tính lại; ba nhóm cộng đủ tổng, 'Xem màn' ra tên từng nhóm", async () => {
    renderWithIntl(<ScreenMockupDialog projectId="p1" screens={SCREENS} screenId="SCR-01" onClose={() => {}} onStarted={() => {}} />);
    await screen.findByRole("button", { name: "Vẽ lại 1 màn" });
    fireEvent.click(screen.getByRole("radio", { name: "Tất cả 3 màn" }));
    expect(await screen.findByRole("button", { name: "Vẽ lại 2 màn" })).toBeEnabled();
    expect(estimateScreenMockups).toHaveBeenLastCalledWith("p1", "system", "all", undefined);
    expect(screen.getByText("3 màn:")).toBeInTheDocument();
    expect(screen.getByText(/2 vẽ mới · 1 bỏ qua \(đã là mockup kiểu này\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xem màn" }));
    expect(screen.getByText("Sign Up, Checkout")).toBeInTheDocument();
    expect(screen.getByText("Cart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ẩn" }));
    expect(screen.queryByText("Sign Up, Checkout")).not.toBeInTheDocument();
  });

  it("kiểu ảnh gốc đã vẽ trước đó ⇒ 'Bật lại', 0 credit; tất cả đã đúng kiểu ⇒ nút tắt", async () => {
    renderWithIntl(<ScreenMockupDialog projectId="p1" screens={SCREENS} screenId="SCR-01" currentMode="original" onClose={() => {}} onStarted={() => {}} />);
    expect(screen.getByRole("radio", { name: /^Theo ảnh gốc/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Đang dùng")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Bật lại 1 màn" })).toBeEnabled();
    expect(screen.getByText("Không tốn credit")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Tất cả 3 màn" }));
    expect(await screen.findByRole("button", { name: "Không có gì để vẽ" })).toBeDisabled();
  });

  it("ví thiếu (402) ⇒ báo cần/còn, không đóng", async () => {
    vi.mocked(runScreenMockups).mockRejectedValue(new ApiClientError(402, "INSUFFICIENT_CREDITS", "no", { required: 2, available: 1 }));
    const onClose = vi.fn();
    renderWithIntl(<ScreenMockupDialog projectId="p1" screens={SCREENS} onClose={onClose} onStarted={() => {}} />);
    expect(screen.getByText("Tất cả 3 màn có ảnh gốc")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Vẽ lại 2 màn" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cần 2 credit, ví còn 1.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ước tính lỗi ⇒ báo chưa tính được, nút chính tắt", async () => {
    vi.mocked(estimateScreenMockups).mockRejectedValue(new Error("down"));
    renderWithIntl(<ScreenMockupDialog projectId="p1" screens={SCREENS} screenId="SCR-01" onClose={() => {}} onStarted={() => {}} />);
    expect(await screen.findByText("Chưa tính được credit dự tính.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vẽ lại|Không có gì/ })).toBeDisabled();
  });

  it("giao diện tiếng Anh không còn chữ Việt", async () => {
    renderWithIntl(<ScreenMockupDialog projectId="p1" screens={SCREENS} screenId="SCR-01" onClose={() => {}} onStarted={() => {}} />, "en");
    await screen.findByRole("button", { name: /1/ });
    expect(vietnameseLeftovers(document.body)).toEqual([]);
  });
});
