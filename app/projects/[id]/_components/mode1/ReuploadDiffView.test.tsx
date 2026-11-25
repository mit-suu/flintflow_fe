import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import type { ReuploadDiff } from "@/types/import";
import { readChatCrDraft } from "./prefill";
import ReuploadDiffView, { reuploadPrefill } from "./ReuploadDiffView";
import { labelsFor } from "./test-labels";

const P = MODE1_PROJECT_ID;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const pick = (name: string, size?: number) => {
  const file = new File(["PK"], name);
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  fireEvent.change(screen.getByTestId("docx-input"), { target: { files: [file] } });
};

/** Tên file không đi qua FormData trong jsdom (msw thấy "blob") ⇒ không dựa vào quy ước tên file của mock. */
const rejectForeignOnce = () => {
  let rejected = false;
  mockServer.use(
    http.post(`${API_BASE_URL}/projects/:projectId/reupload`, () => {
      if (rejected) return undefined;
      rejected = true;
      return HttpResponse.json(
        { data: null, error: { code: "IMPORT_STAMP_FOREIGN_PROJECT", message: "File này thuộc project khác" }, meta: { stamp: { project_id: "650000000000000000000099" } } },
        { status: 422 }
      );
    })
  );
};

const DIFF: ReuploadDiff = {
  id: "66f00000000000000000r001",
  original_name: "SRS_sua.docx",
  against_version: "0.2",
  created_at: "2026-09-19T00:00:00.000Z",
  summary: { added: 1, removed: 1, modified: 1, moved: 1 },
  blocks: [
    { block_id: null, change: "added", after: "NFR-P03: 500 learners." },
    { block_id: "B0012", change: "removed", before: "[SmartArt]" },
    { block_id: "B0010", change: "modified", before: "quickly", after: "within 2 seconds" },
    { block_id: "B0003", change: "moved" },
  ],
};

