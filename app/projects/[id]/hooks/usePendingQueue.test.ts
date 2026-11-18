import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import type { PendingQueue } from "@/types/pending-queue";
import { usePendingQueue } from "./usePendingQueue";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const URL = `${API_BASE_URL}/projects/p1/pending-queue`;
const queueOf = (n: number): PendingQueue => ({
  total: n,
  items: Array.from({ length: n }, (_, i) => ({
    key: `assumption:AS0${i}`,
    kind: "assumption" as const,
    blocking: true,
    owner_step: "B-2.1",
    section_id: null,
    entity_path: null,
    dependents: 0,
    refs: { assumption_id: `AS0${i}` },
  })),
});

describe("usePendingQueue", () => {
  it("tải hàng khi có spineVersion và tải lại khi spineVersion đổi", async () => {
    let calls = 0;
    mockServer.use(http.get(URL, () => HttpResponse.json({ data: queueOf(++calls), error: null })));
    const { result, rerender } = renderHook(({ version }) => usePendingQueue("p1", version), { initialProps: { version: 3 as number | null } });
    await waitFor(() => expect(result.current.queue?.total).toBe(1));
    rerender({ version: 4 });
    await waitFor(() => expect(result.current.queue?.total).toBe(2));
  });

  it("chưa có spineVersion hoặc enabled = false ⇒ không gọi API", async () => {
    let calls = 0;
    mockServer.use(http.get(URL, () => HttpResponse.json({ data: queueOf(++calls), error: null })));
    renderHook(() => usePendingQueue("p1", null));
    renderHook(() => usePendingQueue("p1", 3, false));
    await act(async () => undefined);
    expect(calls).toBe(0);
  });

  it("reload() tay trả hàng mới để nơi gọi so sánh việc tự xong", async () => {
    let calls = 0;
    mockServer.use(http.get(URL, () => HttpResponse.json({ data: queueOf(calls++ === 0 ? 3 : 1), error: null })));
    const { result } = renderHook(() => usePendingQueue("p1", 3));
    await waitFor(() => expect(result.current.queue?.total).toBe(3));
    let next: PendingQueue | null = null;
    await act(async () => {
      next = await result.current.reload();
    });
    expect((next as PendingQueue | null)?.items).toHaveLength(1);
    expect(result.current.queue?.total).toBe(1);
  });

  it("lỗi ⇒ queue về null (không giữ hàng cũ) và có thông báo lỗi", async () => {
    let fail = false;
    mockServer.use(
      http.get(URL, () =>
        fail ? HttpResponse.json({ data: null, error: { code: "INTERNAL", message: "Máy chủ lỗi" } }, { status: 500 }) : HttpResponse.json({ data: queueOf(2), error: null })
      )
    );
    const { result } = renderHook(() => usePendingQueue("p1", 3));
    await waitFor(() => expect(result.current.queue?.total).toBe(2));
    fail = true;
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.queue).toBeNull();
    expect(result.current.error).not.toBeNull();
  });
});
