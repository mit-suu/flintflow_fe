import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { CrDocumentDiff, CrLocation } from "@/types/change-request";

const getCrDocumentDiff = vi.fn();
vi.mock("@/lib/api/change-requests", () => ({ getCrDocumentDiff: (...args: unknown[]) => getCrDocumentDiff(...args) }));

import CrDocumentDiffView, { crProposalsKey } from "./CrDocumentDiffView";

const run = (text: string) => [{ text }];

const DIFF: CrDocumentDiff = {
  cr_id: "CR-004",
  spine_version: 7,
  change_count: 6,
  sections: [
    {
      id: "fixed:2.2.2",
      number: "2.2.2",
      heading: "Descriptions",
      level: 3,
      location_ids: ["L002", "L003"],
      change: "modified",
      blocks: [
        { block: { type: "paragraph", runs: run("Khoá sau 3 lần sai") }, change: "modified", before: "Khoá sau 5 lần sai", location_id: "L002" },
        { block: { type: "paragraph", runs: run("Đoạn không đổi") }, change: "unchanged" },
        { block: { type: "paragraph", runs: run("Đoạn mới thêm") }, change: "added", location_id: "L004" },
        {
          block: { type: "table", header: [run("ID"), run("Tên")], rows: [] },
          change: "modified",
          rows: [
            { cells: [run("UC-04"), run("Xem sản phẩm mới")], change: "modified", before: ["UC-04", "Xem sản phẩm"], cells_changed: [1], location_id: "L002" },
            { cells: [run("UC-11"), run("Viết đánh giá")], change: "removed", location_id: "L003" },
            { cells: [run("UC-12"), run("Giữ nguyên")], change: "unchanged" },
          ],
        },
      ],
    },
    {
      id: "function:FR-3.3.3",
      number: "3.3.3",
      heading: "Write Product Review",
      level: 3,
      location_ids: ["L005"],
      change: "removed",
      blocks: [
        {
          block: { type: "bullet_list", items: [run("Bước 1"), run("Bước 2")] },
          change: "removed",
          items: [
            { runs: run("Bước 1"), change: "removed", location_id: "L005" },
            { runs: run("Bước 2"), change: "removed" },
          ],
        },
      ],
    },
  ],
};

const scrolled: HTMLElement[] = [];

beforeEach(() => {
  getCrDocumentDiff.mockReset();
  getCrDocumentDiff.mockResolvedValue({ data: DIFF, error: null });
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function (this: HTMLElement) {
    scrolled.push(this);
  };
  if (!("CSS" in globalThis) || !("escape" in CSS)) (globalThis as unknown as { CSS: { escape: (s: string) => string } }).CSS = { escape: (s: string) => s };
});

afterEach(() => vi.useRealTimers());

const render = (props: Partial<React.ComponentProps<typeof CrDocumentDiffView>> = {}) =>
  renderWithIntl(<CrDocumentDiffView projectId="p1" crId="CR-004" focus={null} onExit={() => undefined} {...props} />);

