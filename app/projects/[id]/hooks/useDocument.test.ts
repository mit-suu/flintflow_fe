import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyChanges } from "@/lib/api/spine";
import { getSpine } from "@/lib/api/spine";
import { MOCK_TRANSLATION_UNITS, mockTiming, resetMockChangeFlowState, resetMockTranslationState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, mockState, resetMockState } from "@/mocks/state";
import type { RenderedDocument } from "@/types/document";
import type { DocumentLanguage } from "@/types/project";
import { useDocument } from "./useDocument";

const P = MOCK_PROJECT_ID;

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  resetMockState();
  resetMockChangeFlowState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const version = async () => (await getSpine(P)).data!.spine_version;

describe("useDocument", () => {
  it("lượt đọc đầu đã có tài liệu — BE dựng bản còn thiếu, FE không phải xin ghép", async () => {
    const { result } = renderHook(() => useDocument(P, "draft"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.empty).toBe(false);
    expect(result.current.document?.sections.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it("dự án chưa có nội dung ⇒ empty = true, không phải lỗi", async () => {
    mockServer.use(
      http.get("*/projects/:projectId/document", () =>
        HttpResponse.json({ data: null, meta: { state: "not_assembled" } }, { status: 200 })
      )
    );

    const { result } = renderHook(() => useDocument(P, "draft"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.empty).toBe(true);
    expect(result.current.document).toBeNull();
    expect(result.current.error).toBeNull();
  });

  /**
   * Lý do có `refreshing` tách khỏi `loading`: tải lại mà gỡ tài liệu xuống thì người đang đọc giữa trang
   * bị ném về đầu sau mỗi lệnh sửa (DocumentPane chỉ render danh sách mục khi `document` còn đó).
   */
  it("reload() không gỡ tài liệu đang đọc xuống ở bất kỳ lượt render nào", async () => {
    const renders: { loading: boolean; hasDocument: boolean }[] = [];
    const { result } = renderHook(() => {
      const state = useDocument(P, "draft");
      renders.push({ loading: state.loading, hasDocument: state.document !== null });
      return state;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    renders.length = 0; // bỏ các lượt render của lần tải đầu — ở đó tài liệu chưa có là đúng
    await act(() => result.current.reload());

    expect(renders.length).toBeGreaterThan(0);
    expect(renders.every((r) => !r.loading && r.hasDocument)).toBe(true);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.document?.sections.length).toBeGreaterThan(0);
  });

  it("refreshToken tăng ⇒ tải lại tự động và thấy nội dung mới (không cần gọi reload tay)", async () => {
    const { result, rerender } = renderHook(({ token }) => useDocument(P, "draft", undefined, token), {
      initialProps: { token: 0 },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.document?.version;

    await applyChanges(P, { base_version: await version(), ops: [{ op: "set", path: "project.domain", value: "Fintech" }] });
    rerender({ token: 1 });

    await waitFor(() => expect(result.current.document?.version).not.toBe(before));
    expect(result.current.empty).toBe(false);
  });
});

describe("useDocument — ngôn ngữ tài liệu (FLF-265)", () => {
  beforeEach(() => resetMockTranslationState());

  it("dự án vi ⇒ `translation` là `meta.translation` của BE; dự án en (ngôn ngữ gốc) ⇒ null", async () => {
    mockState.project.documentLanguage = "vi";
    const vietnamese = renderHook(() => useDocument(P, "draft", undefined, 0, "vi"));
    await waitFor(() => expect(vietnamese.result.current.loading).toBe(false));
    expect(vietnamese.result.current.translation).toEqual({ locale: "vi", source_locale: "en", missing: MOCK_TRANSLATION_UNITS });
    vietnamese.unmount();

    mockState.project.documentLanguage = "en";
    const english = renderHook(() => useDocument(P, "draft", undefined, 0, "en"));
    await waitFor(() => expect(english.result.current.loading).toBe(false));
    expect(english.result.current.document).not.toBeNull();
    expect(english.result.current.translation).toBeNull();
  });

  /**
   * Đổi ngôn ngữ là đổi hẳn tài liệu (BE dựng theo ngôn ngữ dự án): giữ bản cũ trên màn trong lúc chờ thì chữ ngôn ngữ cũ
   * nháy lên dưới chip ngôn ngữ mới.
   */
  it("đổi ngôn ngữ ⇒ gỡ tài liệu cũ xuống ngay, không nháy bản ngôn ngữ cũ, rồi hiện bản mới", async () => {
    const { result, rerender } = renderHook(({ language }) => useDocument(P, "draft", undefined, 0, language), {
      initialProps: { language: "en" as DocumentLanguage },
    });
    await waitFor(() => expect(result.current.document).not.toBeNull());
    const english = result.current.document as RenderedDocument;
    expect(result.current.translation).toBeNull();

    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    mockServer.use(
      http.get("*/projects/:projectId/document", async () => {
        await held;
        return HttpResponse.json({
          data: { ...english, version: "v0.vi" },
          meta: { assembled_at_version: 1, spine_version: 1, stale: false, translation: { locale: "vi", source_locale: "en", missing: 7 } },
          error: null,
        });
      })
    );

    rerender({ language: "vi" });
    await waitFor(() => expect(result.current.document).toBeNull());
    expect(result.current.loading).toBe(true);
    expect(result.current.translation).toBeNull();

    release();
    await waitFor(() => expect(result.current.document?.version).toBe("v0.vi"));
    expect(result.current.translation).toEqual({ locale: "vi", source_locale: "en", missing: 7 });
  });
});
