import { afterEach, describe, expect, it, vi } from "vitest";

/** Cờ đọc `process.env` lúc nạp module (Next thay hằng số lúc build) ⇒ mỗi ca nạp lại module. */
const load = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./google-auth");
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDocsAssistantEnabled", () => {
  it("mặc định tắt kể cả khi có client id Google", async () => {
    const mod = await load({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com", NEXT_PUBLIC_GOOGLE_DOCS_AGENT_ENABLED: "" });
    expect(mod.isGoogleAuthEnabled).toBe(true);
    expect(mod.isDocsAssistantEnabled).toBe(false);
  });

  it("bật cờ nhưng thiếu client id ⇒ vẫn tắt", async () => {
    const mod = await load({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: "", NEXT_PUBLIC_GOOGLE_DOCS_AGENT_ENABLED: "true" });
    expect(mod.isDocsAssistantEnabled).toBe(false);
  });

  it("tạm ẩn hẳn: có client id và cờ = true vẫn tắt (chỉ giữ xuất Google Docs)", async () => {
    const mod = await load({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com", NEXT_PUBLIC_GOOGLE_DOCS_AGENT_ENABLED: "true" });
    expect(mod.isDocsAssistantEnabled).toBe(false);
  });
});