describe("CrDocumentDiffView", () => {
  it("tô đúng chỗ: đoạn sửa tô chữ đổi, đoạn thêm xanh, dòng bảng xoá đỏ gạch ngang, mục xoá có nhãn", async () => {
    const { container } = render();
    await screen.findByText("Đoạn mới thêm");
    expect(container.querySelector("del")?.textContent).toContain("5");
    expect(container.querySelector("ins")?.textContent).toContain("3");
    expect(container.querySelector('[data-cr-change="added"]')).toHaveTextContent("Đoạn mới thêm");
    const removedRow = container.querySelector('tr[data-cr-change="removed"]');
    expect(removedRow).toHaveTextContent("UC-11");
    expect(removedRow?.className).toContain("line-through");
    expect(container.querySelector('tr[data-cr-change="modified"]')).toHaveTextContent("UC-04");
    expect(screen.getByText("Mục bị xoá")).toBeInTheDocument();
    // Dòng / đoạn không đổi vẫn hiện (tài liệu thật) nhưng không phải điểm đổi
    expect(screen.getByText("Đoạn không đổi").closest("[data-cr-point]")).toBeNull();
    expect(screen.getByText("Giữ nguyên").closest("[data-cr-point]")).toBeNull();
  });

  it("thanh trên: CR · số thay đổi; Trước / Sau đi qua từng điểm đổi và quay vòng; Thoát gọi onExit", async () => {
    const onExit = vi.fn();
    const { container } = render({ onExit });
    await screen.findByText("Đoạn mới thêm");
    expect(screen.getByText("CR-004 · 2 mục · 6 thay đổi")).toBeInTheDocument();
    const points = Array.from(container.querySelectorAll("[data-cr-point]"));
    expect(points).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));
    expect(scrolled.at(-1)).toBe(points[0]);
    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));
    expect(scrolled.at(-1)).toBe(points[1]);
    fireEvent.click(screen.getByRole("button", { name: /Trước/ }));
    expect(scrolled.at(-1)).toBe(points[0]);
    fireEvent.click(screen.getByRole("button", { name: /Trước/ }));
    expect(scrolled.at(-1)).toBe(points.at(-1));

    fireEvent.click(screen.getByRole("button", { name: "Thoát" }));
    expect(onExit).toHaveBeenCalled();
  });

  it("bấm đề xuất trong chat ⇒ cuộn tới đúng block / dòng và nháy viền một lần", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container, rerender } = render({ focus: null });
    await screen.findByText("Đoạn mới thêm");
    rerender(<CrDocumentDiffView projectId="p1" crId="CR-004" focus={{ locationId: "L003", nonce: 1 }} onExit={() => undefined} />);
    await waitFor(() => expect(scrolled.length).toBe(1));
    const target = container.querySelector('[data-location-id="L003"]') as HTMLElement;
    expect(scrolled[0]).toBe(target);
    expect(target.dataset.flash).toBe("true");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(target.dataset.flash).toBeUndefined();
  });

  it("đề xuất thêm mới ⇒ cuộn tới block mới; cùng vị trí bấm lại (nonce mới) ⇒ cuộn lại", async () => {
    const { container, rerender } = render();
    await screen.findByText("Đoạn mới thêm");
    const view = (nonce: number) => <CrDocumentDiffView projectId="p1" crId="CR-004" focus={{ locationId: "L004", nonce }} onExit={() => undefined} />;
    rerender(view(1));
    await waitFor(() => expect(scrolled).toHaveLength(1));
    expect(scrolled[0]).toBe(container.querySelector('[data-location-id="L004"]'));
    rerender(view(1));
    expect(scrolled).toHaveLength(1);
    rerender(view(2));
    await waitFor(() => expect(scrolled).toHaveLength(2));
  });

  it("vị trí không có block riêng ⇒ cuộn về mục chứa vị trí đó", async () => {
    const { container } = render({ focus: { locationId: "L005", nonce: 1 } });
    await waitFor(() => expect(scrolled).toHaveLength(1));
    // L005 gắn riêng ở một mục danh sách của mục bị xoá
    expect(scrolled[0]).toBe(container.querySelector('li[data-location-id="L005"]'));
  });

  it("CR chưa có thay đổi ⇒ báo trống; lỗi tải ⇒ báo lỗi", async () => {
    getCrDocumentDiff.mockResolvedValueOnce({ data: { ...DIFF, change_count: 0, sections: [] }, error: null });
    const first = render();
    expect(await screen.findByText("CR này chưa có thay đổi nào để xem trên tài liệu.")).toBeInTheDocument();
    first.unmount();
    getCrDocumentDiff.mockResolvedValueOnce({ data: null, error: { code: "X", message: "boom" } });
    render();
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa dựng được");
  });

  it("bấm xem trong lúc đang tải lại ⇒ chờ bản mới rồi mới cuộn (không dùng bản cũ, không mất lượt bấm)", async () => {
    const { container, rerender } = render({ refreshKey: "a" });
    await screen.findByText("Đoạn mới thêm");
    let finish!: (v: unknown) => void;
    getCrDocumentDiff.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const view = (nonce: number) => <CrDocumentDiffView projectId="p1" crId="CR-004" refreshKey="b" focus={{ locationId: "L003", nonce }} onExit={() => undefined} />;
    rerender(view(1));
    await waitFor(() => expect(getCrDocumentDiff).toHaveBeenCalledTimes(2));
    expect(scrolled).toHaveLength(0);
    await act(async () => finish({ data: DIFF, error: null }));
    await waitFor(() => expect(scrolled).toHaveLength(1));
    expect(scrolled[0]).toBe(container.querySelector('[data-location-id="L003"]'));
  });

  it("đổi hàng tiêu đề bảng / tiêu đề mục là một điểm đổi (đếm khớp Trước / Sau); tải lại lỗi ⇒ giữ bản cũ kèm báo", async () => {
    const withHeader: CrDocumentDiff = {
      ...DIFF,
      change_count: 2,
      sections: [
        {
          id: "s",
          number: "1",
          heading: "Tên mới",
          heading_before: "Tên cũ",
          level: 2,
          location_ids: [],
          change: "modified",
          blocks: [{ block: { type: "table", header: [run("ID"), run("Title")], rows: [[run("a"), run("b")]] }, change: "modified", header_before: ["ID", "Name"] }],
        },
      ],
    };
    getCrDocumentDiff.mockResolvedValueOnce({ data: withHeader, error: null });
    const { container, rerender } = render({ refreshKey: "a" });
    await screen.findByText("CR-004 · 1 mục · 2 thay đổi");
    expect(container.querySelectorAll("[data-cr-point]")).toHaveLength(2);
    getCrDocumentDiff.mockResolvedValueOnce({ data: null, error: { code: "X", message: "boom" } });
    rerender(<CrDocumentDiffView projectId="p1" crId="CR-004" refreshKey="b" focus={null} onExit={() => undefined} />);
    expect(await screen.findByRole("status", { name: "" })).toHaveTextContent("Chưa cập nhật được");
    expect(container.querySelectorAll("[data-cr-point]")).toHaveLength(2);
  });

  it("đề xuất đổi (refreshKey) ⇒ tải lại", async () => {
    const { rerender } = render({ refreshKey: "a" });
    await screen.findByText("Đoạn mới thêm");
    rerender(<CrDocumentDiffView projectId="p1" crId="CR-004" refreshKey="b" focus={null} onExit={() => undefined} />);
    await waitFor(() => expect(getCrDocumentDiff).toHaveBeenCalledTimes(2));
  });
});

