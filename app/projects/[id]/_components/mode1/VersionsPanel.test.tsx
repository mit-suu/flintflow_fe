import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { saveBlob } from "@/lib/api/files";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import type { DocVersion } from "@/types/doc-version";
import VersionsPanel from "./VersionsPanel";

const P = MODE1_PROJECT_ID;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));
vi.mock("@/lib/api/files", async (importOriginal) => ({ ...(await importOriginal<object>()), saveBlob: vi.fn() }));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
  vi.mocked(saveBlob).mockClear();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const version = (v: string, kind: DocVersion["kind"], cr_ids: string[] = []): DocVersion => ({
  version: v,
  kind,
  based_on: null,
  cr_ids,
  baseline_id: null,
  has_clean_file: kind === "release",
  has_original_file: kind === "imported",
  created_by: "u1",
  created_at: "2026-09-19T00:00:00.000Z",
});

const DRAFTS = [version("0.2", "cr_revision", ["CR-002", "CR-003"]), version("0.1", "cr_revision", ["CR-001"]), version("0.0", "imported")];
const RELEASED = [version("1.0", "release", ["CR-001", "CR-002"]), ...DRAFTS];

type Props = Parameters<typeof VersionsPanel>[0];
const renderPanel = (over: Partial<Props> = {}) => {
  const props: Props = { projectId: P, projectName: "Lumen", versions: DRAFTS, redOpen: 0, selected: "0.2", onSelect: vi.fn(), onReleased: vi.fn(), ...over };
  renderWithIntl(<VersionsPanel {...props} />);
  return props;
};

/** Ghi lại request tải file; trả file có/không có Content-Disposition. */
const serveDownload = (filename: string | null = null) => {
  const seen: string[] = [];
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/versions/:v/download`, ({ params, request }) => {
      seen.push(`${String(params.v)}?${new URL(request.url).searchParams.toString()}`);
      return new HttpResponse("docx", { headers: filename ? { "Content-Disposition": `attachment; filename="${filename}"` } : {} });
    })
  );
  return seen;
};

/** Release: ghi lại base_version gửi lên, trả response hoặc lỗi. */
const serveRelease = (res: () => Response) => {
  const bodies: unknown[] = [];
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/spine`, () => HttpResponse.json({ data: { spine_version: 17 }, error: null })),
    http.post(`${API_BASE_URL}/projects/:projectId/release`, async ({ request }) => {
      bodies.push(await request.json());
      return res();
    })
  );
  return bodies;
};

const releaseButton = () => screen.getByRole("button", { name: "Release" });

