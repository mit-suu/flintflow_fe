import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";
import { disableScreenMockups, estimateScreenMockups, getScreenMockupSummary, setScreenTheme } from "@/lib/api/projects";
import type { Project, ScreenMockupSummary, ScreenTheme } from "@/types/project";
import ScreenThemeDialog, { themePatch } from "./ScreenThemeDialog";

vi.mock("@/lib/api/projects", () => ({
  setScreenTheme: vi.fn(),
  getScreenMockupSummary: vi.fn(),
  disableScreenMockups: vi.fn(),
  estimateScreenMockups: vi.fn(),
  runScreenMockups: vi.fn(),
  fetchScreenOriginalImage: vi.fn(async () => {
    throw new Error("no image");
  }),
}));

const EMPTY: ScreenTheme = { primaryColor: null, domain: null, platforms: null };
const base: Project = {
  _id: "p1",
  name: "TechMart",
  status: "active",
  mode: "fpt",
  import_state: null,
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  screenTheme: EMPTY,
};
const SUMMARY: ScreenMockupSummary = {
  with_original: 20,
  using_mockup: 3,
  screens: [],
  originals: [
    { screen_id: "SCR-01", section_id: "s1", name: "Sign Up" },
    { screen_id: "SCR-02", section_id: "s2", name: "Cart" },
  ],
};

describe("themePatch", () => {
  it("chỉ gửi field đổi; domain trim, trắng ⇒ null; platforms so theo giá trị", () => {
    expect(themePatch(EMPTY, EMPTY)).toEqual({});
    expect(themePatch(EMPTY, { ...EMPTY, primaryColor: "#00897B" })).toEqual({ primaryColor: "#00897B" });
    expect(themePatch(EMPTY, { ...EMPTY, domain: "  " })).toEqual({});
    expect(themePatch({ ...EMPTY, domain: "a.vn" }, { ...EMPTY, domain: " b.vn " })).toEqual({ domain: "b.vn" });
    expect(themePatch({ ...EMPTY, platforms: ["web"] }, { ...EMPTY, platforms: ["web"] })).toEqual({});
    expect(themePatch({ ...EMPTY, platforms: ["web"] }, { ...EMPTY, platforms: null })).toEqual({ platforms: null });
  });
});

describe("ScreenThemeDialog (FLF-410)", () => {
  beforeEach(() => {
    vi.mocked(setScreenTheme).mockReset().mockResolvedValue({ data: base, error: null } as never);
    vi.mocked(getScreenMockupSummary).mockReset().mockResolvedValue({ data: SUMMARY, error: null } as never);
    vi.mocked(disableScreenMockups).mockReset().mockResolvedValue({ data: { disabled: ["SCR-01"] }, error: null } as never);
    vi.mocked(estimateScreenMockups)
      .mockReset()
      .mockResolvedValue({ data: { screens: 2, ai_calls: 2, credits: 2, reenable: 0, groups: { draw: ["SCR-01", "SCR-02"], reenable: [], skip: [] } }, error: null } as never);
  });

  it("chưa đổi gì ⇒ Lưu tắt; đổi màu ⇒ PATCH chỉ màu, tải lại rồi đóng", async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    renderWithIntl(<ScreenThemeDialog project={base} onClose={onClose} onDone={onDone} />);
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "#C62828" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(setScreenTheme).toHaveBeenCalledWith("p1", { primaryColor: "#C62828" });
    expect(onDone).toHaveBeenCalled();
    // Dự án không import ⇒ không hỏi danh sách ảnh gốc
    expect(getScreenMockupSummary).not.toHaveBeenCalled();
  });

  it("hex dở ⇒ Lưu tắt dù đã đổi field khác", () => {
    renderWithIntl(<ScreenThemeDialog project={base} onClose={() => {}} onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "shop.vn" } });
    expect(screen.getByRole("button", { name: "Lưu" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Mã màu (#RRGGBB)"), { target: { value: "#12" } });
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  });

  it("PATCH lỗi ⇒ báo lỗi, không đóng", async () => {
    vi.mocked(setScreenTheme).mockRejectedValue(new ApiClientError(400, "VALIDATION_ERROR", "bad"));
    const onClose = vi.fn();
    renderWithIntl(<ScreenThemeDialog project={base} onClose={onClose} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "#C62828" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("dự án import có ảnh gốc ⇒ dòng tổng; 'Dùng ảnh gốc cho tất cả' gọi DELETE scope all, ẩn nút", async () => {
    renderWithIntl(<ScreenThemeDialog project={{ ...base, mode: "import" }} onClose={() => {}} onDone={() => {}} />);
    expect(await screen.findByText("Màn có ảnh gốc: 20 · đang dùng mockup: 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dùng ảnh gốc cho tất cả" }));
    expect(await screen.findByText("Đã chuyển mọi màn về ảnh gốc.")).toBeInTheDocument();
    expect(disableScreenMockups).toHaveBeenCalledWith("p1", "all");
    expect(screen.getByText("Màn có ảnh gốc: 20 · đang dùng mockup: 0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dùng ảnh gốc cho tất cả" })).not.toBeInTheDocument();
  });

  it("'Vẽ lại tất cả…' ⇒ mở hộp vẽ lại phạm vi tất cả (không có nút chuyển phạm vi)", async () => {
    renderWithIntl(<ScreenThemeDialog project={{ ...base, mode: "import" }} onClose={() => {}} onDone={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Vẽ lại tất cả…" }));
    expect(await screen.findByText("Tất cả 2 màn có ảnh gốc")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Phạm vi" })).not.toBeInTheDocument();
    await waitFor(() => expect(estimateScreenMockups).toHaveBeenCalledWith("p1", "system", "all", undefined));
  });
});
