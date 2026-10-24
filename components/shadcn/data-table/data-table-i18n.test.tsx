import { screen } from "@testing-library/react";
import { getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { friendlyError } from "@/lib/errors";
import { sectionLabel, sectionLabelIn } from "@/lib/constants/fpt-sections";
import { renderWithIntl, vietnameseLeftovers, VIETNAMESE } from "@/test/intl";
import type { Locale } from "@/lib/i18n";
import { DataTable, DataTableColumnHeader, DataTableToolbar } from ".";

type Row = { name: string };

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title="Name" /> },
];

function Table({ rows }: { rows: Row[] }) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  return <DataTable table={table} columns={columns} toolbar={<DataTableToolbar table={table} />} />;
}

const renderShared = (locale: Locale, rows: Row[] = []) =>
  renderWithIntl(
    <>
      <Table rows={rows} />
      <PageSkeleton />
    </>,
    locale
  );

describe("Data table + khối dùng chung — song ngữ", () => {
  it("vi giữ nguyên nhãn cũ", () => {
    renderShared("vi");
    expect(screen.getByText("Không có dữ liệu.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tìm…")).toBeInTheDocument();
    expect(screen.getByText("Dòng mỗi trang")).toBeInTheDocument();
    expect(screen.getAllByText(/^Trang 1\//).length).toBeGreaterThan(0);
    expect(screen.getByRole("status", { name: "Đang tải" })).toBeInTheDocument();
  });

  it("en không còn chữ tiếng Việt", () => {
    const { container } = renderShared("en", [{ name: "Alpha" }]);
    expect(vietnameseLeftovers(container)).toEqual([]);
    expect(screen.getByText("Rows per page")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
  });

  it("en: bảng rỗng hiện câu tiếng Anh", () => {
    renderShared("en");
    expect(screen.getByText("No data.")).toBeInTheDocument();
  });
});

describe("Helper .ts theo ngôn ngữ", () => {
  it("friendlyError en không còn tiếng Việt, vi giữ câu cũ", () => {
    const raw = "Bước S-3.1 đang chạy ở lượt trước (bắt đầu 14:02)";
    expect(friendlyError("STEP_NOT_RUNNABLE", raw, "vi").message).toBe("Bước này đang chạy ở lượt trước (bắt đầu 14:02).");
    const en = friendlyError("STEP_NOT_RUNNABLE", raw, "en");
    expect(en.message).toContain("14:02");
    for (const code of ["CALL_LIMIT", "BASELINE_BLOCKED", "duplicate_id", "STREAM_CLOSED", "ORG_ROLE_FORBIDDEN"]) {
      const f = friendlyError(code, "", "en");
      expect([f.message, ...f.actions.map((a) => a.label)].filter((s) => VIETNAMESE.test(s)), code).toEqual([]);
    }
  });

  it("sectionLabel theo locale", () => {
    expect(sectionLabel("custom:x", "en")).toBe("Custom section");
    expect(sectionLabel("feature:@B0099", "en")).toBe("New feature (no code yet)");
    expect(sectionLabelIn("function:@B0031", [{ block_id: "B0031", heading_text: "3.2.1 Register" }], "en")).toBe("New function — 3.2.1 Register");
    expect(sectionLabel(null, "vi")).toBe("Không khớp (giữ nguyên, không trích)");
  });
});