describe("ReuploadDiffView - tải lại bản sửa ngoài FlintFlow (UC-24, 1.4)", () => {
  it("file project khác (422 IMPORT_STAMP_FOREIGN_PROJECT) ⇒ báo lỗi thân thiện, không có diff", async () => {
    await importToGapReview();
    rejectForeignOnce();
    renderWithIntl(<ReuploadDiffView projectId={P} />);
    pick("SRS_other-project.docx");
    expect(await screen.findByRole("alert")).toHaveTextContent("File này được xuất từ một dự án khác - không nhập vào dự án này được.");
    expect(screen.queryByRole("link", { name: "Tạo CR từ khác biệt" })).not.toBeInTheDocument();
    expect(mode1State.mode1State.reuploads).toHaveLength(0);
  });

  it("lỗi rồi tải lại thành công ⇒ xoá lỗi, hiện diff (không tạo version)", async () => {
    await importToGapReview();
    rejectForeignOnce();
    renderWithIntl(<ReuploadDiffView projectId={P} />);
    pick("SRS_other-project.docx");
    await screen.findByRole("alert");

    pick("SRS_sua.docx");
    expect(await screen.findByText(/1 thêm · 0 xoá · 1 sửa · 0 di chuyển/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mode1State.mode1State.versions.map((v) => v.version)).toEqual(["0.1"]);
  });

  it("chưa có baseline ⇒ hiện lỗi BE (IMPORT_INVALID_STATE)", async () => {
    renderWithIntl(<ReuploadDiffView projectId={P} />);
    pick("SRS_sua.docx");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Chưa có baseline/);
  });

  it("file quá 40 MB ⇒ chặn ở FE, không gọi API", async () => {
    let called = false;
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/reupload`, () => {
        called = true;
        return HttpResponse.json({ data: DIFF, error: null });
      })
    );
    renderWithIntl(<ReuploadDiffView projectId={P} />);
    expect(screen.getByRole("button", { name: "Tải lên bản đã sửa ngoài FlintFlow" })).toBeInTheDocument();
    pick("to.docx", 41 * 1024 * 1024);
    expect(screen.getByText(/lớn hơn giới hạn 40 MB/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(called).toBe(false);
  });

  it("không có khác biệt ⇒ không có nút tạo CR", async () => {
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/reupload`, () =>
        HttpResponse.json({ data: { ...DIFF, summary: { added: 0, removed: 0, modified: 0, moved: 0 }, blocks: [] }, error: null })
      )
    );
    renderWithIntl(<ReuploadDiffView projectId={P} />);
    pick("SRS_giong.docx");
    expect(await screen.findByText("Không có khác biệt.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo CR từ khác biệt" })).not.toBeInTheDocument();
  });

  it("có khác biệt ⇒ “Tạo CR từ khác biệt” điền sẵn nguồn reupload, tham chiếu id bản tải lại, mô tả theo từng block", async () => {
    let sent: FormDataEntryValue | null = null;
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/reupload`, async ({ request }) => {
        sent = (await request.formData()).get("file");
        return HttpResponse.json({ data: DIFF, error: null }, { status: 201 });
      })
    );
    renderWithIntl(<ReuploadDiffView projectId={P} />);
    pick("SRS_sua.docx");

    const link = await screen.findByRole("link", { name: "Tạo CR từ khác biệt" });
    // field `file` là file (Blob của realm undici, không so instanceof với jsdom được)
    await waitFor(() => expect(sent).not.toBeNull());
    expect(typeof sent).toBe("object");
    expect(screen.getByText("SRS_sua.docx")).toBeInTheDocument();
    expect(screen.getByText(/so với bản 0.2/)).toBeInTheDocument();
    const { title, description } = reuploadPrefill(DIFF, labelsFor());
    expect(readChatCrDraft(new URL(link.getAttribute("href")!, "http://x").searchParams)).toEqual({
      text: `${title}\n${description}`,
      source: "reupload",
      ref: "File tải lại SRS_sua.docx",
    });
  });
});

describe("reuploadPrefill", () => {
  it("theo mục và theo hàng: bảng thêm hàng thành một dòng, không dán nguyên bảng", () => {
    const { description } = reuploadPrefill(
      {
        ...DIFF,
        blocks: [
          {
            block_id: null,
            change: "modified",
            kind: "table",
            section: "I. Record of Changes",
            before: "x",
            after: "y",
            table: { header: ["Date", "Change"], rows: [{ change: "unchanged", count: 2, rows: [["a", "b"], ["c", "d"]] }, { change: "added", after: ["19/11", "Add 3.2.7"] }, { change: "added", after: ["19/11", "Fix 3.2.1"] }, { change: "modified", before: ["01/11", "Old"], after: ["01/11", "New"], cells_changed: [1] }] },
          },
          { block_id: null, change: "modified", kind: "paragraph", section: "3.2.1 Đăng nhập", before: "5 lần", after: "3 lần" },
        ],
      },
      labelsFor()
    );
    expect(description.split("\n").slice(1)).toEqual([
      "I. Record of Changes:",
      "- Thêm 2 hàng: 19/11 | Add 3.2.7; 19/11 | Fix 3.2.1",
      "- Sửa 1 hàng: \"01/11 | Old\" → \"01/11 | New\"",
      "3.2.1 Đăng nhập:",
      "- Sửa: \"5 lần\" → \"3 lần\"",
    ]);
    expect(description).not.toContain("a | b");
  });

  it("mỗi loại khác biệt một dòng", () => {
    const { title, description } = reuploadPrefill(DIFF, labelsFor());
    expect(title).toBe("Cập nhật theo file SRS_sua.docx");
    expect(description.split("\n")).toEqual([
      "Áp các thay đổi trong file tải lại SRS_sua.docx (so với bản 0.2):",
      "- Thêm: NFR-P03: 500 learners.",
      '- Xoá: "[SmartArt]"',
      '- Sửa: "quickly" → "within 2 seconds"',
      "- Di chuyển một đoạn",
    ]);
  });

  it("thiếu before/after ⇒ để trống, không in undefined", () => {
    const { description } = reuploadPrefill({
      ...DIFF,
      blocks: [
        { block_id: null, change: "added" },
        { block_id: "B0001", change: "removed" },
        { block_id: "B0002", change: "modified" },
      ],
    }, labelsFor());
    expect(description).not.toContain("undefined");
    expect(description).toContain('- Sửa: "" → ""');
    expect(description).not.toMatch(/B000\d/);
  });
});

describe("FLF-457 - upload lại trước baseline, file không dấu version, bản cũ, Track Changes người ngoài", () => {
  const respond = (data: ReuploadDiff) =>
    mockServer.use(http.post(`${API_BASE_URL}/projects/:projectId/reupload`, () => HttpResponse.json({ data, error: null }, { status: 201 })));

  it("trước baseline ⇒ so với nội dung đang soạn, không có nút tạo CR; chỉ những chỗ đã chọn thành lệnh sửa qua chat", async () => {
    respond({ ...DIFF, against_version: "DRAFT", before_baseline: true, blocks: DIFF.blocks.slice(0, 3), summary: { added: 1, removed: 1, modified: 1, moved: 0 } });
    const onApply = vi.fn();
    renderWithIntl(<ReuploadDiffView projectId={P} beforeBaseline onApplyViaChat={onApply} />);
    expect(screen.getByText(/So từng đoạn với nội dung đang soạn/)).toBeInTheDocument();
    pick("SRS_DRAFT.docx");
    expect(await screen.findByText(/so với nội dung đang soạn/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo CR từ khác biệt" })).not.toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Sửa qua chat (2)" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].split("\n")).toEqual([
      "Cập nhật nội dung đang soạn theo file SRS_sua.docx:",
      "- Thêm: NFR-P03: 500 learners.",
      '- Sửa: "quickly" → "within 2 seconds"',
    ]);
  });

  it("file không dấu version, heading khớp ít, bản cũ, Track Changes / comment ⇒ cảnh báo + mỗi chỗ một dòng; Lưu / Dùng làm tham khảo gửi đúng file", async () => {
    respond({
      ...DIFF,
      no_stamp: true,
      suggest_reference: true,
      heading_match: 0.2,
      stale: { file_version: "0.1", current_version: "0.2" },
      markup: [
        { kind: "track_change", author: "Lan", change: "text", text: "Customer note.", section: "1 Introduction", location: { block_ord: 3, text: "Lumen is a platform." } },
        { kind: "comment", author: "", text: "Please confirm.", section: "", location: null },
      ],
    });
    const onSave = vi.fn();
    renderWithIntl(<ReuploadDiffView projectId={P} onSaveAsReference={onSave} />);
    pick("SRS_khach.docx");
    expect(await screen.findByText("File không có thông tin phiên bản, đã so với bản nháp hiện tại")).toBeInTheDocument();
    expect(screen.getByText(/chỉ khớp 20% với tài liệu hiện tại/)).toBeInTheDocument();
    expect(screen.getByText(/File mang phiên bản 0.1, cũ hơn bản hiện tại 0.2/)).toBeInTheDocument();
    expect(screen.getByText("Track Changes và comment trong file (2)")).toBeInTheDocument();
    expect(screen.getByText('Track Changes của Lan: "Customer note."')).toBeInTheDocument();
    expect(screen.getByText("Tại đoạn: Lumen is a platform.")).toBeInTheDocument();
    expect(screen.getByText('Comment của không rõ: "Please confirm."')).toBeInTheDocument();
    // Sau baseline vẫn tạo CR được
    expect(screen.getByRole("link", { name: "Tạo CR từ khác biệt" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dùng làm tham khảo" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu làm tham khảo" }));
    expect(onSave).toHaveBeenCalledTimes(2);
    expect((onSave.mock.calls[0][0] as File).name).toBe("SRS_khach.docx");
  });

  it("không truyền onSaveAsReference ⇒ không có nút lưu làm tham khảo", async () => {
    respond(DIFF);
    renderWithIntl(<ReuploadDiffView projectId={P} />);
    pick("SRS_sua.docx");
    await screen.findByRole("link", { name: "Tạo CR từ khác biệt" });
    expect(screen.queryByRole("button", { name: "Lưu làm tham khảo" })).not.toBeInTheDocument();
  });

  it("reuploadPrefill kèm mỗi chỗ Track Changes / comment một dòng, theo mục", () => {
    const { description } = reuploadPrefill(
      { ...DIFF, blocks: [], markup: [{ kind: "comment", author: "Lan", text: "Check scope", section: "1 Introduction", location: null }] },
      labelsFor()
    );
    expect(description.split("\n").slice(1)).toEqual(["1 Introduction:", '- Comment của Lan: "Check scope"']);
  });
});