describe("VersionsPanel — nút Release (BR-04, Flow 6)", () => {
  it("còn cờ đỏ ⇒ Release tắt, title + dòng lý do nêu số cờ đỏ", () => {
    renderPanel({ redOpen: 3 });
    expect(releaseButton()).toBeDisabled();
    expect(releaseButton()).toHaveAttribute("title", "Còn 3 cờ đỏ — xử lý qua change request trước khi release.");
    expect(screen.getByText("Còn 3 cờ đỏ — xử lý qua change request trước khi release.")).toBeInTheDocument();
    fireEvent.click(releaseButton());
    expect(screen.queryByRole("button", { name: "Xác nhận release" })).not.toBeInTheDocument();
  });

  it("chưa tải xong số cờ (null) ⇒ tắt, “Đang kiểm cờ…”", () => {
    renderPanel({ redOpen: null });
    expect(releaseButton()).toBeDisabled();
    expect(screen.getByText("Đang kiểm cờ…")).toBeInTheDocument();
  });

  it("chưa có version nào ⇒ Release tắt", () => {
    renderPanel({ versions: [], selected: null });
    expect(releaseButton()).toBeDisabled();
    expect(screen.getByText("Chưa có tài liệu.")).toBeInTheDocument();
  });

  it("đỏ = 0 ⇒ bật; hộp xác nhận nêu bản gốc release; Huỷ quay lại không gọi API", () => {
    const bodies = serveRelease(() => HttpResponse.json({ data: null, error: null }));
    const props = renderPanel();
    expect(releaseButton()).toBeEnabled();
    expect(screen.queryByText(/cờ đỏ/)).not.toBeInTheDocument();

    fireEvent.click(releaseButton());
    expect(screen.getByText(/Release từ bản 0.2\?/)).toBeInTheDocument();
    expect(screen.queryByText(/đã là bản release/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(releaseButton()).toBeEnabled();
    expect(bodies).toHaveLength(0);
    expect(props.onReleased).not.toHaveBeenCalled();
  });

  it("xác nhận release gửi base_version = spine_version vừa đọc; xong báo onReleased", async () => {
    const bodies = serveRelease(() => HttpResponse.json({ data: { version: version("1.0", "release") }, error: null }));
    const props = renderPanel();
    fireEvent.click(releaseButton());
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận release" }));

    await waitFor(() => expect(props.onReleased).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([{ base_version: 17 }]);
    expect(releaseButton()).toBeInTheDocument();
  });

  it("bản mới nhất đã là release ⇒ hộp xác nhận cảnh báo release lại", () => {
    renderPanel({ versions: RELEASED, selected: "1.0" });
    fireEvent.click(releaseButton());
    expect(screen.getByText(/đã là bản release và chưa có change request nào ghi sau đó/)).toBeInTheDocument();
  });

  it("422 RELEASE_RED_FLAGS_OPEN ⇒ lỗi kèm danh sách cờ chặn, không báo onReleased", async () => {
    serveRelease(() =>
      HttpResponse.json(
        {
          data: null,
          error: { code: "RELEASE_RED_FLAGS_OPEN", message: "Còn cờ đỏ" },
          meta: { flags: [{ id: "F1", message: "NFR-P02 thiếu ngưỡng" }, { id: "F2", message: "Thiếu mục 5.3" }] },
        },
        { status: 422 }
      )
    );
    const props = renderPanel();
    fireEvent.click(releaseButton());
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận release" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Còn cờ đỏ chưa xử lý — chưa release được.");
    expect(within(alert).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["NFR-P02 thiếu ngưỡng", "Thiếu mục 5.3"]);
    expect(props.onReleased).not.toHaveBeenCalled();
  });

  it("409 SPINE_VERSION_CONFLICT ⇒ báo lỗi và gọi onReleased để tải lại", async () => {
    serveRelease(() => HttpResponse.json({ data: null, error: { code: "SPINE_VERSION_CONFLICT", message: "conflict" } }, { status: 409 }));
    const props = renderPanel();
    fireEvent.click(releaseButton());
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận release" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu vừa thay đổi ở phiên khác");
    expect(props.onReleased).toHaveBeenCalledTimes(1);
  });
});

describe("VersionsPanel — danh sách version và tải file", () => {
  it("nhãn loại version, link CR đã ghi, chọn version gọi onSelect", () => {
    const props = renderPanel({ versions: RELEASED, selected: "0.1" });
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("button")!.textContent)).toEqual(["1.0", "0.2", "0.1", "0.0"]);
    expect(items[0]).toHaveTextContent("Bản release");
    expect(items[1]).toHaveTextContent("Bản nháp sau CR");
    expect(items[3]).toHaveTextContent("Bản import");
    expect(items[2].className).toContain("border-[#6A62C4]");
    expect(within(items[1]).getByRole("link", { name: "CR-003" })).toHaveAttribute("href", `/projects/${P}/change-requests/CR-003`);

    fireEvent.click(screen.getByRole("button", { name: "Xem bản 0.0" }));
    expect(props.onSelect).toHaveBeenCalledWith("0.0");
  });

  it("nút tải theo loại: release ⇒ bản sạch + bản có Track Changes; draft ⇒ bản draft; import ⇒ bản gốc", () => {
    renderPanel({ versions: RELEASED });
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByRole("button", { name: "Tải bản sạch" })).toBeInTheDocument();
    expect(within(items[0]).getByRole("button", { name: "Bản có Track Changes" })).toBeInTheDocument();
    expect(within(items[1]).getByRole("button", { name: "Tải bản draft (Track Changes)" })).toBeInTheDocument();
    expect(within(items[1]).queryByRole("button", { name: "Bản có Track Changes" })).not.toBeInTheDocument();
    // FLF-185: bản 0.0 lưu bản render từ Spine; file người dùng upload tải riêng
    expect(within(items[3]).getByRole("button", { name: "Tải bản render (DRAFT)" })).toBeInTheDocument();
    expect(within(items[3]).getByRole("button", { name: "Tải file gốc" })).toBeInTheDocument();
    expect(within(items[1]).queryByRole("button", { name: "Tải file gốc" })).not.toBeInTheDocument();
  });

  it("tải file gốc của bản 0.0 ⇒ variant=original, tên mặc định _original", async () => {
    const seen = serveDownload();
    renderPanel({ versions: RELEASED });
    fireEvent.click(screen.getByRole("button", { name: "Tải file gốc" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));
    expect(seen).toEqual(["0.0?variant=original"]);
    expect(vi.mocked(saveBlob).mock.calls[0][1]).toBe("Lumen_v0.0_original.docx");
  });

  it("tải: gửi variant đúng; BE không gửi tên ⇒ tên mặc định (_DRAFT cho draft và bản tracked của release)", async () => {
    const seen = serveDownload();
    renderPanel({ versions: RELEASED });
    const items = screen.getAllByRole("listitem");

    fireEvent.click(within(items[0]).getByRole("button", { name: "Tải bản sạch" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(1));
    fireEvent.click(within(items[0]).getByRole("button", { name: "Bản có Track Changes" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(2));
    fireEvent.click(within(items[1]).getByRole("button", { name: "Tải bản draft (Track Changes)" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledTimes(3));

    expect(seen).toEqual(["1.0?variant=auto", "1.0?variant=tracked", "0.2?variant=auto"]);
    expect(vi.mocked(saveBlob).mock.calls.map((c) => c[1])).toEqual(["Lumen_v1.0.docx", "Lumen_v1.0_DRAFT.docx", "Lumen_v0.2_DRAFT.docx"]);
  });

  it("tải dùng tên BE trả nếu có; lỗi tải ⇒ hiện thông báo", async () => {
    serveDownload("SRS_v0.2_DRAFT.docx");
    renderPanel();
    fireEvent.click(screen.getAllByRole("button", { name: "Tải bản draft (Track Changes)" })[0]);
    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
    expect(vi.mocked(saveBlob).mock.calls[0][1]).toBe("SRS_v0.2_DRAFT.docx");

    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/versions/:v/download`, () =>
        HttpResponse.json({ data: null, error: { code: "DOC_VERSION_NOT_FOUND", message: "Không có version 0.0" } }, { status: 404 })
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Tải bản render (DRAFT)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không có version 0.0");
  });
});
