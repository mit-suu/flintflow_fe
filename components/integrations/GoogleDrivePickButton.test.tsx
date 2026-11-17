import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";

const h = vi.hoisted(() => ({
  configured: true,
  google: { getGoogleStatus: vi.fn(), connectGoogle: vi.fn(), disconnectGoogle: vi.fn(), getGoogleAccessToken: vi.fn() },
  pickGoogleFile: vi.fn(),
  login: vi.fn(),
}));

vi.mock("@react-oauth/google", () => ({ useGoogleLogin: vi.fn(() => h.login) }));
vi.mock("@/lib/google-auth", () => ({ isGoogleAuthEnabled: true, GOOGLE_CLIENT_ID: "abc" }));
vi.mock("@/lib/api/google", () => h.google);
vi.mock("@/lib/google-picker", () => ({
  get isGooglePickerConfigured() {
    return h.configured;
  },
  pickGoogleFile: h.pickGoogleFile,
}));

const { default: GoogleDrivePickButton } = await import("./GoogleDrivePickButton");

const connected = { status: "connected", email: "a@gmail.com", connectedAt: "2026-11-16T00:00:00.000Z" };

beforeEach(() => {
  vi.clearAllMocks();
  h.configured = true;
  h.google.getGoogleStatus.mockResolvedValue(connected);
  h.google.getGoogleAccessToken.mockResolvedValue({ accessToken: "access-xyz", expiresAt: null });
});

describe("GoogleDrivePickButton", () => {
  it("đã nối ⇒ lấy access token, mở Picker theo ngôn ngữ giao diện, trả file đã chọn", async () => {
    const file = { id: "doc-1", name: "SRS", mimeType: "application/vnd.google-apps.document" };
    h.pickGoogleFile.mockResolvedValue(file);
    const onPicked = vi.fn();
    renderWithIntl(<GoogleDrivePickButton onPicked={onPicked} />);

    fireEvent.click(await screen.findByRole("button", { name: /Chọn từ Google Drive/ }));
    await waitFor(() => expect(onPicked).toHaveBeenCalledWith(file));
    expect(h.pickGoogleFile).toHaveBeenCalledWith({ accessToken: "access-xyz", locale: "vi" });
    expect(h.login).not.toHaveBeenCalled();
  });

  it("huỷ Picker ⇒ không báo gì", async () => {
    h.pickGoogleFile.mockResolvedValue(null);
    const onPicked = vi.fn();
    renderWithIntl(<GoogleDrivePickButton onPicked={onPicked} />);
    fireEvent.click(await screen.findByRole("button", { name: /Chọn từ Google Drive/ }));
    await waitFor(() => expect(h.pickGoogleFile).toHaveBeenCalled());
    expect(onPicked).not.toHaveBeenCalled();
    expect(screen.queryByText(/Không mở được/)).not.toBeInTheDocument();
  });

  it("Picker không nạp được ⇒ câu hướng dẫn; BE báo cần nối lại ⇒ câu theo mã", async () => {
    h.pickGoogleFile.mockRejectedValueOnce(new Error("script blocked"));
    renderWithIntl(<GoogleDrivePickButton onPicked={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Chọn từ Google Drive/ }));
    expect(await screen.findByText(/Không mở được Google Drive/)).toBeInTheDocument();

    h.google.getGoogleAccessToken.mockRejectedValueOnce(new ApiClientError(401, "GOOGLE_RECONNECT_REQUIRED", "x"));
    fireEvent.click(screen.getByRole("button", { name: /Chọn từ Google Drive/ }));
    expect(await screen.findByText("Cần kết nối lại tài khoản Google để tiếp tục.")).toBeInTheDocument();
  });

  it("thiếu API key / App ID ⇒ không render; BE tắt tích hợp ⇒ không render", async () => {
    h.configured = false;
    const { container, unmount } = renderWithIntl(<GoogleDrivePickButton onPicked={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    h.configured = true;
    h.google.getGoogleStatus.mockRejectedValue(new ApiClientError(503, "GOOGLE_INTEGRATION_DISABLED", "off"));
    const second = renderWithIntl(<GoogleDrivePickButton onPicked={vi.fn()} />);
    await waitFor(() => expect(second.container).toBeEmptyDOMElement());
  });
});
