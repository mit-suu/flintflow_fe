import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { mockServer } from "@/mocks/server";
import { API_BASE_URL, ApiClientError } from "./client";
import { clearDocumentImageCache, fetchDocumentImage, IMAGE_CHANGED, parseImageRef } from "./document-images";

const TOKEN = "image-ref:diagram:D1@0123456789abcdef";

describe("parseImageRef", () => {
  it("đọc đủ kind, id, locale, hash", () => {
    expect(parseImageRef("image-ref:diagram:D1@0123456789abcdef")).toEqual({ kind: "diagram", id: "D1", hash: "0123456789abcdef" });
    expect(parseImageRef("image-ref:diagram:D1:vi@0123456789abcdef")).toEqual({ kind: "diagram", id: "D1", locale: "vi", hash: "0123456789abcdef" });
    expect(parseImageRef("image-ref:media:word%2Fmedia%2Fimage1.png@0123456789abcdef")?.id).toBe("word%2Fmedia%2Fimage1.png");
  });

  it("base64, dạng cũ hay hash sai ⇒ null", () => {
    expect(parseImageRef("iVBORw0KGgo=")).toBeNull();
    expect(parseImageRef("diagram-ref:D1")).toBeNull();
    expect(parseImageRef("image-ref:diagram:D1@xyz")).toBeNull();
    expect(parseImageRef("image-ref:other:D1@0123456789abcdef")).toBeNull();
  });
});

describe("fetchDocumentImage", () => {
  let hits: string[];
  beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
  afterAll(() => mockServer.close());
  beforeEach(() => {
    hits = [];
    clearDocumentImageCache();
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/document/image`, ({ request, params }) => {
        hits.push(`${params.projectId}|${new URL(request.url).searchParams.get("ref")}`);
        return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
      })
    );
  });
  afterEach(() => mockServer.resetHandlers());

  it("tải bytes thô thành Blob, gửi token đã mã hoá trong query", async () => {
    const blob = await fetchDocumentImage("p1", "image-ref:media:word%2Fmedia%2Fa.png@0123456789abcdef");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
    expect(hits).toEqual(["p1|image-ref:media:word%2Fmedia%2Fa.png@0123456789abcdef"]);
  });

  it("cùng khoá tải một lần (cả khi gọi đồng thời, cả khi gọi lại sau đó) và dùng lại đúng Blob", async () => {
    const [a, b] = await Promise.all([fetchDocumentImage("p1", TOKEN), fetchDocumentImage("p1", TOKEN)]);
    const c = await fetchDocumentImage("p1", TOKEN);
    expect(hits).toHaveLength(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("khác dự án hoặc khác hash ⇒ tải riêng; xoá cache (đăng xuất / đổi org) ⇒ tải lại", async () => {
    await fetchDocumentImage("p1", TOKEN);
    await fetchDocumentImage("p2", TOKEN);
    await fetchDocumentImage("p1", "image-ref:diagram:D1@fedcba9876543210");
    expect(hits).toHaveLength(3);
    clearDocumentImageCache();
    await fetchDocumentImage("p1", TOKEN);
    expect(hits).toHaveLength(4);
  });

  it("409 IMAGE_CHANGED ⇒ ném ApiClientError mang mã đó, không nhớ lỗi", async () => {
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/document/image`, () =>
        HttpResponse.json({ data: null, error: { code: "IMAGE_CHANGED", message: "đã vẽ lại" } }, { status: 409 })
      )
    );
    const err = await fetchDocumentImage("p1", TOKEN).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe(IMAGE_CHANGED);
    expect((err as ApiClientError).status).toBe(409);

    mockServer.resetHandlers();
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId/document/image`, () => new HttpResponse(new Uint8Array([9]), { headers: { "Content-Type": "image/png" } }))
    );
    expect((await fetchDocumentImage("p1", TOKEN)).size).toBe(1);
  });

  it("404 / body không phải JSON ⇒ vẫn ném ApiClientError", async () => {
    mockServer.use(http.get(`${API_BASE_URL}/projects/:projectId/document/image`, () => new HttpResponse("oops", { status: 500 })));
    const err = await fetchDocumentImage("p1", TOKEN).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(500);
  });
});
