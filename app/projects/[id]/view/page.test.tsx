"use client";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyChanges, getSpine } from "@/lib/api/spine";
import { assembleDocument } from "@/lib/api/export";
import { createComment, resolveComment } from "@/lib/api/comments";
import { mockTiming, resetMockChangeFlowState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import ReadOnlyDocumentPage from "./page";

const P = MOCK_PROJECT_ID;

const nav = vi.hoisted(() => ({ search: "" }));
const orgId = vi.hoisted(() => ({ value: null as string | null }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: P }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("@/lib/api/token-store", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveOrgId: () => orgId.value,
}));

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  resetMockState();
  resetMockChangeFlowState();
  nav.search = "";
  orgId.value = null;
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const version = async () => (await getSpine(P)).data!.spine_version;

describe("view/page.tsx — read-only projection (UC 1.14)", () => {
  it("có heading section, ẩn hoàn toàn flags/readiness/stale/by/reason của change", async () => {
    const base_version = await version();
    await applyChanges(P, {
      base_version,
      ops: [{ op: "add", path: "actors[]", value: { id: "A01", name: "Founder", kind: "human", description: "Chủ dự án" } }],
    });
    await assembleDocument(P, await version());

    renderWithIntl(<ReadOnlyDocumentPage />);

    expect(await screen.findByText(/1\. Product Overview/)).toBeInTheDocument();
    expect(await screen.findByText(/2\.1\. Actors/)).toBeInTheDocument();
    // "Chỉ đọc" (badge title) chứa chữ "đọc" nhưng KHÔNG phải nội dung nội bộ dưới đây:
    expect(screen.queryByText(/cờ đỏ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/accepted ·/)).not.toBeInTheDocument();
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
    expect(screen.queryByText(/chờ duyệt lại/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Danh sách cờ")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tóm tắt độ sẵn sàng")).not.toBeInTheDocument();
  });

  it("section bắt buộc chưa accepted (Use Case Descriptions, chưa có use_cases) hiện 'chưa hoàn thiện'", async () => {
    await assembleDocument(P, await version());

    renderWithIntl(<ReadOnlyDocumentPage />);

    expect(await screen.findByText(/2\.2\.2\. Use Case Descriptions/)).toBeInTheDocument();
    const section = screen.getByText(/2\.2\.2\. Use Case Descriptions/).closest("article");
    expect(section).not.toBeNull();
    expect(section!.textContent).toContain("chưa hoàn thiện");
  });

  it("section đã accepted (Product Overview) không hiện 'chưa hoàn thiện'", async () => {
    await assembleDocument(P, await version());

    renderWithIntl(<ReadOnlyDocumentPage />);

    const section = (await screen.findByText(/1\. Product Overview/)).closest("article");
    expect(section).not.toBeNull();
    expect(section!.textContent).not.toContain("chưa hoàn thiện");
  });

  it("đọc tài liệu hỏng thì hiện lỗi, không crash trang trắng", async () => {
    mockServer.use(http.get("*/projects/:projectId/document", () => HttpResponse.json({ data: null, error: { code: "INTERNAL", message: "Lỗi máy chủ" } }, { status: 500 })));

    renderWithIntl(<ReadOnlyDocumentPage />);

    expect(await screen.findByText(/Không tải được tài liệu/)).toBeInTheDocument();
  });
});

