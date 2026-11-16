import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiCall } from "./client";
import { connectGoogle, disconnectGoogle, getGoogleAccessToken, getGoogleDocLinks, getGoogleStatus } from "./google";
import { exportToGoogleDocs } from "./export";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  apiCall: vi.fn(async () => ({ data: { status: "connected" }, error: null })),
}));

beforeEach(() => vi.mocked(apiCall).mockClear());

describe("lib/api/google", () => {
  it("gọi đúng endpoint của contract #40–#43", async () => {
    await connectGoogle("auth-code");
    expect(apiCall).toHaveBeenLastCalledWith("/integrations/google/connect", {
      method: "POST",
      body: JSON.stringify({ code: "auth-code" }),
    });

    await getGoogleStatus();
    expect(apiCall).toHaveBeenLastCalledWith("/integrations/google/status");

    await disconnectGoogle();
    expect(apiCall).toHaveBeenLastCalledWith("/integrations/google", { method: "DELETE" });

    await getGoogleAccessToken();
    expect(apiCall).toHaveBeenLastCalledWith("/integrations/google/access-token");
  });

  it("links (#45) và xuất Google Docs (#44) gửi đúng path, query và body", async () => {
    await getGoogleDocLinks("p1");
    expect(apiCall).toHaveBeenLastCalledWith("/projects/p1/google-docs/links");

    await exportToGoogleDocs("p1", { source: "baseline", baselineId: "BL001", lang: "en" }, "update");
    expect(apiCall).toHaveBeenLastCalledWith("/projects/p1/export/google-docs?source=baseline&baseline_id=BL001&lang=en", {
      method: "POST",
      body: JSON.stringify({ mode: "update" }),
    });

    await exportToGoogleDocs("p1", { source: "draft" }, "new");
    expect(apiCall).toHaveBeenLastCalledWith("/projects/p1/export/google-docs?source=draft", {
      method: "POST",
      body: JSON.stringify({ mode: "new" }),
    });
  });

  it("trả `data` của envelope", async () => {
    expect(await getGoogleStatus()).toEqual({ status: "connected" });
  });
});
