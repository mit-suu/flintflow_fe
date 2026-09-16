import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamChatMessage, streamSse } from "./ai-stream";
import { authFetch } from "./api/client";

vi.mock("./api/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  authFetch: vi.fn(),
}));

const sseResponse = (chunks: string[], status = 200) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
  return new Response(stream, { status });
};

describe("streamSse", () => {
  beforeEach(() => {
    vi.mocked(authFetch).mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST body JSON và ghép event bị cắt giữa hai chunk; bỏ khối không phải data hoặc JSON hỏng", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      sseResponse(['data: {"n":1}\n\ndata: {"n"', ':2}\n\n: ping\n\ndata: {hỏng}\n\n'])
    );
    const onEvent = vi.fn();

    await streamSse<{ n: number }>("/projects/p1/steps/S-3.1/run", { a: 1 }, { onEvent });

    expect(authFetch).toHaveBeenCalledWith("/projects/p1/steps/S-3.1/run", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      signal: undefined,
    });
    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it("khối SSE có dòng `event:` (pipeline contract) và CRLF vẫn đọc được data", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      sseResponse([
        'event: gate_ready\ndata: {"type":"gate_ready","step_id":"S-3.1"}\n\n',
        'event: flags\r\ndata: {"type":"flags",\r\ndata: "red_open":0}\r\n\r\n',
      ])
    );
    const onEvent = vi.fn();

    await streamSse("/projects/p1/steps/S-3.1/run", {}, { onEvent });

    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      { type: "gate_ready", step_id: "S-3.1" },
      { type: "flags", red_open: 0 },
    ]);
  });

  it("HTTP lỗi thì gọi onError một lần với thông điệp BE rồi ném lại", async () => {
    vi.mocked(authFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Không đủ credit" } }), { status: 402 })
    );
    const onError = vi.fn();

    await expect(streamSse("/x", {}, { onEvent: vi.fn(), onError })).rejects.toThrow("Không đủ credit");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("bị huỷ (AbortError) thì kết thúc im lặng", async () => {
    vi.mocked(authFetch).mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    const onError = vi.fn();

    await expect(streamSse("/x", {}, { onEvent: vi.fn(), onError })).resolves.toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("streamChatMessage", () => {
  beforeEach(() => {
    vi.mocked(authFetch).mockReset();
  });

  it("gọi endpoint stream của chat và phát text-delta, error, finish tới đúng handler", async () => {
    const session = { _id: "c1", projectId: "p1", messages: [], isActive: true, createdAt: "2026-09-14" };
    vi.mocked(authFetch).mockResolvedValueOnce(
      sseResponse([
        'data: {"type":"text-delta","delta":"Xin"}\n\n',
        'data: {"type":"text-delta","delta":" chào"}\n\n',
        'data: {"type":"error","error":"Quá tải"}\n\n',
        `data: ${JSON.stringify({ type: "finish", session, cost: 2 })}\n\n`,
      ])
    );
    const onTextDelta = vi.fn();
    const onFinish = vi.fn();
    const onError = vi.fn();

    await streamChatMessage({
      projectId: "p1",
      chatId: "c1",
      content: "Mô tả ý tưởng",
      step: "vision_problem",
      discoveryStep: 1,
      onTextDelta,
      onFinish,
      onError,
    });

    const [path, init] = vi.mocked(authFetch).mock.calls[0];
    expect(path).toBe("/projects/p1/chats/c1/messages/stream");
    expect(JSON.parse(init?.body as string)).toEqual({
      content: "Mô tả ý tưởng",
      step: "vision_problem",
      discoveryStep: 1,
    });
    expect(onTextDelta.mock.calls.map(([delta]) => delta)).toEqual(["Xin", " chào"]);
    expect(onError).toHaveBeenCalledWith(new Error("Quá tải"));
    expect(onFinish).toHaveBeenCalledWith({ session, data: undefined, tokensUsed: undefined, cost: 2 });
  });
});
