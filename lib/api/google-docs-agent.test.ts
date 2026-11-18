import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamSse } from "../ai-stream";
import { apiCall } from "./client";
import { applyDocsAgentAction, dismissDocsAgentAction, googleDocUrl, streamDocsAgentMessage } from "./google-docs-agent";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  apiCall: vi.fn(async () => ({ data: { ok: true }, error: null })),
}));
vi.mock("../ai-stream", () => ({ streamSse: vi.fn(async () => {}) }));

beforeEach(() => vi.clearAllMocks());

describe("lib/api/google-docs-agent", () => {
  it("gọi đúng endpoint của contract #48–#50", async () => {
    const handlers = { onEvent: vi.fn() };
    const body = { documentId: "d1", message: "hi", history: [] };
    await streamDocsAgentMessage("p1", body, handlers);
    expect(streamSse).toHaveBeenCalledWith("/projects/p1/google-docs/agent/messages/stream", body, handlers);

    await applyDocsAgentAction("p1", "a1");
    expect(apiCall).toHaveBeenLastCalledWith("/projects/p1/google-docs/agent/actions/a1/apply", { method: "POST" });
    await dismissDocsAgentAction("p1", "a1");
    expect(apiCall).toHaveBeenLastCalledWith("/projects/p1/google-docs/agent/actions/a1/dismiss", { method: "POST" });
  });

  it("googleDocUrl mã hoá ID", () => {
    expect(googleDocUrl("abc_1-2")).toBe("https://docs.google.com/document/d/abc_1-2/edit");
  });
});
