import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import AdminTemplateGapsPage from "./page";

vi.mock("../_components/AdminHeader", () => ({ default: () => null }));
vi.mock("@/lib/api/admin", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTemplateGaps: vi.fn(async () => ({
    projects: 4,
    rows: [{ key: "hardware interfaces", samples: ["Hardware Interfaces", "2.4 Hardware interfaces"], projects: 3, empty: 2, suggested_destination: null }],
  })),
}));

describe("AdminTemplateGapsPage (FLF-278 trên FLF-335/336)", () => {
  it("liệt kê tiêu đề gộp, số dự án gặp / còn trống", async () => {
    renderWithIntl(<AdminTemplateGapsPage />);
    expect(await screen.findByText("Hardware Interfaces · 2.4 Hardware interfaces")).toBeInTheDocument();
    expect(screen.getByText("Tính trên 4 dự án theo mẫu bắt buộc.")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
