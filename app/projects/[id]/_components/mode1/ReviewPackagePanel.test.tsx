import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import type { ReviewPackage } from "@/types/doc-version";
import ReviewPackagePanel from "./ReviewPackagePanel";

const P = "650000000000000000000002";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const pkg = (over: Partial<ReviewPackage> = {}): ReviewPackage => ({
  status: "drafting",
  base_version: "v0",
  latest_version: "0.3",
  next_version: "1.0",
  draft_label: "v0 · 2 thay đổi chưa duyệt",
  change_requests: [
    { cr_id: "CR-001", title: "Nhanh hơn", requester: "PM Lan", source: { kind: "verbal", ref: null }, result_doc_version: "0.2", written_at: "2026-10-26T01:00:00.000Z" },
    { cr_id: "CR-002", title: "Thêm bảng phân quyền", requester: "PM Lan", source: { kind: "meeting_minutes", ref: "BB 12/09" }, result_doc_version: "0.3", written_at: "2026-10-26T02:00:00.000Z" },
  ],
  red_open: 0,
  submission: null,
  spine_version: 7,
  ...over,
});

/** Mock riêng cho panel: trả gói theo `current`, ghi lại request gửi / yêu cầu sửa / phát hành. */
const serve = (initial: ReviewPackage) => {
  let current = initial;
  const calls: { path: string; body: unknown }[] = [];
  mockServer.use(
    http.get(`${API_BASE_URL}/projects/:projectId/spine`, () => HttpResponse.json({ data: { spine_version: current.spine_version }, error: null })),
    http.get(`${API_BASE_URL}/projects/:projectId/review-package`, () => HttpResponse.json({ data: current, error: null })),
    http.post(`${API_BASE_URL}/projects/:projectId/review-package/submit`, async ({ request }) => {
      calls.push({ path: "submit", body: await request.json() });
      if (current.red_open > 0) return HttpResponse.json({ data: null, error: { code: "RELEASE_RED_FLAGS_OPEN", message: "Còn 1 cờ đỏ" }, meta: { flags: [{ id: "FL1", message: "Sơ đồ ERD render lỗi" }] } }, { status: 422 });
      current = { ...current, status: "pending", submission: { status: "pending", submitted_by: "u1", submitted_at: "2026-10-26T03:00:00.000Z", spine_version: 7, decided_by: null, decided_at: null, reason: null, rejection_comment_ids: [] } };
      return HttpResponse.json({ data: current, error: null });
    }),
    http.post(`${API_BASE_URL}/projects/:projectId/review-package/request-changes`, async ({ request }) => {
      const body = (await request.json()) as { reason: string };
      calls.push({ path: "request-changes", body });
      current = { ...current, status: "changes_requested", submission: { ...current.submission!, status: "rejected", reason: body.reason } };
      return HttpResponse.json({ data: current, error: null });
    }),
    http.post(`${API_BASE_URL}/projects/:projectId/release`, async ({ request }) => {
      calls.push({ path: "release", body: await request.json() });
      current = { ...current, status: "drafting", base_version: "1.0", draft_label: "1.0", change_requests: [], submission: null };
      return HttpResponse.json({ data: { version: { version: "1.0" }, cr_ids: ["CR-001", "CR-002"], spine_version: 8 }, error: null });
    })
  );
  return calls;
};

describe("ReviewPackagePanel (FLF-330 — gói duyệt kiểu pull request)", () => {
  it("Analyst: thấy nhãn bản nháp + danh sách CR; Gửi Lead duyệt ⇒ pending, bản nháp khoá, không có nút của Lead", async () => {
    const calls = serve(pkg());
    const onChanged = vi.fn();
    renderWithIntl(<ReviewPackagePanel projectId={P} role="analyst" onChanged={onChanged} />);

    expect(await screen.findByText("v0 · 2 thay đổi chưa duyệt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CR-001" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CR-002" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duyệt cả gói & phát hành" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Phát hành thẳng (Lead)" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Gửi Lead duyệt cả gói" }));
    expect(await screen.findByText("Chờ Lead duyệt")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/bản nháp tạm khoá/);
    expect(calls).toEqual([{ path: "submit", body: { base_version: 7 } }]);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Gửi Lead duyệt cả gói" })).toBeNull();
  });

  it("còn cờ đỏ ⇒ nút gửi bị khoá kèm lý do; BE vẫn chặn ⇒ hiện cờ chặn", async () => {
    serve(pkg({ red_open: 1 }));
    renderWithIntl(<ReviewPackagePanel projectId={P} role="analyst" onChanged={vi.fn()} />);
    const send = await screen.findByRole("button", { name: "Gửi Lead duyệt cả gói" });
    expect(send).toBeDisabled();
    expect(screen.getByText(/Còn 1 cờ đỏ/)).toBeInTheDocument();
  });

  it("Lead khi gói chờ: Yêu cầu sửa cần lý do ≥ 10 ký tự ⇒ changes_requested kèm lý do; Duyệt cả gói ⇒ gọi release, gói về trống", async () => {
    const calls = serve(pkg({ status: "pending", submission: { status: "pending", submitted_by: "u1", submitted_at: "2026-10-26T03:00:00.000Z", spine_version: 7, decided_by: null, decided_at: null, reason: null, rejection_comment_ids: [] } }));
    const onChanged = vi.fn();
    renderWithIntl(<ReviewPackagePanel projectId={P} role="lead" onChanged={onChanged} />);

    fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu sửa" }));
    const reason = screen.getByLabelText(/Lý do yêu cầu sửa/);
    fireEvent.change(reason, { target: { value: "ngắn" } });
    expect(screen.getByRole("button", { name: "Gửi yêu cầu sửa" })).toBeDisabled();
    fireEvent.change(reason, { target: { value: "Giữ 1 giây là quá gắt, hãy đổi lại 2 giây" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu sửa" }));
    expect(await screen.findByText("Lead yêu cầu sửa")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Giữ 1 giây là quá gắt, hãy đổi lại 2 giây");
    expect(calls[0]).toEqual({ path: "request-changes", body: { base_version: 7, reason: "Giữ 1 giây là quá gắt, hãy đổi lại 2 giây" } });

    // gửi lại rồi Lead duyệt cả gói
    fireEvent.click(screen.getByRole("button", { name: "Gửi lại cho Lead" }));
    fireEvent.click(await screen.findByRole("button", { name: "Duyệt cả gói & phát hành" }));
    expect(screen.getByText(/Duyệt cả gói 2 thay đổi và phát hành bản 1.0/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    await waitFor(() => expect(calls.map((c) => c.path)).toEqual(["request-changes", "submit", "release"]));
    expect(await screen.findByText("1.0")).toBeInTheDocument();
    expect(screen.getByText(/Chưa có thay đổi nào ghi vào bản nháp/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(3);
  });

  it("Lead tự làm (không ai gửi) ⇒ Phát hành thẳng, không qua bước gửi", async () => {
    const calls = serve(pkg());
    renderWithIntl(<ReviewPackagePanel projectId={P} role="lead" onChanged={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Phát hành thẳng (Lead)" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    await waitFor(() => expect(calls.map((c) => c.path)).toEqual(["release"]));
  });

  it("Viewer chỉ xem nhãn bản nháp và danh sách, không có nút nào", async () => {
    serve(pkg());
    renderWithIntl(<ReviewPackagePanel projectId={P} role="viewer" onChanged={vi.fn()} />);
    expect(await screen.findByText("v0 · 2 thay đổi chưa duyệt")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
