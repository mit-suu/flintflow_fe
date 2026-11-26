import { describe, expect, it } from "vitest";
import { DOCUMENT_LANGUAGE_NAME, isDocumentLanguage, knownDocumentLanguage, resolvedDocumentLanguage, shownDocumentLanguage, translationMetaOf } from "./document-language";

describe("document-language (FLF-265)", () => {
  it("tên ngôn ngữ viết bằng chính ngôn ngữ đó; chỉ nhận vi | en", () => {
    expect(DOCUMENT_LANGUAGE_NAME).toEqual({ vi: "Tiếng Việt", en: "English" });
    expect(isDocumentLanguage("vi")).toBe(true);
    expect(isDocumentLanguage("en")).toBe(true);
    expect(isDocumentLanguage("fr")).toBe(false);
    expect(isDocumentLanguage(undefined)).toBe(false);
  });

  it("knownDocumentLanguage: field thắng; mode 2 thiếu field ⇒ en như BE; mode 1 thiếu field ⇒ null (không đoán, không gọi BE)", () => {
    expect(knownDocumentLanguage({ mode: "fpt", documentLanguage: "vi" })).toBe("vi");
    expect(knownDocumentLanguage({ mode: "fpt" })).toBe("en");
    expect(knownDocumentLanguage({ mode: "import" })).toBeNull();
    expect(knownDocumentLanguage({ mode: "import", documentLanguage: "vi" })).toBe("vi");
    // FLF-318: tạo SRS đã chuyển sang mode 1 đọc như mode 2
    expect(knownDocumentLanguage({ mode: "import", converted_from: "fpt" })).toBe("en");
    expect(knownDocumentLanguage(null)).toBeNull();
    expect(knownDocumentLanguage(undefined)).toBeNull();
  });

  it("FLF-480 (ChoViet #14): resolvedDocumentLanguage dùng document_language BE suy khi mode 1 chưa lưu field riêng", () => {
    // mode 1 chưa lưu documentLanguage: knownDocumentLanguage ⇒ null, dùng document_language BE suy
    expect(resolvedDocumentLanguage({ mode: "import", document_language: "vi" })).toBe("vi");
    expect(resolvedDocumentLanguage({ mode: "import", document_language: "en" })).toBe("en");
    // field tự lưu thắng, không bị document_language đè
    expect(resolvedDocumentLanguage({ mode: "import", documentLanguage: "vi", document_language: "en" })).toBe("vi");
    // mode 2 luôn "en" qua knownDocumentLanguage, không cần tới document_language
    expect(resolvedDocumentLanguage({ mode: "fpt" })).toBe("en");
    // BE chưa gửi field mới (dự án cũ / BE cũ) ⇒ vẫn null như trước, không bịa giá trị
    expect(resolvedDocumentLanguage({ mode: "import" })).toBeNull();
    expect(resolvedDocumentLanguage({ mode: "import", document_language: null })).toBeNull();
    expect(resolvedDocumentLanguage(null)).toBeNull();
  });

  it("translationMetaOf: đọc `meta.translation` đúng khuôn; vắng hoặc sai khuôn ⇒ null", () => {
    expect(translationMetaOf({ assembled_at_version: 3, translation: { locale: "vi", source_locale: "en", missing: 12 } })).toEqual({
      locale: "vi",
      source_locale: "en",
      missing: 12,
    });
    expect(translationMetaOf({ assembled_at_version: 3, spine_version: 3, stale: false })).toBeNull();
    expect(translationMetaOf(undefined)).toBeNull();
    expect(translationMetaOf({ translation: null })).toBeNull();
    expect(translationMetaOf({ translation: { locale: "fr", source_locale: "en", missing: 1 } })).toBeNull();
    expect(translationMetaOf({ translation: { locale: "vi", source_locale: "en", missing: -1 } })).toBeNull();
    expect(translationMetaOf({ translation: { locale: "vi", source_locale: "en", missing: "3" } })).toBeNull();
  });

  it("shownDocumentLanguage: `meta.translation` của tài liệu thắng giá trị client suy ra", () => {
    expect(shownDocumentLanguage({ locale: "vi", source_locale: "en", missing: 0 }, "en")).toBe("vi");
    expect(shownDocumentLanguage(null, "en")).toBe("en");
    expect(shownDocumentLanguage(null, null)).toBeNull();
  });
});
