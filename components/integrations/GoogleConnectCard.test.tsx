import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";

type LoginOptions = {
  flow: string;
  scope: string;
  onSuccess: (r: { code: string }) => Promise<void>;
  onError: (r: { error?: string }) => void;
  onNonOAuthError: (e: { type: string }) => void;
};

const h = vi.hoisted(() => ({
  login: vi.fn(),
  options: null as LoginOptions | null,
  googleEnabled: true,
  api: {
    getGoogleStatus: vi.fn(),
    connectGoogle: vi.fn(),
    disconnectGoogle: vi.fn(),
  },
}));

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: vi.fn((options: LoginOptions) => {
    h.options = options;
    return h.login;
  }),
}));
vi.mock("@/lib/google-auth", () => ({
  get isGoogleAuthEnabled() {
    return h.googleEnabled;
  },
  GOOGLE_CLIENT_ID: "abc.apps.googleusercontent.com",
}));
vi.mock("@/lib/api/google", () => h.api);

const { default: GoogleConnectCard } = await import("./GoogleConnectCard");

const status = (s: "connected" | "disconnected" | "reconnect_required", email: string | null = null) => ({
  status: s,
  email,
  connectedAt: email ? "2026-11-12T08:00:00.000Z" : null,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.options = null;
  h.googleEnabled = true;
});

describe("GoogleConnectCard", () => {
  it("không có client id ⇒ không render, không gọi BE", () => {
    h.googleEnabled = false;
    const { container } = renderWithIntl(<GoogleConnectCard />);
    expect(container).toBeEmptyDOMElement();
    expect(h.api.getGoogleStatus).not.toHaveBeenCalled();
  });

  it("BE chưa bật tích hợp (503) ⇒ ẩn thẻ", async () => {
    h.api.getGoogleStatus.mockRejectedValue(new ApiClientError(503, "GOOGLE_INTEGRATION_DISABLED", "off"));
    const { container } = renderWithIntl(<GoogleConnectCard />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("chưa nối ⇒ bấm Kết nối mở popup auth-code drive.file, gửi code cho BE, hiện email", async () => {
    h.api.getGoogleStatus.mockResolvedValue(status("disconnected"));
    h.api.connectGoogle.mockResolvedValue(status("connected", "drive.owner@gmail.com"));
    renderWithIntl(<GoogleConnectCard />);

    expect(await screen.findByText(/Chưa kết nối/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kết nối" }));
    expect(h.login).toHaveBeenCalledTimes(1);
    expect(h.options).toMatchObject({ flow: "auth-code" });
    expect(h.options!.scope.split(" ")).toContain("https://www.googleapis.com/auth/drive.file");

    await act(() => h.options!.onSuccess({ code: "auth-code" }));
    expect(h.api.connectGoogle).toHaveBeenCalledWith("auth-code");
    expect(await screen.findByText(/drive\.owner@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ngắt kết nối" })).toBeInTheDocument();
  });

  it("đã nối ⇒ Ngắt kết nối gọi BE rồi về Chưa kết nối", async () => {
    h.api.getGoogleStatus.mockResolvedValue(status("connected", "a@gmail.com"));
    h.api.disconnectGoogle.mockResolvedValue(status("disconnected"));
    renderWithIntl(<GoogleConnectCard />);

    fireEvent.click(await screen.findByRole("button", { name: "Ngắt kết nối" }));
    expect(await screen.findByText(/Chưa kết nối/)).toBeInTheDocument();
    expect(h.api.disconnectGoogle).toHaveBeenCalledTimes(1);
  });

  it("Google thu hồi quyền ⇒ nút Kết nối lại", async () => {
    h.api.getGoogleStatus.mockResolvedValue(status("reconnect_required", "a@gmail.com"));
    renderWithIntl(<GoogleConnectCard />);
    expect(await screen.findByRole("button", { name: "Kết nối lại" })).toBeInTheDocument();
    expect(screen.getByText(/Cần kết nối lại/)).toBeInTheDocument();
  });

  it("đóng popup ⇒ báo đã huỷ, không gọi BE", async () => {
    h.api.getGoogleStatus.mockResolvedValue(status("disconnected"));
    renderWithIntl(<GoogleConnectCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Kết nối" }));

    act(() => h.options!.onNonOAuthError({ type: "popup_closed" }));
    expect(await screen.findByText(/Cửa sổ Google đã đóng/)).toBeInTheDocument();
    expect(h.api.connectGoogle).not.toHaveBeenCalled();
  });

  it("BE từ chối vì thiếu quyền ⇒ hiện câu lỗi theo mã", async () => {
    h.api.getGoogleStatus.mockResolvedValue(status("disconnected"));
    h.api.connectGoogle.mockRejectedValue(new ApiClientError(400, "GOOGLE_CONSENT_INCOMPLETE", "x"));
    renderWithIntl(<GoogleConnectCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Kết nối" }));

    await act(() => h.options!.onSuccess({ code: "auth-code" }));
    expect(await screen.findByText(/Chưa nhận đủ quyền từ Google/)).toBeInTheDocument();
  });

  it("bản tiếng Anh không còn chữ tiếng Việt", async () => {
    h.api.getGoogleStatus.mockResolvedValue(status("connected", "a@gmail.com"));
    const { container } = renderWithIntl(<GoogleConnectCard />, "en");
    expect(await screen.findByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