describe("CrDocumentDiffView - quyết ngay trên tài liệu", () => {
  const location = (id: string, over: Partial<CrLocation> = {}): CrLocation => ({
    location_id: id,
    path: `x[id=${id}]`,
    section_id: "fixed:2.2.2",
    section_title: "Descriptions",
    current_text: "",
    found_by: ["keyword"],
    entity_paths: [],
    owner_step: null,
    conclusion: "edit",
    reason: null,
    proposal: { old_text: `text ${id}`, new_text: "mới", comment_text: null, spine_ops: [], assumptions: [] },
    manual: false,
    redo_count: 0,
    verify: null,
    group_id: null,
    ...over,
  });
  const decide = (locations: CrLocation[], accepted: string[] = []) => ({
    locations,
    isAccepted: (l: CrLocation) => accepted.includes(l.location_id),
    busy: false,
    onAccept: vi.fn(),
    onReject: vi.fn(),
  });

  it("mỗi đề xuất một thanh Đồng ý / Bỏ, đặt ngay trước chỗ đổi đầu tiên của nó (đoạn, dòng bảng xoá, mục danh sách xoá)", async () => {
    const d = decide(["L002", "L003", "L004", "L005"].map((id) => location(id)));
    const { container } = render({ decide: d });
    await screen.findByText("Đoạn mới thêm");
    const bars = screen.getAllByTestId("cr-doc-decision");
    expect(bars).toHaveLength(4);
    // L002 có cả đoạn sửa lẫn dòng bảng sửa ⇒ chỉ một thanh, ở chỗ đầu tiên (trước đoạn sửa)
    const modified = container.querySelector('[data-location-id="L002"]');
    expect(bars[0].compareDocumentPosition(modified as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Dòng bảng bị xoá: thanh nằm ở dòng ngay trên
    const removedRow = container.querySelector('tr[data-location-id="L003"]');
    expect(removedRow?.previousElementSibling).toContainElement(bars[2]);

    fireEvent.click(within(bars[2]).getByRole("button", { name: /^Đồng ý/ }));
    expect(d.onAccept).toHaveBeenCalledWith(expect.objectContaining({ location_id: "L003" }));
    fireEvent.click(within(bars[3]).getByRole("button", { name: /^Bỏ/ }));
    expect(d.onReject).toHaveBeenCalledWith(expect.objectContaining({ location_id: "L005" }));
  });

  it("đã đồng ý ⇒ nhãn thay cho nút; phần phải quyết riêng (trượt kiểm, hình gốc) không có nút trên tài liệu", async () => {
    const failing = location("L003", { verify: { code_ok: false } as CrLocation["verify"] });
    const diagram = location("L004", { found_by: ["diagram"] });
    render({ decide: decide([location("L002"), failing, diagram, location("L005")], ["L002"]) });
    await screen.findByText("Đoạn mới thêm");
    const bars = screen.getAllByTestId("cr-doc-decision");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveTextContent("Đã đồng ý");
    expect(within(bars[0]).queryByRole("button")).toBeNull();
  });

  it("không truyền decide ⇒ không có nút nào (chế độ chỉ xem)", async () => {
    render();
    await screen.findByText("Đoạn mới thêm");
    expect(screen.queryAllByTestId("cr-doc-decision")).toHaveLength(0);
  });

  it("truyền proposalCount ⇒ tiêu đề đếm theo đề xuất, cùng đơn vị với khung chat", async () => {
    render({ proposalCount: 10 });
    await screen.findByText("Đoạn mới thêm");
    expect(screen.getByText("CR-004 · 10 đề xuất")).toBeInTheDocument();
  });
});

describe("crProposalsKey", () => {
  const loc = (ops: unknown[], conclusion: "edit" | "comment" = "edit") =>
    ({ location_id: "L1", conclusion, proposal: { old_text: "", new_text: null, comment_text: null, spine_ops: ops, assumptions: [] } }) as never;
  it("đổi khi đề xuất hoặc kết luận đổi, giữ nguyên khi không đổi", () => {
    const a = crProposalsKey([loc([{ op: "remove", path: "x" }])]);
    expect(crProposalsKey([loc([{ op: "remove", path: "x" }])])).toBe(a);
    expect(crProposalsKey([loc([{ op: "remove", path: "y" }])])).not.toBe(a);
    expect(crProposalsKey([loc([{ op: "remove", path: "x" }], "comment")])).not.toBe(a);
  });
});
