/**
 * Panel "Kiểm & chốt" mode 1: cờ + gói thay đổi. Gap report / Change request ở header, version ở chip version của tài liệu.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import Mode1WorkspaceTools from "./Mode1WorkspaceTools";

const P = "650000000000000000000001";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "650000000000000000000001" }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const serveVersions = (versions: unknown[]) => {
  const calls = { n: 0 };
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/versions`, () => {
      calls.n += 1;
      return HttpResponse.json({ data: versions, error: null });
    }),
    http.get(`${API_BASE_URL}/projects/:projectId/flags`, () => HttpResponse.json({ data: [], error: null }))
  );
  return calls;
};

/** Gói thay đổi (FLF-330) đang soạn, một CR đã ghi — Lead phát hành thẳng được. */
const servePackage = () =>
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/review-package`, () =>
      HttpResponse.json({
        data: {
          status: "drafting",
          base_version: "v0",
          latest_version: "0.2",
          next_version: "1.0",
          draft_label: "v0 · 1 thay đổi chưa duyệt",
          change_requests: [{ cr_id: "CR-001", title: "Nhanh hơn", requester: "PM Lan", source: { kind: "verbal", ref: null }, result_doc_version: "0.2", written_at: "2026-10-26T01:00:00.000Z" }],
          red_open: 0,
          submission: null,
          spine_version: 7,
        },
        error: null,
      })
    )
  );

const renderTools = (over: Partial<Parameters<typeof Mode1WorkspaceTools>[0]> = {}) =>
  renderWithIntl(<Mode1WorkspaceTools projectId={P} flags={[]} onSpineChanged={vi.fn()} {...over} />);

describe("Mode1WorkspaceTools", () => {
  it("hiện cờ + gói thay đổi; không còn link Gap report / Change request trùng header, không còn bảng version", async () => {
    servePackage();
    renderTools();
    expect(screen.getByText("Cờ & change request")).toBeInTheDocument();
    expect(await screen.findByText("Gói thay đổi")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Gap report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Các version" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Release" })).not.toBeInTheDocument();
  });

  it("Lead phát hành từ gói thay đổi ⇒ báo Spine đổi (page tải lại tài liệu, version, pill)", async () => {
    servePackage();
    serveVersions([]);
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/spine`, () => HttpResponse.json({ data: { spine_version: 7 }, error: null })),
      http.post(`${API_BASE_URL}/projects/:projectId/release`, () => HttpResponse.json({ data: { version: { version: "1.0" }, cr_ids: ["CR-001"], spine_version: 8 }, error: null }, { status: 201 }))
    );
    const onSpineChanged = vi.fn();
    renderTools({ onSpineChanged, orgRole: "lead" });
    fireEvent.click(await screen.findByRole("button", { name: "Phát hành thẳng (Lead)" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    await waitFor(() => expect(onSpineChanged).toHaveBeenCalled());
  });

  it("không truyền trạng thái đổi mẫu ⇒ không có thẻ đổi mẫu", async () => {
    servePackage();
    renderTools({ orgRole: "lead" });
    await screen.findByText("Gói thay đổi");
    expect(screen.queryByRole("region", { name: "Đổi mẫu tài liệu" })).not.toBeInTheDocument();
  });
});
