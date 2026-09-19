import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/test/intl";
import { HOOK_ERROR, hookErrorText, type HookErrorKey } from "./hook-errors";

describe("hook-errors", () => {
  it("mọi mã lỗi của hook đều có câu ở cả vi và en", () => {
    for (const locale of ["vi", "en"] as const) {
      const messages = MESSAGES[locale].workspace.hookErrors as Record<string, string>;
      for (const key of Object.keys(HOOK_ERROR)) expect(messages[key], `${locale}.${key}`).toBeTruthy();
    }
  });

  it("mã @key được dịch; message từ BE đi qua nguyên văn", () => {
    const t = createTranslator({ locale: "en", messages: MESSAGES.en, namespace: "workspace.hookErrors" });
    expect(hookErrorText(HOOK_ERROR.docLoadFailed, t)).toBe("Could not load the document");
    expect(hookErrorText("Lỗi thật từ BE", t)).toBe("Lỗi thật từ BE");
    expect(hookErrorText("@khongCo", t as (key: HookErrorKey) => string)).toBe("@khongCo");
  });
});
