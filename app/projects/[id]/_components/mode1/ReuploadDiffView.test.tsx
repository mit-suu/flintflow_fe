import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import type { ReuploadDiff } from "@/types/import";
import { readCrPrefill } from "./prefill";
import ReuploadDiffView, { reuploadPrefill } from "./ReuploadDiffView";

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
  against_version: "0.1",
  created_at: "2026-09-19T00:00:00.000Z",
  summary: { added: 1, removed: 1, modified: 1, moved: 1 },
  blocks: [
    { block_id: null, change: "added", after: "NFR-P03: 500 learners." },
    { block_id: "B0012", change: "removed", before: "[SmartArt]" },
    { block_id: "B0010", change: "modified", before: "quickly", after: "within 2 seconds" },
    { block_id: "B0003", change: "moved" },
  ],
};

describe("ReuploadDiffView — tải lại bản sửa ngoài FlintFlow (UC-24, 1.4)", () => {
  it("file project khác (422 IMPORT_STAMP_FOREIGN_PROJECT) ⇒ báo lỗi thân thiện, không có diff", async () => {
    await importToGapReview();
    rejectForeignOnce();
    render(<ReuploadDiffView projectId={P} />);
    pick("SRS_other-project.docx");
    expect(await screen.findByRole("alert")).toHaveTextContent("File này được xuất từ một dự án khác — không nhập vào dự án này được.");
    expect(screen.queryByRole("link", { name: "Tạo CR từ khác biệt" })).not.toBeInTheDocument();
    expect(mode1State.mode1State.reuploads).toHaveLength(0);
  });

  it("lỗi rồi tải lại thành công ⇒ xoá lỗi, hiện diff (không tạo version)", async () => {
    await importToGapReview();
    rejectForeignOnce();
    render(<ReuploadDiffView projectId={P} />);
    pick("SRS_other-project.docx");
    await screen.findByRole("alert");

    pick("SRS_sua.docx");
    expect(await screen.findByText(/1 thêm · 0 xoá · 1 sửa · 0 di chuyển/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mode1State.mode1State.versions.map((v) => v.version)).toEqual(["0.0"]);
  });

  it("chưa có baseline ⇒ hiện lỗi BE (IMPORT_INVALID_STATE)", async () => {
    render(<ReuploadDiffView projectId={P} />);
    pick("SRS_sua.docx");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Chưa có baseline/);
  });

  it("file quá 10MB ⇒ chặn ở FE, không gọi API", async () => {
    let called = false;
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/reupload`, () => {
        called = true;
        return HttpResponse.json({ data: DIFF, error: null });
      })
    );
    render(<ReuploadDiffView projectId={P} />);
    expect(screen.getByRole("button", { name: "Tải lên bản đã sửa ngoài FlintFlow" })).toBeInTheDocument();
    pick("to.docx", 11 * 1024 * 1024);
    expect(screen.getByText(/lớn hơn 10MB/)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(called).toBe(false);
  });

  it("không có khác biệt ⇒ không có nút tạo CR", async () => {
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/reupload`, () =>
        HttpResponse.json({ data: { ...DIFF, summary: { added: 0, removed: 0, modified: 0, moved: 0 }, blocks: [] }, error: null })
      )
    );
    render(<ReuploadDiffView projectId={P} />);
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
    render(<ReuploadDiffView projectId={P} />);
    pick("SRS_sua.docx");

    const link = await screen.findByRole("link", { name: "Tạo CR từ khác biệt" });
    // field `file` là file (Blob của realm undici, không so instanceof với jsdom được)
    await waitFor(() => expect(sent).not.toBeNull());
    expect(typeof sent).toBe("object");
    expect(screen.getByText("SRS_sua.docx")).toBeInTheDocument();
    expect(screen.getByText(/so với bản 0.1/)).toBeInTheDocument();
    expect(readCrPrefill(new URL(link.getAttribute("href")!, "http://x").searchParams)).toEqual({
      ...reuploadPrefill(DIFF),
      source: "reupload",
      ref: DIFF.id,
    });
  });
});

describe("reuploadPrefill", () => {
  it("mỗi loại khác biệt một dòng", () => {
    const { title, description } = reuploadPrefill(DIFF);
    expect(title).toBe("Cập nhật theo file SRS_sua.docx");
    expect(description.split("\n")).toEqual([
      "Áp các thay đổi trong file tải lại SRS_sua.docx (so với bản 0.1):",
      "- Thêm: NFR-P03: 500 learners.",
      "- Xoá B0012: [SmartArt]",
      '- Sửa B0010: "quickly" → "within 2 seconds"',
      "- Di chuyển B0003",
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
    });
    expect(description).not.toContain("undefined");
    expect(description).toContain('- Sửa B0002: "" → ""');
  });
});
