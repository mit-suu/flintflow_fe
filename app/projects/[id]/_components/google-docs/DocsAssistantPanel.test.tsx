import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";
import type { DocsAgentEvent } from "@/lib/api/google-docs-agent";
import type { SseHandlers } from "@/lib/ai-stream";

type LoginOptions = { onSuccess: (r: { code: string }) => Promise<void> };

const h = vi.hoisted(() => ({
  login: vi.fn(),
  options: null as LoginOptions | null,
  google: {
    getGoogleStatus: vi.fn(),
    connectGoogle: vi.fn(),
    disconnectGoogle: vi.fn(),
    getGoogleDocLinks: vi.fn(),
    getGoogleAccessToken: vi.fn(),
    linkGoogleDoc: vi.fn(),
    unlinkGoogleDoc: vi.fn(),
  },
  stream: vi.fn(),
  pickGoogleFile: vi.fn(),
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
vi.mock("@/lib/api/google-docs-agent", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  streamDocsAgentMessage: h.stream,
}));
vi.mock("@/lib/google-picker", () => ({
  GOOGLE_DOC_MIME: "application/vnd.google-apps.document",
  isGooglePickerConfigured: true,
  pickGoogleFile: h.pickGoogleFile,
}));

const { default: DocsAssistantPanel } = await import("./DocsAssistantPanel");

const connected = { status: "connected", email: "a@gmail.com", connectedAt: "2026-11-17T00:00:00.000Z" };
const link = (fileId: string, title: string, over: Record<string, unknown> = {}) => ({
  fileId,
  title,
  webViewLink: `https://docs.google.com/document/d/${fileId}/edit`,
  kind: "export",
  source: "draft",
  lang: "vi",
  baselineId: null,
  exportedAt: "2026-11-17T00:00:00.000Z",
  owner: { id: "u1", name: "An", email: null },
  isMine: true,
  folder: null,
  stale: false,
  ...over,
});

/** Luồng SSE giả: phát lần lượt các sự kiện của kịch bản rồi kết thúc. */
const scriptStream = (events: DocsAgentEvent[]) =>
  h.stream.mockImplementationOnce(async (_p: string, _b: unknown, handlers: SseHandlers<DocsAgentEvent>) => {
    for (const e of events) handlers.onEvent(e);
  });

const typeAndSend = (text: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: "Nhập yêu cầu…" }), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  h.options = null;
  h.google.getGoogleStatus.mockResolvedValue(connected);
  h.google.getGoogleDocLinks.mockResolvedValue([link("doc-1", "SRS_v1.0"), link("doc-1", "SRS_v1.0"), link("doc-2", "SRS_draft")]);
});

