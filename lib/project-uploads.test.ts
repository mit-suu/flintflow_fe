import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { uploadProjectDocument } from "@/lib/api/documents";
import { chooseProjectUploadVersion, clearProjectUploads, dismissProjectUpload, startProjectUploads } from "./project-uploads";

vi.mock("@/lib/api/documents", () => ({ uploadProjectDocument: vi.fn() }));
vi.mock("@/lib/api/import", () => ({ uploadImport: vi.fn() }));
vi.mock("@/lib/api/org-library", () => ({ importFromOrgTemplate: vi.fn() }));

const PROJECT = "p-398";
const store = () => (globalThis as { __ffProjectUploads?: { state: Map<string, { items: { name: string; status: string; note?: string; key: string }[] }> } }).__ffProjectUploads!;
const items = () => store().state.get(PROJECT)?.items ?? [];
const statusOf = (name: string) => items().find((i) => i.name === name)?.status;
const flush = () => new Promise((r) => setTimeout(r, 0));

const CANDIDATE = { id: "d1", name: "SRS_v1.docx", doc_code: 1, reason: "same_name", similarity: 0.5 };

beforeEach(() => {
  clearProjectUploads(PROJECT);
  vi.mocked(uploadProjectDocument).mockReset();
});

describe("project-uploads — tài liệu tham khảo (FLF-398)", () => {
  it("tải lần lượt; file trùng ⇒ skipped kèm câu báo; Đóng ⇒ ẩn dòng", async () => {
    const order: string[] = [];
    vi.mocked(uploadProjectDocument).mockImplementation(async (_p, file) => {
      order.push(`start:${file.name}`);
      await flush();
      order.push(`end:${file.name}`);
      if (file.name === "b.txt") throw new ApiClientError(409, "DUPLICATE_DOCUMENT", "x", { document: { id: "d1", name: "a.txt", doc_code: 1 } });
      return { data: { _id: "d" } } as never;
    });
    startProjectUploads(PROJECT, { references: [new File(["a"], "a.txt"), new File(["a"], "b.txt")] });
    await vi.waitFor(() => expect(statusOf("b.txt")).toBe("skipped"));

    expect(order).toEqual(["start:a.txt", "end:a.txt", "start:b.txt", "end:b.txt"]);
    expect(statusOf("a.txt")).toBe("done");
    expect(items().find((i) => i.name === "b.txt")?.note).toContain('"a.txt" (D1)');

    dismissProjectUpload(PROJECT, items().find((i) => i.name === "b.txt")!.key);
    expect(items().map((i) => i.name)).toEqual(["a.txt"]);
  });

  it("có vẻ là bản mới ⇒ choosing chờ người dùng; Thay bản cũ ⇒ tải lại kèm replaceDocumentId; Bỏ qua ⇒ skipped", async () => {
    vi.mocked(uploadProjectDocument).mockImplementation(async (_p, _file, choice) => {
      if (!choice) throw new ApiClientError(409, "POSSIBLE_NEW_VERSION", "x", { candidates: [CANDIDATE] });
      return { data: { _id: "d2" } } as never;
    });
    startProjectUploads(PROJECT, { references: [new File(["2"], "SRS_v2.docx"), new File(["3"], "SRS_v3.docx")] });
    await vi.waitFor(() => expect(statusOf("SRS_v2.docx")).toBe("choosing"));
    // file sau chờ file trước xong
    expect(statusOf("SRS_v3.docx")).toBe("uploading");
    expect(uploadProjectDocument).toHaveBeenCalledTimes(1);

    chooseProjectUploadVersion(PROJECT, items()[0].key, { replaceDocumentId: "d1" });
    await vi.waitFor(() => expect(statusOf("SRS_v2.docx")).toBe("done"));
    expect(uploadProjectDocument).toHaveBeenCalledWith(PROJECT, expect.any(File), { replaceDocumentId: "d1" });

    await vi.waitFor(() => expect(statusOf("SRS_v3.docx")).toBe("choosing"));
    chooseProjectUploadVersion(PROJECT, items()[1].key, null);
    await vi.waitFor(() => expect(statusOf("SRS_v3.docx")).toBe("skipped"));
    expect(items()[1].note).toBeUndefined();
  });
});