describe("view/page.tsx — comment ghim vào nội dung (UC-49)", () => {
  it("bấm 💬 ở một mục ⇒ soạn comment ghim vào mục đó trên bản nháp ⇒ đăng xong hiện trong panel + số comment cạnh mục", async () => {
    renderWithIntl(<ReadOnlyDocumentPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Comment mục §1 Product Overview" }));
    const composer = screen.getByLabelText("Comment mới");
    expect(composer.textContent).toContain("Ghim vào: §1 Product Overview · bản nháp");

    fireEvent.click(within(composer).getByRole("button", { name: "Đăng comment" }));
    expect(await within(composer).findByRole("alert")).toHaveTextContent("Comment không được để trống.");

    fireEvent.change(within(composer).getByLabelText("Viết comment"), { target: { value: "Tầm nhìn còn chung chung" } });
    fireEvent.click(within(composer).getByRole("button", { name: "Đăng comment" }));

    const card = await screen.findByRole("listitem", { name: "Comment CM-001" });
    expect(card.textContent).toContain("Tầm nhìn còn chung chung");
    expect(card.textContent).toContain("Ghim vào: 1 Product Overview");
    expect(screen.queryByLabelText("Comment mới")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem 1 comment" })).toBeInTheDocument();
  });

  it("ghim vào một đoạn ⇒ nhãn `› Block n`; trả lời hiện dưới comment", async () => {
    renderWithIntl(<ReadOnlyDocumentPage />);

    const blockButtons = await screen.findAllByRole("button", { name: /^Comment đoạn 1 của §1 Product Overview$/ });
    fireEvent.click(blockButtons[0]);
    const composer = screen.getByLabelText("Comment mới");
    fireEvent.change(within(composer).getByLabelText("Viết comment"), { target: { value: "Đoạn này cần số liệu" } });
    fireEvent.click(within(composer).getByRole("button", { name: "Đăng comment" }));

    const card = await screen.findByRole("listitem", { name: "Comment CM-001" });
    expect(card.textContent).toContain("› Block 1");

    fireEvent.click(within(card).getByRole("button", { name: "Trả lời" }));
    fireEvent.change(within(card).getByLabelText("Trả lời comment"), { target: { value: "Đã ghi nhận" } });
    fireEvent.click(within(card).getByRole("button", { name: "Trả lời" }));
    // Chờ danh sách trả lời — đừng tìm theo chữ: ô nhập trả lời (textarea) cũng mang đúng chữ đó cho tới khi đóng
    const replies = await within(screen.getByRole("listitem", { name: "Comment CM-001" })).findByRole("list", { name: "Trả lời" });
    expect(within(replies).getByText("Đã ghi nhận")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Trả lời comment")).not.toBeInTheDocument());
  });

  it("Viewer, dự án chưa có baseline ⇒ không có nút 💬, panel nói chỉ comment trên bản đã phát hành", async () => {
    orgId.value = "org-1";
    mockServer.use(http.get("*/orgs/org-1", () => HttpResponse.json({ data: { _id: "org-1", name: "Org", role: "viewer" }, error: null })));

    renderWithIntl(<ReadOnlyDocumentPage />);

    expect(await screen.findByText(/Viewer chỉ comment được trên phiên bản đã phát hành — dự án chưa có bản nào/)).toBeInTheDocument();
    expect(await screen.findByText(/1\. Product Overview/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Comment mục/ })).not.toBeInTheDocument();
  });
  it("Lead đánh dấu đã xử lý ⇒ comment rời tab Đang mở sang tab Đã đóng, số đếm cập nhật", async () => {
    orgId.value = "org-1";
    mockServer.use(http.get("*/orgs/org-1", () => HttpResponse.json({ data: { _id: "org-1", name: "Org", role: "lead" }, error: null })));
    await assembleDocument(P, await version());
    await createComment(P, { version: { source: "draft" }, anchor: { section_id: "fixed:1", block_index: null }, text: "Tầm nhìn còn chung chung" });

    renderWithIntl(<ReadOnlyDocumentPage />);

    const card = await screen.findByRole("listitem", { name: "Comment CM-001" });
    fireEvent.click(within(card).getByRole("button", { name: "Đánh dấu đã xử lý" }));
    expect(await screen.findByRole("tab", { name: "Đang mở (0)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("listitem", { name: "Comment CM-001" })).not.toBeInTheDocument();
    expect(screen.getByText("Không có comment nào đang mở.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Đã đóng (1)" }));
    expect(within(await screen.findByRole("listitem", { name: "Comment CM-001" })).getByText("Đã xử lý")).toBeInTheDocument();
  });

  it("người khác xử lý comment ⇒ quay lại tab thì panel tự cập nhật, không cần F5", async () => {
    await assembleDocument(P, await version());
    await createComment(P, { version: { source: "draft" }, anchor: { section_id: "fixed:1", block_index: null }, text: "Tầm nhìn còn chung chung" });

    renderWithIntl(<ReadOnlyDocumentPage />);
    expect(await screen.findByRole("listitem", { name: "Comment CM-001" })).toBeInTheDocument();

    await resolveComment(P, "CM-001");
    fireEvent(window, new Event("focus"));

    expect(await screen.findByRole("tab", { name: "Đã đóng (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: "Comment CM-001" })).not.toBeInTheDocument();
  });

  it("lượt tải comment cũ về muộn không đè dữ liệu của lượt mới hơn", async () => {
    await assembleDocument(P, await version());
    await createComment(P, { version: { source: "draft" }, anchor: { section_id: "fixed:1", block_index: null }, text: "Tầm nhìn còn chung chung" });
    let calls = 0;
    // Lượt đầu (lúc mở trang) chậm và trả dữ liệu cũ; lượt sau (quay lại tab) rơi xuống handler mock, có CM-001
    mockServer.use(
      http.get("*/projects/:projectId/comments", async () => {
        calls += 1;
        if (calls === 1) {
          await delay(300);
          return HttpResponse.json({ data: [], error: null });
        }
        return undefined;
      })
    );

    renderWithIntl(<ReadOnlyDocumentPage />);
    fireEvent(window, new Event("focus"));
    expect(await screen.findByRole("listitem", { name: "Comment CM-001" })).toBeInTheDocument();

    await new Promise((r) => setTimeout(r, 400));
    expect(screen.getByRole("listitem", { name: "Comment CM-001" })).toBeInTheDocument();
  });

  it("link thông báo ?comment= tới comment đã đóng ⇒ tự mở tab Đã đóng", async () => {
    await assembleDocument(P, await version());
    await createComment(P, { version: { source: "draft" }, anchor: { section_id: "fixed:1", block_index: null }, text: "Tầm nhìn còn chung chung" });
    await resolveComment(P, "CM-001");
    nav.search = "comment=CM-001";

    renderWithIntl(<ReadOnlyDocumentPage />);

    expect(await screen.findByRole("listitem", { name: "Comment CM-001" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Đã đóng (1)" })).toHaveAttribute("aria-selected", "true");
  });
});
