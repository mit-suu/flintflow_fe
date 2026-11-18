import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";

type LoginOptions = {
  onSuccess: (r: { code: string }) => Promise<void>;
  onNonOAuthError: (e: { type: string }) => void;
};

const h = vi.hoisted(() => ({
  login: vi.fn(),
  options: null as LoginOptions | null,
  google: { getGoogleStatus: vi.fn(), connectGoogle: vi.fn(), disconnectGoogle: vi.fn(), getGoogleDocLinks: vi.fn() },
  exportToGoogleDocs: vi.fn(),
}));

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn((options: LoginOptions) => {
    h.options = options;
    return h.login;
  }),
}));
vi.mock("@/lib/api/google", () => h.google);
vi.mock("@/lib/api/export", () => ({ exportToGoogleDocs: h.exportToGoogleDocs }));

const { default: GoogleDocsExportSection } = await import("./GoogleDocsExportSection");

const connected = { status: "connected", email: "a@gmail.com", connectedAt: "2026-11-12T08:00:00.000Z" };
const link = (over: Record<string, unknown> = {}) => ({
  fileId: "doc-1",
  title: "FAP_DRAFT",
  webViewLink: "https://docs.google.com/document/d/doc-1/edit",
  source: "draft",
  lang: "vi",
  baselineId: null,
  exportedAt: "2026-11-15T07:02:00.000Z",
  ...over,
});
const exported = (over: Record<string, unknown> = {}) => ({
  fileId: "doc-1",
  webViewLink: "https://docs.google.com/document/d/doc-1/edit",
  title: "FAP_DRAFT",
  mode: "new",
  recreated: false,
  ...over,
});

const renderSection = (props: Partial<Parameters<typeof GoogleDocsExportSection>[0]> = {}, locale: "vi" | "en" = "vi") =>
  renderWithIntl(<GoogleDocsExportSection projectId="p1" source="draft" fileLanguage="vi" {...props} />, locale);

beforeEach(() => {
  vi.clearAllMocks();
  h.options = null;
  h.google.getGoogleStatus.mockResolvedValue(connected);
  h.google.getGoogleDocLinks.mockResolvedValue([]);
});

describe("GoogleDocsExportSection", () => {
  it("chưa xuất lần nào ⇒ không có lựa chọn cập nhật; bấm Xuất ⇒ tạo mới, hiện link mở Google Docs", async () => {
    h.exportToGoogleDocs.mockResolvedValue(exported());
    renderSection({ baselineId: undefined, lang: undefined });

    const button = await screen.findByRole("button", { name: "Xuất sang Google Docs" });
    expect(screen.queryByText("Cập nhật file này")).not.toBeInTheDocument();
    fireEvent.click(button);

    expect(await screen.findByText(/Đã tạo Google Doc "FAP_DRAFT"/)).toBeInTheDocument();
    expect(h.exportToGoogleDocs).toHaveBeenCalledWith("p1", { source: "draft", baselineId: undefined, lang: undefined }, "new");
    expect(screen.getByRole("link", { name: /Mở Google Docs/ })).toHaveAttribute("href", "https://docs.google.com/document/d/doc-1/edit");
    expect(h.login).not.toHaveBeenCalled();
  });

  it("đã xuất cùng nguồn + ngôn ngữ ⇒ mặc định cập nhật file cũ, có cảnh báo ghi đè; chọn Tạo bản mới ⇒ mode new", async () => {
    h.google.getGoogleDocLinks.mockResolvedValue([link()]);
    h.exportToGoogleDocs.mockResolvedValue(exported({ mode: "update" }));
    renderSection();

    expect(await screen.findByText(/FAP_DRAFT/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Cập nhật file này" })).toBeChecked();
    expect(screen.getByText(/ghi đè mọi chỉnh sửa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xuất sang Google Docs" }));
    expect(await screen.findByText(/Đã cập nhật Google Doc/)).toBeInTheDocument();
    expect(h.exportToGoogleDocs).toHaveBeenLastCalledWith("p1", expect.anything(), "update");

    fireEvent.click(screen.getByRole("radio", { name: "Tạo bản mới" }));
    expect(screen.queryByText(/ghi đè mọi chỉnh sửa/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xuất sang Google Docs" }));
    await waitFor(() => expect(h.exportToGoogleDocs).toHaveBeenLastCalledWith("p1", expect.anything(), "new"));
  });

  it("link của nguồn / ngôn ngữ khác ⇒ không gợi ý cập nhật", async () => {
    h.google.getGoogleDocLinks.mockResolvedValue([link({ lang: "en" }), link({ source: "baseline", baselineId: "BL001" })]);
    renderSection();
    await screen.findByRole("button", { name: "Xuất sang Google Docs" });
    await waitFor(() => expect(h.google.getGoogleDocLinks).toHaveBeenCalled());
    expect(screen.queryByText("Cập nhật file này")).not.toBeInTheDocument();
  });

  it("chưa nối Google ⇒ nút Kết nối Google và xuất mở popup trong cú click, đồng ý xong mới xuất", async () => {
    h.google.getGoogleStatus.mockResolvedValue({ status: "disconnected", email: null, connectedAt: null });
    h.google.connectGoogle.mockResolvedValue(connected);
    h.exportToGoogleDocs.mockResolvedValue(exported());
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Kết nối Google và xuất" }));
    expect(h.login).toHaveBeenCalledTimes(1);
    expect(h.exportToGoogleDocs).not.toHaveBeenCalled();

    await act(() => h.options!.onSuccess({ code: "auth-code" }));
    expect(h.google.connectGoogle).toHaveBeenCalledWith("auth-code");
    expect(await screen.findByText(/Đã tạo Google Doc/)).toBeInTheDocument();
  });

  it("đóng popup ⇒ báo huỷ, không gọi xuất", async () => {
    h.google.getGoogleStatus.mockResolvedValue({ status: "disconnected", email: null, connectedAt: null });
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Kết nối Google và xuất" }));
    act(() => h.options!.onNonOAuthError({ type: "popup_closed" }));
    expect(await screen.findByText(/Cửa sổ Google đã đóng/)).toBeInTheDocument();
    expect(h.exportToGoogleDocs).not.toHaveBeenCalled();
  });

  it("BE báo cần kết nối lại ⇒ hiện câu lỗi, nút đổi sang Kết nối Google và xuất", async () => {
    h.exportToGoogleDocs.mockRejectedValue(new ApiClientError(401, "GOOGLE_RECONNECT_REQUIRED", "x"));
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Xuất sang Google Docs" }));

    expect(await screen.findByText("Cần kết nối lại tài khoản Google để tiếp tục.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kết nối Google và xuất" })).toBeInTheDocument();
  });

  it("BE chưa bật tích hợp ⇒ báo chưa bật, không có nút xuất", async () => {
    h.google.getGoogleStatus.mockRejectedValue(new ApiClientError(503, "GOOGLE_INTEGRATION_DISABLED", "off"));
    renderSection();
    expect(await screen.findByText(/chưa được bật/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("bản tiếng Anh không còn chữ tiếng Việt", async () => {
    h.google.getGoogleDocLinks.mockResolvedValue([link()]);
    const { container } = renderSection({}, "en");
    expect(await screen.findByRole("button", { name: "Export to Google Docs" })).toBeInTheDocument();
    await screen.findByText(/FAP_DRAFT/);
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
