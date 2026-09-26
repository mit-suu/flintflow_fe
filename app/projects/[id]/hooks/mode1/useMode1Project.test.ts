/**
 * `useMode1Project` — project + số credit cho khung trang mode 1 (V6: trước đây 0% coverage).
 * Điểm đáng kiểm: hai lời gọi độc lập nhau, credit hỏng KHÔNG được kéo cả trang xuống, và `reload` lấy lại
 * `import_state` mới (khung trang mở khoá tab theo field này).
 */
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { useMode1Project } from "./useMode1Project";

const P = "650000000000000000000001";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const project = (import_state: string | null) => ({ _id: P, name: "Lumen", mode: "import", import_state });

type Envelope = { data: unknown; error: { code: string; message: string } | null };

const serveProject = (body: Envelope, status = 200) =>
  mockServer.use(http.get(`${API_BASE_URL}/projects/:projectId`, () => HttpResponse.json(body, { status })));

const serveBalance = (body: Envelope, status = 200) =>
  mockServer.use(http.get(`${API_BASE_URL}/billing/balance`, () => HttpResponse.json(body, { status })));

describe("useMode1Project", () => {
  it("tải project + credit khả dụng", async () => {
    serveProject({ data: project("finalized"), error: null });
    serveBalance({ data: { balance: 500, available: 420 }, error: null });

    const { result } = renderHook(() => useMode1Project(P));
    await waitFor(() => expect(result.current.project?.name).toBe("Lumen"));
    expect(result.current.credits, "ưu tiên `available` vì phần reserved không tiêu được").toBe(420);
    expect(result.current.error).toBeNull();
  });

  it("ví không có `available` ⇒ lùi về `balance`", async () => {
    serveProject({ data: project("finalized"), error: null });
    serveBalance({ data: { balance: 77 }, error: null });

    const { result } = renderHook(() => useMode1Project(P));
    await waitFor(() => expect(result.current.credits).toBe(77));
  });

  it("gọi credit hỏng ⇒ chỉ mất số credit, project vẫn hiện, không báo lỗi trang", async () => {
    serveProject({ data: project("extracting"), error: null });
    serveBalance({ data: null, error: { code: "INTERNAL", message: "sập" } }, 500);

    const { result } = renderHook(() => useMode1Project(P));
    await waitFor(() => expect(result.current.project?.import_state).toBe("extracting"));
    expect(result.current.credits).toBeNull();
    expect(result.current.error, "ví hỏng không phải lỗi của trang").toBeNull();
  });

  it("project hỏng ⇒ error có chữ của BE để khung trang hiện thay nội dung", async () => {
    serveProject({ data: null, error: { code: "PROJECT_NOT_FOUND", message: "Không tìm thấy dự án" } }, 404);
    serveBalance({ data: { balance: 10, available: 10 }, error: null });

    const { result } = renderHook(() => useMode1Project(P));
    await waitFor(() => expect(result.current.error).toContain("Không tìm thấy dự án"));
    expect(result.current.project).toBeNull();
  });

  it("reload lấy `import_state` mới và xoá lỗi cũ khi đã chạy lại được", async () => {
    let state: string | null = null;
    let fail = true;
    mockServer.use(
      http.get(`${API_BASE_URL}/projects/:projectId`, () =>
        fail
          ? HttpResponse.json({ data: null, error: { code: "INTERNAL", message: "sập" } }, { status: 500 })
          : HttpResponse.json({ data: project(state), error: null })
      )
    );
    serveBalance({ data: { balance: 10, available: 10 }, error: null });

    const { result } = renderHook(() => useMode1Project(P));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    fail = false;
    state = "finalized";
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error, "lần gọi sau thành công phải xoá lỗi cũ").toBeNull();
    expect(result.current.project?.import_state).toBe("finalized");
  });
});
