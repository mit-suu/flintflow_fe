import { describe, expect, it } from "vitest";
import { languageCommandOutcome, parseLanguageCommand } from "./document-language-command";

describe("parseLanguageCommand (FLF-265 §3.7, D15)", () => {
  it.each([
    ["dịch sang tiếng Anh", "en"],
    ["Dịch tài liệu sang tiếng Việt", "vi"],
    ["dịch SRS sang tiếng Anh nhé", "en"],
    ["dich tai lieu sang tieng viet", "vi"],
    ["DỊCH TOÀN BỘ TÀI LIỆU NÀY SANG TIẾNG VIỆT!", "vi"],
    ["dịch ra tiếng Anh giúp mình", "en"],
    ["bạn dịch sang tiếng Việt giúp mình với", "vi"],
    ["hãy dịch tài liệu qua tiếng Anh đi", "en"],
    ["đổi tài liệu sang tiếng Anh", "en"],
    ["Đổi ngôn ngữ tài liệu sang tiếng Việt nhé", "vi"],
    ["đổi ngôn ngữ sang tiếng Anh", "en"],
    ["chuyển tài liệu sang tiếng Việt", "vi"],
    ["chuyển đổi tài liệu thành tiếng Anh được không?", "en"],
    ["mình muốn đổi SRS sang English", "en"],
    ["Translate the document to English", "en"],
    ["translate the SRS into Vietnamese please", "vi"],
    ["please translate to vietnamese", "vi"],
    ["Can you translate the whole document into English?", "en"],
    ["switch the document to Vietnamese", "vi"],
    ["Change the document language to English.", "en"],
    ["change the language of the document to vietnamese", "vi"],
    ["let's convert the SRS to English, thanks", "en"],
  ])("%s ⇒ %s", (text, target) => {
    expect(parseLanguageCommand(text)).toBe(target);
  });

  it.each([
    "tên màn hình bằng tiếng Anh nhé",
    "viết câu này bằng tiếng Việt",
    "dịch câu này sang tiếng Anh",
    "tài liệu tiếng Anh",
    "đổi sang tiếng Anh",
    "không dịch tài liệu sang tiếng Anh",
    "dịch tài liệu sang tiếng Anh và thêm màn hình đăng nhập",
    "trả lời bằng tiếng Việt",
    "switch to English",
    "translate this sentence to English",
    "The login screen should show an error message in English when the password is wrong, and the document must list it.",
    "We need an admin role that can translate product descriptions into Vietnamese for the storefront.",
    "",
    "   ",
  ])("%j ⇒ null", (text) => {
    expect(parseLanguageCommand(text)).toBeNull();
  });
});

describe("languageCommandOutcome", () => {
  const base = { canEdit: true, mode1: false, current: "en" as const };

  it("không phải lệnh ⇒ gửi bình thường", () => {
    expect(languageCommandOutcome({ ...base, target: null })).toBe("send");
  });

  it("Viewer ⇒ gửi bình thường, không chặn", () => {
    expect(languageCommandOutcome({ ...base, canEdit: false, target: "vi" })).toBe("send");
    expect(languageCommandOutcome({ ...base, canEdit: false, mode1: true, target: "vi" })).toBe("send");
  });

  it("mode 1 ⇒ khoá (D3), kể cả khi chưa biết ngôn ngữ file", () => {
    expect(languageCommandOutcome({ ...base, mode1: true, current: null, target: "en" })).toBe("locked");
  });

  it("mode 2: đích = ngôn ngữ hiện tại ⇒ same; khác ⇒ switch", () => {
    expect(languageCommandOutcome({ ...base, target: "en" })).toBe("same");
    expect(languageCommandOutcome({ ...base, target: "vi" })).toBe("switch");
    expect(languageCommandOutcome({ ...base, current: "vi", target: "en" })).toBe("switch");
  });
});