describe("DocsAssistantPanel", () => {
  it("chọn sẵn tài liệu đã xuất gần nhất (bỏ trùng); gửi ⇒ chip tool, câu trả lời, thẻ đề xuất; tin sau gửi kèm lịch sử", async () => {
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    const select = await screen.findByRole("combobox");
    await waitFor(() => expect(select).toHaveValue("doc-1"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["SRS_v1.0", "SRS_draft"]);

    scriptStream([
      { type: "tool-call", name: "get_outline", args: {} },
      { type: "tool-call", name: "read_section", args: { heading: "3.2 Đặt vé" } },
      { type: "text-delta", delta: "Mình đề xuất " },
      {
        type: "finish",
        cost: 2,
        data: {
          reply: "Mình đề xuất 1 thay đổi.",
          document_title: "SRS_v1.0",
          pending_actions: [
            {
              id: "a1",
              tool: "insert_text",
              documentId: "doc-1",
              args: { afterHeading: "3.2 Đặt vé", text: "Tiêu chí chấp nhận" },
              preview: { location: "3.2 Đặt vé", text: "Tiêu chí chấp nhận", asHeading: false, headingLevel: null },
              expiresAt: "2026-11-17T16:00:00.000Z",
            },
          ],
        },
      },
    ]);
    typeAndSend("Thêm tiêu chí chấp nhận cho mục 3.2");

    expect(await screen.findByText("Mình đề xuất 1 thay đổi.")).toBeInTheDocument();
    expect(screen.getByText(/Đọc dàn ý/)).toBeInTheDocument();
    expect(screen.getByText(/Đọc mục "3.2 Đặt vé"/)).toBeInTheDocument();
    expect(screen.getByText('Đề xuất #1 · Chèn vào cuối "3.2 Đặt vé"')).toBeInTheDocument();
    expect(h.stream.mock.calls[0][1]).toEqual({ documentId: "doc-1", message: "Thêm tiêu chí chấp nhận cho mục 3.2", history: [] });
    expect(h.login).not.toHaveBeenCalled();

    scriptStream([{ type: "finish", cost: 2, data: { reply: "Ok", document_title: "SRS_v1.0", pending_actions: [] } }]);
    typeAndSend("Cảm ơn");
    await screen.findByText("Ok");
    expect(h.stream.mock.calls[1][1].history).toEqual([
      { role: "user", content: "Thêm tiêu chí chấp nhận cho mục 3.2" },
      { role: "assistant", content: "Mình đề xuất 1 thay đổi." },
    ]);
  });

  it("đổi tài liệu ⇒ hội thoại mới", async () => {
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    const select = await screen.findByRole("combobox");
    await waitFor(() => expect(select).toHaveValue("doc-1"));
    scriptStream([{ type: "finish", cost: 2, data: { reply: "Trả lời cho doc-1", document_title: "x", pending_actions: [] } }]);
    typeAndSend("Hỏi");
    await screen.findByText("Trả lời cho doc-1");

    fireEvent.change(select, { target: { value: "doc-2" } });
    expect(screen.queryByText("Trả lời cho doc-1")).not.toBeInTheDocument();
  });

  it("chưa nối Google ⇒ bấm Gửi mở popup ngay, đồng ý xong mới gửi", async () => {
    h.google.getGoogleStatus.mockResolvedValue({ status: "disconnected", email: null, connectedAt: null });
    h.google.connectGoogle.mockResolvedValue(connected);
    scriptStream([{ type: "finish", cost: 2, data: { reply: "Đã đọc", document_title: "x", pending_actions: [] } }]);
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-1"));

    typeAndSend("Đọc mục 1");
    expect(h.login).toHaveBeenCalledTimes(1);
    expect(h.stream).not.toHaveBeenCalled();
    await act(() => h.options!.onSuccess({ code: "c" }));
    expect(await screen.findByText("Đã đọc")).toBeInTheDocument();
  });

  it("lỗi giữa luồng ⇒ câu theo mã lỗi; lỗi trước luồng (cần nối lại) ⇒ câu theo mã", async () => {
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-1"));

    scriptStream([{ type: "error", error: "Không đủ credit.", code: "INSUFFICIENT_CREDIT" }]);
    typeAndSend("Hỏi 1");
    expect(await screen.findByText(/credit/i)).toBeInTheDocument();

    h.stream.mockRejectedValueOnce(new ApiClientError(401, "GOOGLE_RECONNECT_REQUIRED", "x"));
    typeAndSend("Hỏi 2");
    expect(await screen.findByText("Cần kết nối lại tài khoản Google để tiếp tục.")).toBeInTheDocument();
  });

  it("chỉ liệt kê Doc của dự án do mình xuất / liên kết; Doc của thành viên khác chỉ được nhắc số lượng", async () => {
    h.google.getGoogleDocLinks.mockResolvedValue([
      link("doc-1", "SRS_v1.0"),
      link("doc-theirs", "SRS của Bình", { isMine: false, owner: { id: "u2", name: "Bình", email: null } }),
      link("doc-client", "SRS khách", { kind: "linked", source: null, lang: null }),
    ]);
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-1"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["SRS_v1.0", "SRS khách (liên kết)"]);
    expect(screen.getByText(/1 Google Doc của thành viên khác chỉ chủ file dùng trợ lý được/)).toBeInTheDocument();
  });

  it("Liên kết Google Doc… ⇒ Picker chỉ Google Docs ⇒ lưu liên kết ở BE rồi chọn Doc đó", async () => {
    h.google.getGoogleDocLinks.mockResolvedValueOnce([link("doc-1", "SRS_v1.0")]);
    h.google.getGoogleAccessToken.mockResolvedValue({ accessToken: "tok", expiresAt: null });
    h.pickGoogleFile.mockResolvedValue({ id: "doc-9", name: "SRS khách", mimeType: "application/vnd.google-apps.document" });
    h.google.linkGoogleDoc.mockResolvedValue(link("doc-9", "SRS khách", { kind: "linked" }));
    h.google.getGoogleDocLinks.mockResolvedValueOnce([link("doc-9", "SRS khách", { kind: "linked" }), link("doc-1", "SRS_v1.0")]);
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-1"));

    fireEvent.click(screen.getByRole("button", { name: "Liên kết Google Doc…" }));
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-9"));
    expect(h.pickGoogleFile).toHaveBeenCalledWith({ accessToken: "tok", locale: "vi", mimeTypes: ["application/vnd.google-apps.document"] });
    expect(h.google.linkGoogleDoc).toHaveBeenCalledWith("p1", "doc-9");
  });

  it("đóng Picker ⇒ không liên kết gì; BE từ chối file .docx ⇒ hiện câu của BE", async () => {
    h.google.getGoogleAccessToken.mockResolvedValue({ accessToken: "tok", expiresAt: null });
    h.pickGoogleFile.mockResolvedValueOnce(null);
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-1"));

    fireEvent.click(screen.getByRole("button", { name: "Liên kết Google Doc…" }));
    await waitFor(() => expect(h.pickGoogleFile).toHaveBeenCalledTimes(1));
    expect(h.google.linkGoogleDoc).not.toHaveBeenCalled();

    h.pickGoogleFile.mockResolvedValueOnce({ id: "w", name: "SRS.docx", mimeType: "application/vnd.google-apps.document" });
    h.google.linkGoogleDoc.mockRejectedValueOnce(new ApiClientError(400, "GOOGLE_DOC_UNSUPPORTED", "Chỉ liên kết được Google Tài liệu."));
    fireEvent.click(screen.getByRole("button", { name: "Liên kết Google Doc…" }));
    expect(await screen.findByText("Chỉ liên kết được Google Tài liệu.")).toBeInTheDocument();
  });

  it("Doc đang chọn là Doc liên kết ⇒ Bỏ liên kết gọi BE rồi chọn Doc còn lại", async () => {
    h.google.getGoogleDocLinks.mockResolvedValueOnce([link("doc-client", "SRS khách", { kind: "linked" }), link("doc-1", "SRS_v1.0")]);
    h.google.getGoogleDocLinks.mockResolvedValueOnce([link("doc-1", "SRS_v1.0")]);
    h.google.unlinkGoogleDoc.mockResolvedValue(undefined);
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-client"));

    fireEvent.click(screen.getByRole("button", { name: "Bỏ liên kết" }));
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-1"));
    expect(h.google.unlinkGoogleDoc).toHaveBeenCalledWith("p1", "doc-client");
    expect(screen.queryByRole("button", { name: "Bỏ liên kết" })).not.toBeInTheDocument();
  });

  it("dự án chưa có Doc của mình ⇒ hướng dẫn + nút Xuất SRS sang Google Docs ⇒ xuất bản nháp rồi chọn Doc mới", async () => {
    h.google.getGoogleDocLinks.mockResolvedValueOnce([]);
    h.exportToGoogleDocs.mockResolvedValue({ fileId: "doc-new", title: "SRS", webViewLink: "l", mode: "new", recreated: false, folder: null });
    h.google.getGoogleDocLinks.mockResolvedValueOnce([link("doc-new", "SRS")]);
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    expect(await screen.findByText(/Dự án chưa có Google Doc nào của bạn/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xuất SRS sang Google Docs" }));
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-new"));
    expect(h.exportToGoogleDocs).toHaveBeenCalledWith("p1", { source: "draft" }, "new");
    expect(screen.getByRole("textbox", { name: "Nhập yêu cầu…" })).toBeInTheDocument();
  });

  it("BE chưa bật tích hợp ⇒ báo chưa bật, không có ô nhập", async () => {
    h.google.getGoogleStatus.mockRejectedValue(new ApiClientError(503, "GOOGLE_INTEGRATION_DISABLED", "off"));
    renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />);
    expect(await screen.findByText(/chưa được bật/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("bản tiếng Anh không còn chữ tiếng Việt", async () => {
    h.google.getGoogleDocLinks.mockResolvedValue([
      link("doc-1", "SRS"),
      link("doc-client", "Client SRS", { kind: "linked" }),
      link("doc-theirs", "Other", { isMine: false }),
    ]);
    const { container } = renderWithIntl(<DocsAssistantPanel projectId="p1" onClose={vi.fn()} />, "en");
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue("doc-1"));
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
