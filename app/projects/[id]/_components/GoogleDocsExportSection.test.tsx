import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
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
const FOLDER = { id: "folder-1", path: "FlintFlow / Đặt lịch khám", url: "https://drive.google.com/drive/folders/folder-1" };
const link = (over: Record<string, unknown> = {}) => ({
  fileId: "doc-1",
  title: "FAP_DRAFT",
  webViewLink: "https://docs.google.com/document/d/doc-1/edit",
  kind: "export",
  source: "draft",
  lang: "vi",
  baselineId: null,
  exportedAt: "2026-11-15T07:02:00.000Z",
  owner: { id: "u1", name: "An", email: "an@example.com" },
  isMine: true,
  folder: FOLDER,
  stale: false,
  ...over,
});
const exported = (over: Record<string, unknown> = {}) => ({
  fileId: "doc-1",
  webViewLink: "https://docs.google.com/document/d/doc-1/edit",
  title: "FAP_DRAFT",
  mode: "new",
  recreated: false,
  folder: FOLDER,
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
  it("chưa xuất lần nào ⇒ bấm Xuất ⇒ tạo mới, hiện link Google Docs và đường dẫn thư mục trên Drive", async () => {
    h.exportToGoogleDocs.mockResolvedValue(exported());
    renderSection({ baselineId: undefined, lang: undefined });

    const button = await screen.findByRole("button", { name: "Xuất sang Google Docs" });
    expect(screen.queryByText("Cập nhật file này")).not.toBeInTheDocument();
    fireEvent.click(button);

    const status = await screen.findByRole("status");
    expect(within(status).getByText(/Đã tạo Google Doc "FAP_DRAFT"/)).toBeInTheDocument();
    expect(h.exportToGoogleDocs).toHaveBeenCalledWith("p1", { source: "draft", baselineId: undefined, lang: undefined }, "new", false);
    expect(within(status).getByRole("link", { name: /Mở Google Docs/ })).toHaveAttribute("href", "https://docs.google.com/document/d/doc-1/edit");
    expect(within(status).getByText("FlintFlow / Đặt lịch khám")).toBeInTheDocument();
    expect(within(status).getByRole("link", { name: /Mở thư mục/ })).toHaveAttribute("href", FOLDER.url);
    expect(h.login).not.toHaveBeenCalled();
  });

  it("đã xuất cùng nguồn + ngôn ngữ ⇒ mặc định Cập nhật Google Doc; nhãn Cũ khi web đã đổi; chọn Tạo bản mới ⇒ mode new", async () => {
    h.google.getGoogleDocLinks.mockResolvedValue([link({ stale: true })]);
    h.exportToGoogleDocs.mockResolvedValue(exported({ mode: "update" }));
    renderSection();

    expect(await screen.findByText(/Dữ liệu dự án đã đổi sau lần xuất này/)).toBeInTheDocument();
    expect(screen.getByLabelText("Cập nhật file này")).toBeChecked();
    expect(screen.getByText(/ghi đè nội dung Google Doc/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cập nhật Google Doc" }));
    expect(await screen.findByText(/Đã cập nhật Google Doc/)).toBeInTheDocument();
    expect(h.exportToGoogleDocs).toHaveBeenLastCalledWith("p1", expect.anything(), "update", false);

    fireEvent.click(screen.getByLabelText("Tạo bản mới"));
    fireEvent.click(screen.getByRole("button", { name: "Xuất sang Google Docs" }));
    await waitFor(() => expect(h.exportToGoogleDocs).toHaveBeenLastCalledWith("p1", expect.anything(), "new", false));
  });

  it("Doc đã bị sửa trong Google Docs ⇒ hỏi xác nhận; Giữ bản trên Google Docs ⇒ không ghi; Vẫn ghi đè ⇒ gửi force", async () => {
    h.google.getGoogleDocLinks.mockResolvedValue([link()]);
    h.exportToGoogleDocs.mockRejectedValueOnce(new ApiClientError(409, "GOOGLE_DOC_MODIFIED", "modified"));
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Cập nhật Google Doc" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/đã được sửa trong Google Docs/)).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Giữ bản trên Google Docs" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(h.exportToGoogleDocs).toHaveBeenCalledTimes(1);

    h.exportToGoogleDocs.mockRejectedValueOnce(new ApiClientError(409, "GOOGLE_DOC_MODIFIED", "modified"));
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật Google Doc" }));
    h.exportToGoogleDocs.mockResolvedValueOnce(exported({ mode: "update" }));
    fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Vẫn ghi đè" }));
    expect(await screen.findByText(/Đã cập nhật Google Doc/)).toBeInTheDocument();
    expect(h.exportToGoogleDocs).toHaveBeenLastCalledWith("p1", expect.anything(), "update", true);
  });

  it("Doc của thành viên khác, Doc liên kết, nguồn / ngôn ngữ khác ⇒ không gợi ý cập nhật; vẫn hiện trong danh sách dự án", async () => {
    h.google.getGoogleDocLinks.mockResolvedValue([
      link({ fileId: "theirs", title: "SRS của Bình", isMine: false, owner: { id: "u2", name: "Bình", email: null } }),
      link({ fileId: "client", title: "SRS khách", kind: "linked", source: null, lang: null, folder: null }),
      link({ fileId: "en", title: "SRS EN", lang: "en" }),
      link({ fileId: "bl", title: "SRS BL", source: "baseline", baselineId: "BL001" }),
    ]);
    renderSection();

    const list = await screen.findByRole("region", { name: "Google Doc của dự án" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(within(list).getByText(/Của Bình/)).toBeInTheDocument();
    expect(within(list).getByText("Liên kết")).toBeInTheDocument();
    expect(screen.queryByText("Cập nhật file này")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xuất sang Google Docs" })).toBeInTheDocument();
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
    h.google.getGoogleDocLinks.mockResolvedValue([
      link({ stale: true, folder: { ...FOLDER, path: "FlintFlow / Booking" } }),
      link({ fileId: "theirs", isMine: false, owner: { id: "u2", name: "Binh", email: null }, folder: null }),
    ]);
    const { container } = renderSection({}, "en");
    expect(await screen.findByRole("button", { name: "Update Google Doc" })).toBeInTheDocument();
    await screen.findByText(/Project data changed/);
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
