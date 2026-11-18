import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { uploadProjectDocument } from "@/lib/api/documents";
import { uploadReferenceDocument, versionCandidatesOf } from "./reference-upload";
import type { DocumentVersionCandidate } from "@/types/document";

vi.mock("@/lib/api/documents", () => ({ uploadProjectDocument: vi.fn() }));

const file = new File(["v2"], "SRS_KhachHang_v2.docx");
const CANDIDATE: DocumentVersionCandidate = { id: "d1", name: "SRS_KhachHang_v1.docx", doc_code: 1, reason: "same_name", similarity: 0.4 };
const possible = () => new ApiClientError(409, "POSSIBLE_NEW_VERSION", "Có vẻ đây là bản mới", { candidates: [CANDIDATE] });
const duplicate = () =>
  new ApiClientError(409, "DUPLICATE_DOCUMENT", "Tài liệu này đã có", { document: { id: "d1", name: "SRS_KhachHang_v1.docx", doc_code: 1 } });

beforeEach(() => vi.mocked(uploadProjectDocument).mockReset());

describe("FLF-398 - uploadReferenceDocument", () => {
  it("tải được ngay ⇒ uploaded, không hỏi", async () => {
    vi.mocked(uploadProjectDocument).mockResolvedValueOnce({ data: { _id: "d2" } } as never);
    const choose = vi.fn();
    expect(await uploadReferenceDocument("p1", file, choose)).toEqual({ kind: "uploaded", document: { _id: "d2" } });
    expect(choose).not.toHaveBeenCalled();
  });

  it("trùng hệt ⇒ duplicate kèm câu báo nêu tên tài liệu đã có, không hỏi", async () => {
    vi.mocked(uploadProjectDocument).mockRejectedValueOnce(duplicate());
    const result = await uploadReferenceDocument("p1", file, vi.fn());
    expect(result).toMatchObject({ kind: "duplicate" });
    expect(result.kind === "duplicate" && result.message).toContain("SRS_KhachHang_v1.docx");
  });

  it("có thể là bản mới ⇒ hỏi; Thay bản cũ ⇒ tải lại kèm replaceDocumentId", async () => {
    vi.mocked(uploadProjectDocument).mockRejectedValueOnce(possible()).mockResolvedValueOnce({ data: { _id: "d2" } } as never);
    const choose = vi.fn(async () => ({ replaceDocumentId: "d1" }));
    expect(await uploadReferenceDocument("p1", file, choose)).toMatchObject({ kind: "uploaded" });
    expect(choose).toHaveBeenCalledWith(file, [CANDIDATE]);
    expect(uploadProjectDocument).toHaveBeenLastCalledWith("p1", file, { replaceDocumentId: "d1" });
  });

  it("Bỏ qua ⇒ skipped, không tải lại", async () => {
    vi.mocked(uploadProjectDocument).mockRejectedValueOnce(possible());
    expect(await uploadReferenceDocument("p1", file, async () => null)).toEqual({ kind: "skipped" });
    expect(uploadProjectDocument).toHaveBeenCalledTimes(1);
  });

  it("lỗi khác ⇒ ném tiếp", async () => {
    vi.mocked(uploadProjectDocument).mockRejectedValueOnce(new ApiClientError(400, "UNSUPPORTED_FILE_TYPE", "Chỉ hỗ trợ"));
    await expect(uploadReferenceDocument("p1", file, vi.fn())).rejects.toMatchObject({ code: "UNSUPPORTED_FILE_TYPE" });
  });

  it("versionCandidatesOf chỉ nhận POSSIBLE_NEW_VERSION có ứng viên", () => {
    expect(versionCandidatesOf(possible())).toEqual([CANDIDATE]);
    expect(versionCandidatesOf(duplicate())).toBeNull();
    expect(versionCandidatesOf(new Error("x"))).toBeNull();
  });
});
