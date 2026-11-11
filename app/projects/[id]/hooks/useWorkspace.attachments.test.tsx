/**
 * FLF-398 — tài liệu đính kèm của chat: file trùng hệt tài liệu đã có không tải (báo ở toast, không tính là lỗi); file có vẻ là
 * bản mới ⇒ hỏi qua `chooseDocumentVersion`, tải lại kèm lựa chọn. `/documents` mock ở tầng API (jsdom + msw làm mất File trong
 * FormData); phần còn lại của workspace đi qua msw như `useWorkspace.test.tsx`.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ChangeEvent } from "react";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import { ApiClientError } from "@/lib/api/client";
import { uploadProjectDocument } from "@/lib/api/documents";
import { useWorkspace } from "./useWorkspace";

vi.mock("@/lib/auth", async (importOriginal) => ({ ...(await importOriginal<object>()), isAuthenticated: () => true }));
vi.mock("@/lib/api/token-store", async (importOriginal) => ({ ...(await importOriginal<object>()), getActiveOrgId: () => null }));
vi.mock("@/lib/api/documents", async (importOriginal) => ({ ...(await importOriginal<object>()), uploadProjectDocument: vi.fn() }));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
beforeEach(() => {
  resetMockState();
  vi.mocked(uploadProjectDocument).mockReset();
});

const V1 = { id: "d1", name: "SRS_KhachHang_v1.docx", doc_code: 1 };
const pick = (files: File[]) => ({ target: { files, value: "" } }) as unknown as ChangeEvent<HTMLInputElement>;

describe("useWorkspace — đính kèm trùng / bản mới (FLF-398)", () => {
  it("trùng hệt ⇒ báo tên tài liệu đã có, không lỗi; bản mới ⇒ hỏi rồi tải lại kèm replaceDocumentId", async () => {
    vi.mocked(uploadProjectDocument).mockImplementation(async (_p, file, choice) => {
      if (file.name === "copy.docx") throw new ApiClientError(409, "DUPLICATE_DOCUMENT", "dup", { document: V1 });
      if (!choice) throw new ApiClientError(409, "POSSIBLE_NEW_VERSION", "maybe", { candidates: [{ ...V1, reason: "same_name", similarity: 0.5 }] });
      return { data: { _id: "d2", precheck: null } } as never;
    });
    const chooseDocumentVersion = vi.fn(async () => ({ replaceDocumentId: "d1" }));
    const { result } = renderHook(() => useWorkspace(MOCK_PROJECT_ID, { chooseDocumentVersion }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    const files = [new File(["copy"], "copy.docx"), new File(["v2"], "SRS_KhachHang_v2.docx")];
    act(() => result.current.selectAttachment(pick(files)));
    let ok = false;
    await act(async () => {
      ok = await result.current.uploadPendingAttachments();
    });

    expect(ok).toBe(true);
    expect(chooseDocumentVersion).toHaveBeenCalledWith(files[1], [expect.objectContaining({ id: "d1", reason: "same_name" })]);
    expect(vi.mocked(uploadProjectDocument).mock.calls.map(([, f, c]) => [f.name, c ?? null])).toEqual([
      ["copy.docx", null],
      ["SRS_KhachHang_v2.docx", null],
      ["SRS_KhachHang_v2.docx", { replaceDocumentId: "d1" }],
    ]);
    expect(result.current.pendingAttachments).toEqual([]);
    expect(result.current.notice).toEqual({ text: expect.stringContaining('"SRS_KhachHang_v1.docx" (D1)') });
  });

  it("không truyền chooseDocumentVersion ⇒ giữ cả hai (như trước FLF-398)", async () => {
    vi.mocked(uploadProjectDocument).mockImplementation(async (_p, _file, choice) => {
      if (!choice) throw new ApiClientError(409, "POSSIBLE_NEW_VERSION", "maybe", { candidates: [{ ...V1, reason: "same_name", similarity: 0.5 }] });
      return { data: { _id: "d2", precheck: null } } as never;
    });
    const { result } = renderHook(() => useWorkspace(MOCK_PROJECT_ID));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.selectAttachment(pick([new File(["v2"], "SRS_KhachHang_v2.docx")])));
    await act(async () => {
      await result.current.uploadPendingAttachments();
    });
    expect(uploadProjectDocument).toHaveBeenLastCalledWith(MOCK_PROJECT_ID, expect.any(File), { keepBoth: true });
  });

  it("lỗi khác ⇒ false, giữ tệp để thử lại", async () => {
    vi.mocked(uploadProjectDocument).mockRejectedValue(new ApiClientError(400, "UNSUPPORTED_FILE_TYPE", "Chỉ hỗ trợ"));
    const { result } = renderHook(() => useWorkspace(MOCK_PROJECT_ID));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.selectAttachment(pick([new File(["x"], "x.exe")])));
    let ok = true;
    await act(async () => {
      ok = await result.current.uploadPendingAttachments();
    });
    expect(ok).toBe(false);
    expect(result.current.pendingAttachments).toHaveLength(1);
  });
});
