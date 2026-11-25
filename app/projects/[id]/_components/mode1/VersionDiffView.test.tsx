import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { BlockDiffEntry } from "@/types/import";
import VersionDiffView from "./VersionDiffView";

const HEADER = ["Ngày", "A*M,D", "Người thực hiện", "Mô tả thay đổi"];
const roc = (n: number) => [`0${n}/11/2026`, "A", "", `Thay đổi ${n}`];

const entries: BlockDiffEntry[] = [
  {
    block_id: null,
    change: "modified",
    kind: "table",
    section: "I. Lịch sử thay đổi",
    table: { header: HEADER, rows: [{ change: "unchanged", count: 4, rows: [roc(1), roc(2), roc(3), roc(4)] }, { change: "added", after: roc(5) }, { change: "added", after: roc(6) }, { change: "added", after: roc(7) }] },
  },
  { block_id: null, change: "modified", kind: "paragraph", section: "3.2.1 Đăng nhập", before: "khoá sau 5 lần sai", after: "khoá sau 3 lần sai" },
  { block_id: null, change: "added", after: "Đoạn của bản ghi cũ" },
];

const render = () => renderWithIntl(<VersionDiffView entries={entries} sections={[{ title: "3.2.1 Đăng nhập", unchanged: 2 }]} fromLabel="0.4" toLabel="1.0" />);

describe("VersionDiffView", () => {
  it("cột trái liệt kê mục có thay đổi kèm +n −n ~n; bản ghi thiếu mục vào nhóm Khác", () => {
    render();
    const nav = screen.getByRole("navigation", { name: "Mục có thay đổi" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["I. Lịch sử thay đổi+3 ", "3.2.1 Đăng nhập~1", "Khác+1 "]);
    expect(links[0].getAttribute("href")).toMatch(/^#/);
  });

  it("bảng thêm 3 hàng ⇒ chỉ 3 hàng xanh, hàng cũ gập ⋯ 4 hàng, bấm thì mở", () => {
    render();
    const table = screen.getByRole("table");
    expect(table.querySelectorAll('tr[data-change="added"]')).toHaveLength(3);
    expect(within(table).queryByText("Thay đổi 1")).not.toBeInTheDocument();
    fireEvent.click(within(table).getByRole("button", { name: "⋯ 4 hàng" }));
    expect(within(table).getByText("Thay đổi 1")).toBeInTheDocument();
  });

  it("đoạn sửa chỉ tô chữ đổi; chuyển Một cột / Hai cột", () => {
    render();
    const section = screen.getByRole("region", { name: "3.2.1 Đăng nhập" });
    expect(within(section).getByText("5").tagName).toBe("DEL");
    expect(within(section).getByText("3").tagName).toBe("INS");
    expect(within(section).getByText("⋯ 2 đoạn không đổi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Hai cột" }));
    expect(screen.getByRole("radio", { name: "Hai cột" })).toHaveAttribute("aria-checked", "true");
    // Hai cột: bản cũ chỉ có chữ xoá, bản mới chỉ có chữ thêm
    const paras = section.querySelectorAll("p.rounded-control");
    expect(paras).toHaveLength(2);
    expect(paras[0].querySelector("ins")).toBeNull();
    expect(paras[1].querySelector("del")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Một cột" }));
    expect(section.querySelectorAll("p.rounded-control")).toHaveLength(1);
  });

  it("mục trùng tên ở hai chỗ khác nhau (khoá mục khác) là hai nhóm", () => {
    const flow = (uc: string, text: string): BlockDiffEntry => ({ block_id: null, change: "added", kind: "paragraph", section: "Luồng chính", section_key: `3.2 > ${uc} > Luồng chính`, after: text });
    renderWithIntl(<VersionDiffView entries={[flow("UC-01", "Bước A"), flow("UC-02", "Bước B")]} fromLabel="0.4" toLabel="1.0" />);
    expect(screen.getAllByRole("region", { name: "Luồng chính" })).toHaveLength(2);
  });

  it("không có khác biệt", () => {
    renderWithIntl(<VersionDiffView entries={[]} fromLabel="0.4" toLabel="1.0" />);
    expect(screen.getByText("Không có khác biệt.")).toBeInTheDocument();
  });
});
