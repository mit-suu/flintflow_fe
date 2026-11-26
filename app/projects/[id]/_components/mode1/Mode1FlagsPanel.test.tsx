/**
 * Cột cờ của mode 1 v3 (bám BPMN — Flow 1 ⇒ 3.1, Flow 6): cờ đỏ chặn release, mỗi cờ đỏ có lối **Tạo CR** mở form 3.1
 * điền sẵn nguồn gap report; không còn chạy / mở lại step, không waive, không ký baseline v1.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import type { Flag } from "@/types/spine";
import Mode1FlagsPanel from "./Mode1FlagsPanel";
import { readChatCrDraft } from "./prefill";

const P = "p1";

const flag = (id: string, over: Partial<Flag> = {}): Flag => ({
  id,
  level: "red",
  rule_id: "section_empty",
  section_id: "fixed:5.1",
  target_id: null,
  message: "Business Rules trống",
  remediation_step: "S-7.1",
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
  ...over,
});

describe("Mode1FlagsPanel", () => {
  it("cờ đỏ ⇒ link Tạo CR mở form 3.1 điền sẵn nguồn gap report + mục của cờ", () => {
    renderWithIntl(<Mode1FlagsPanel projectId={P} flags={[flag("F1")]} />);
    const list = screen.getByRole("region", { name: "Cờ đỏ đang chặn release" });
    expect(within(list).getByText("Cờ đỏ đang chặn release (1)")).toBeInTheDocument();
    const link = within(list).getByRole("link", { name: "Tạo CR" });
    const href = link.getAttribute("href")!;
    expect(href.startsWith(`/projects/${P}?crdraft=1&`)).toBe(true);
    const prefill = readChatCrDraft(new URLSearchParams(href.split("?")[1]));
    expect(prefill).toMatchObject({ source: "gap_report", ref: "5.1 Business Rules" });
    expect(prefill?.text.split("\n")[0]).toContain("Business Rules trống");
    expect(prefill?.text).toContain("Mục còn trống, mục 5.1 Business Rules");
    expect(prefill?.text).not.toContain("section_empty");
    expect(within(list).getByText("Mục còn trống")).toHaveAttribute("title", "section_empty");
  });

  it("không còn nút chạy / mở lại step, waive hay ký v1", () => {
    renderWithIntl(<Mode1FlagsPanel projectId={P} flags={[flag("F1"), flag("F2", { rule_id: "unconfirmed_assumption" })]} />);
    expect(screen.queryByRole("button", { name: /Chạy|Mở lại|Waive|Ký baseline/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Tạo CR" })).toHaveLength(2);
  });

  it("cờ đã đóng / cờ vàng không chặn; hết cờ đỏ ⇒ báo không còn", () => {
    renderWithIntl(
      <Mode1FlagsPanel
        projectId={P}
        flags={[flag("F1", { resolved_at: "2026-09-22T00:00:00.000Z" }), flag("F2", { level: "yellow", rule_id: "ambiguity" })]}
      />
    );
    expect(screen.getByText("Không còn cờ đỏ nào.")).toBeInTheDocument();
    expect(screen.getByText(/1 cờ vàng - không chặn release/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo CR" })).not.toBeInTheDocument();
  });
});

describe("Mode1FlagsPanel - Viewer (readOnly)", () => {
  it("vẫn liệt kê cờ đỏ nhưng không có lối Tạo CR", () => {
    renderWithIntl(<Mode1FlagsPanel projectId={P} flags={[flag("F1")]} readOnly />);
    const list = screen.getByRole("region", { name: "Cờ đỏ đang chặn release" });
    expect(within(list).getByText("Cờ đỏ đang chặn release (1)")).toBeInTheDocument();
    expect(within(list).queryByRole("link", { name: "Tạo CR" })).not.toBeInTheDocument();
  });

  it("mẫu cố định: mục của mẫu còn trống (cờ vàng) được liệt kê kèm Tạo CR, không gộp vào dòng đếm cờ vàng", () => {
    renderWithIntl(
      <Mode1FlagsPanel
        projectId={P}
        flags={[
          flag("y1", { level: "yellow", rule_id: "template_section_empty", section_id: "custom:CS02", message: "Mục \"1.4 References\" của mẫu chưa có nội dung" }),
          flag("y2", { level: "yellow", rule_id: "unconfirmed_assumption", message: "Giả định chưa xác nhận" }),
        ]}
      />
    );
    const list = screen.getByRole("region", { name: "Mục của mẫu còn trống" });
    expect(within(list).getByText(/1\.4 References/)).toBeInTheDocument();
    expect(within(list).getByText("Mục của mẫu còn trống")).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "Tạo CR" })).toBeInTheDocument();
    expect(screen.getByText(/^1 cờ vàng/)).toBeInTheDocument();
  });

  it("chỉ xem (Viewer) ⇒ mục mẫu trống vẫn liệt kê nhưng không có nút Tạo CR", () => {
    renderWithIntl(<Mode1FlagsPanel projectId={P} readOnly flags={[flag("y1", { level: "yellow", rule_id: "template_section_empty" })]} />);
    expect(screen.queryByRole("link", { name: "Tạo CR" })).not.toBeInTheDocument();
  });
});

describe("Mode1FlagsPanel - FLF-493 nút Vẽ lại cờ sơ đồ", () => {
  const stale = (id: string) => flag(id, { rule_id: "diagram_stale", target_id: `D${id}`, section_id: "fixed:5.1", message: "Sơ đồ chưa cập nhật" });

  it("cờ diagram_stale ⇒ có nút Vẽ lại cạnh Tạo CR; bấm gọi onRedraw đúng cờ đó", async () => {
    const onRedraw = vi.fn(async () => undefined);
    const f = stale("F1");
    renderWithIntl(<Mode1FlagsPanel projectId={P} flags={[f, flag("F2")]} onRedraw={onRedraw} />);
    const buttons = screen.getAllByRole("button", { name: "Vẽ lại" });
    expect(buttons).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: "Tạo CR" })).toHaveLength(2);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(onRedraw).toHaveBeenCalledWith([f]));
  });

  it("không truyền onRedraw hoặc Viewer (readOnly) ⇒ không có nút Vẽ lại", () => {
    const { unmount } = renderWithIntl(<Mode1FlagsPanel projectId={P} flags={[stale("F1")]} />);
    expect(screen.queryByRole("button", { name: /Vẽ lại/ })).not.toBeInTheDocument();
    unmount();
    renderWithIntl(<Mode1FlagsPanel projectId={P} flags={[stale("F1")]} readOnly onRedraw={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Vẽ lại/ })).not.toBeInTheDocument();
  });

  it("từ 2 cờ vẽ lại được ⇒ có Vẽ lại tất cả, MỘT lời gọi cho cả lô", async () => {
    const onRedraw = vi.fn(async () => undefined);
    const flags = [stale("F1"), stale("F2")];
    renderWithIntl(<Mode1FlagsPanel projectId={P} flags={flags} onRedraw={onRedraw} />);
    fireEvent.click(screen.getByRole("button", { name: "Vẽ lại tất cả" }));
    await waitFor(() => expect(onRedraw).toHaveBeenCalledTimes(1));
    expect(onRedraw).toHaveBeenCalledWith(flags);
  });

  it("báo cáo vẫn lỗi ⇒ một dòng dưới cờ", async () => {
    const f = stale("F1");
    const onRedraw = vi.fn(async () => ({ failed: [f], stillBroken: [], flagsCheckFailed: false }));
    renderWithIntl(<Mode1FlagsPanel projectId={P} flags={[f]} onRedraw={onRedraw} />);
    fireEvent.click(screen.getByRole("button", { name: "Vẽ lại" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Chưa vẽ lại được sơ đồ");
  });
});
