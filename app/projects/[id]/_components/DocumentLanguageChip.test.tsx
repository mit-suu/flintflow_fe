import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import DocumentLanguageChip from "./DocumentLanguageChip";

describe("DocumentLanguageChip (FLF-265)", () => {
  it.each([
    ["vi", "Tiếng Việt"],
    ["en", "English"],
  ] as const)("%s ⇒ tên ngôn ngữ viết bằng chính nó, gắn `lang` để đọc đúng giọng; chỉ đọc", (language, name) => {
    renderWithIntl(<DocumentLanguageChip language={language} />);

    const chip = screen.getByTitle(`Ngôn ngữ tài liệu: ${name}`);
    expect(chip).toHaveTextContent(name);
    expect(screen.getByText(name)).toHaveAttribute("lang", language);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["vi", "VI", "Tiếng Việt"],
    ["en", "EN", "English"],
  ] as const)("compact %s ⇒ chỉ mã ngôn ngữ, tên đầy đủ ở tooltip + nhãn trợ năng", (language, code, name) => {
    renderWithIntl(<DocumentLanguageChip language={language} compact />);

    const chip = screen.getByTitle(`Ngôn ngữ tài liệu: ${name}`);
    expect(chip).toHaveTextContent(code);
    expect(chip).not.toHaveTextContent(name);
    expect(screen.getByLabelText(name)).toHaveAttribute("lang", language);
  });
});
