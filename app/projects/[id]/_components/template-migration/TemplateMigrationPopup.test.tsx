import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import TemplateMigrationPopup from "./TemplateMigrationPopup";

const nav = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.query),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/projects/p1",
}));
vi.mock("@/lib/api/template-migration", () => ({ listTemplateMigrations: vi.fn(async () => []), getTemplateMigration: vi.fn() }));
vi.mock("@/lib/api/org-library", () => ({ listOrgTemplates: vi.fn(async () => []) }));

const props = { projectId: "p1", orgId: "o1", orgRole: "lead" as const, flags: [], sectionName: (id: string) => id };

beforeEach(() => {
  nav.query = "";
});

describe("TemplateMigrationPopup", () => {
  it("chỉ mở khi panel=template", () => {
    nav.query = "panel=gap";
    const { container } = renderWithIntl(<TemplateMigrationPopup {...props} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("panel=template ⇒ popup đổi mẫu với bước chọn mẫu", async () => {
    nav.query = "panel=template&template_id=t1&version=2";
    renderWithIntl(<TemplateMigrationPopup {...props} />);
    expect(await screen.findByRole("dialog", { name: "Đổi mẫu tài liệu" })).toBeInTheDocument();
    expect(await screen.findByLabelText("File mẫu (.docx)")).toBeInTheDocument();
  });

  it("Viewer không dựng popup", () => {
    nav.query = "panel=template";
    const { container } = renderWithIntl(<TemplateMigrationPopup {...props} readOnly />);
    expect(container).toBeEmptyDOMElement();
  });
});
