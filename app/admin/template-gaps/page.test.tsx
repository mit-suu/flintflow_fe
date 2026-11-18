import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import { fetchTemplateGaps } from "@/lib/api/admin";
import AdminTemplateGapsPage from "./page";

vi.mock("../_components/AdminHeader", () => ({ default: () => null }));
vi.mock("@/lib/api/admin", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTemplateGaps: vi.fn(async (page = 1) => ({
    projects: 4,
    items: [
      { key: "hardware interfaces", samples: ["Hardware Interfaces", "2.4 Hardware interfaces"], projects: 3, empty: 2, suggested_destination: null },
      { key: "open questions", samples: ["Open Questions"], projects: 1, empty: 1, suggested_destination: "slot:open_questions" },
    ].map((row) => (page === 1 ? row : { ...row, key: `${row.key}-${page}`, samples: [`${row.samples[0]} (trang ${page})`] })),
    meta: { page, limit: 20, total: 42, totalPages: 3 },
  })),
}));

describe("AdminTemplateGapsPage (FLF-278 trên FLF-335/336)", () => {
  it("liệt kê tiêu đề gộp, số dự án gặp / còn trống", async () => {
    renderWithIntl(<AdminTemplateGapsPage />);
    const row = (await screen.findByText("Hardware Interfaces · 2.4 Hardware interfaces")).closest("li")!;
    expect(screen.getByText("Tính trên 4 dự án theo mẫu bắt buộc.")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    // Gợi ý đích hiện tên dễ đọc, không phải mã `slot:*`
    expect(screen.getByText("Câu hỏi còn mở (TBD)")).toBeInTheDocument();
    expect(screen.queryByText("slot:open_questions")).not.toBeInTheDocument();
  });

  it("không còn cắt 100 dòng: thanh số trang, bấm trang 3 hỏi BE trang 3; cơ sở thống kê giữ nguyên (FLF-404)", async () => {
    renderWithIntl(<AdminTemplateGapsPage />);
    await screen.findByText("Hardware Interfaces · 2.4 Hardware interfaces");
    fireEvent.click(screen.getByRole("button", { name: "Tới trang 3" }));
    expect(await screen.findByText("Hardware Interfaces (trang 3)")).toBeInTheDocument();
    expect(fetchTemplateGaps).toHaveBeenLastCalledWith(3, 20);
    expect(screen.getByText("Tính trên 4 dự án theo mẫu bắt buộc.")).toBeInTheDocument();
  });
});
