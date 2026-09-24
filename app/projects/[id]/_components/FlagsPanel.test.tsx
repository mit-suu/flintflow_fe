"use client";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import FlagsPanel, { sortFlags } from "./FlagsPanel";
import type { Flag } from "@/types/flags";

const baseFlag: Flag = {
  id: "FL01",
  level: "red",
  rule_id: "unconfirmed_assumption",
  section_id: "fixed:5.4",
  target_id: null,
  message: "Còn assumption chưa xác nhận",
  remediation_step: "S-6.2",
  opened_at_version: 2,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
};

const notWaivableFlag: Flag = {
  ...baseFlag,
  id: "FL02",
  rule_id: "dead_reference",
  message: "Tham chiếu chết tới F01",
};

describe("FlagsPanel", () => {
  it("vấn đề cần sửa: câu vấn đề + tên mục đọc được; bấm mũi tên mở đúng bước", () => {
    const flag: Flag = { ...baseFlag, id: "FL05", rule_id: "nfr_missing_number", message: "Chưa có NFR reliability nào", section_id: "fixed:4.2.2" };
    const onSelectStep = vi.fn();
    renderWithIntl(
      <FlagsPanel
        flags={[flag]}
        onWaive={vi.fn()}
        onRecompute={vi.fn()}
        onSelectStep={onSelectStep}
        sectionLabelOf={(id) => (id === "fixed:4.2.2" ? "§4.2.2 Reliability" : undefined)}
      />
    );

    expect(screen.getByText("Cần bạn sửa nội dung")).toBeInTheDocument();
    expect(screen.getByText("Chưa có NFR reliability nào")).toBeInTheDocument();
    expect(screen.getByText("§4.2.2 Reliability")).toBeInTheDocument();
    // Không lộ mã luật / mã mục nội bộ
    expect(screen.queryByText("nfr_missing_number")).toBeNull();
    expect(screen.queryByText("fixed:4.2.2")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Mở bước .*(S-6.2)/ }));
    expect(onSelectStep).toHaveBeenCalledWith("S-6.2");
  });

  it("luật không bỏ qua được (dead_reference) không có nút Bỏ qua", () => {
    renderWithIntl(<FlagsPanel flags={[notWaivableFlag]} onWaive={vi.fn()} onRecompute={vi.fn()} />);
    expect(screen.getByText("Tham chiếu chết tới F01")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bỏ qua" })).toBeNull();
  });

  it("bỏ qua hợp lệ (>= 20 ký tự) gọi onWaive rồi đóng modal", async () => {
    const onWaive = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(<FlagsPanel flags={[baseFlag]} onWaive={onWaive} onRecompute={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));
    const textarea = await screen.findByLabelText(/Lý do/);
    fireEvent.change(textarea, { target: { value: "Chấp nhận rủi ro vì phạm vi MVP hiện tại" } });

    const confirm = screen.getByRole("button", { name: "Bỏ qua vấn đề" });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(onWaive).toHaveBeenCalledWith("FL01", "Chấp nhận rủi ro vì phạm vi MVP hiện tại"));
    await waitFor(() => expect(screen.queryByLabelText(/Lý do/)).not.toBeInTheDocument());
  });

  it("lý do dưới 20 ký tự thì nút xác nhận bị khoá", async () => {
    renderWithIntl(<FlagsPanel flags={[baseFlag]} onWaive={vi.fn()} onRecompute={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));
    const textarea = await screen.findByLabelText(/Lý do/);
    fireEvent.change(textarea, { target: { value: "Quá ngắn" } });

    expect(screen.getByRole("button", { name: "Bỏ qua vấn đề" })).toBeDisabled();
  });

  it("bấm Kiểm tra lại gọi onRecompute", () => {
    const onRecompute = vi.fn();
    renderWithIntl(<FlagsPanel flags={[]} onWaive={vi.fn()} onRecompute={onRecompute} />);

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại toàn bộ tài liệu" }));
    expect(onRecompute).toHaveBeenCalledTimes(1);
  });

  it("không có cờ mở thì hiện thông báo trống", () => {
    renderWithIntl(<FlagsPanel flags={[]} onWaive={vi.fn()} onRecompute={vi.fn()} />);
    expect(screen.getByText("Không còn vấn đề nào chặn việc chốt bản.")).toBeInTheDocument();
  });

  it("mục trống vì bước chưa chạy: gom theo bước, không lặp mục, không tính vào số trên tab", () => {
    const empty = (id: string, rule: string, section: string, step: string): Flag => ({
      ...baseFlag,
      id,
      rule_id: rule,
      section_id: section,
      message: `${section} rỗng`,
      remediation_step: step,
    });
    renderWithIntl(
      <FlagsPanel
        flags={[
          empty("E1", "section_empty", "fixed:3.1.2", "S-4.1"),
          empty("E2", "array_empty", "fixed:3.1.2", "S-4.1"),
          empty("E3", "section_empty", "fixed:3.1.1", "S-4.2"),
        ]}
        onWaive={vi.fn()}
        onRecompute={vi.fn()}
        sectionLabelOf={(id) => ({ "fixed:3.1.2": "§3.1.2 Screen Descriptions", "fixed:3.1.1": "§3.1.1 Screens Flow" })[id]}
      />
    );

    expect(screen.getByText("Sẽ điền ở bước sau")).toBeInTheDocument();
    // 2 mục · 2 bước ⇒ chỉ ghi một số
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getAllByText("§3.1.2 Screen Descriptions")).toHaveLength(1);
    // Không phải lỗi ⇒ không có nút Bỏ qua, tab "Cần xử lý" đếm 0
    expect(screen.queryByRole("button", { name: "Bỏ qua" })).toBeNull();
    expect(screen.getByRole("tab", { name: /Cần xử lý/ })).toHaveTextContent("0");
  });

  it("tab Nên xem hiện cờ vàng, tab Đã bỏ qua hiện lý do", () => {
    const yellow: Flag = { ...baseFlag, id: "Y1", level: "yellow", rule_id: "non_english_content", message: "Có câu tiếng Việt trong §2" };
    const waived: Flag = { ...baseFlag, id: "W1", waived_by_user: true, waive_reason: "MVP chấp nhận để sau" };
    renderWithIntl(<FlagsPanel flags={[yellow, waived]} onWaive={vi.fn()} onRecompute={vi.fn()} />);

    // Không còn cờ đỏ mở ⇒ mở sẵn tab Nên xem
    expect(screen.getByText("Có câu tiếng Việt trong §2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Đã bỏ qua/ }));
    expect(screen.getByText(/MVP chấp nhận để sau/)).toBeInTheDocument();
  });
});

describe("FlagsPanel — FLF-198", () => {
  it("nhiều giả định chưa xác nhận ⇒ có nút Đúng hết gửi đủ id trong một lượt", () => {
    const assumption = (id: string): Flag => ({
      ...baseFlag,
      id: `FL-${id}`,
      rule_id: "unconfirmed_assumption",
      target_id: id,
      level: "red"
    });
    const onConfirmAllAssumptions = vi.fn();
    renderWithIntl(
      <FlagsPanel
        flags={[assumption("AS1"), assumption("AS2"), assumption("AS3")]}
        onWaive={vi.fn()}
        onRecompute={vi.fn()}
        onConfirmAllAssumptions={onConfirmAllAssumptions}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Đúng hết" }));
    expect(onConfirmAllAssumptions).toHaveBeenCalledWith(["AS1", "AS2", "AS3"]);
  });

  it("chỉ một giả định ⇒ không hiện nút gộp, tránh thêm một nút thừa", () => {
    renderWithIntl(
      <FlagsPanel
        flags={[{ ...baseFlag, rule_id: "unconfirmed_assumption", target_id: "AS1" }]}
        onWaive={vi.fn()}
        onRecompute={vi.fn()}
        onConfirmAllAssumptions={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: /Đúng hết/ })).toBeNull();
  });
});

describe("FlagsPanel — FLF-177", () => {
  const yellow: Flag = { ...baseFlag, id: "FL10", level: "yellow", rule_id: "orphan_actor", message: "Actor lẻ", remediation_step: "S-3.2" };
  const stale: Flag = { ...baseFlag, id: "FL11", rule_id: "diagram_stale", target_id: "D05", message: "Hình D05 không còn khớp dữ liệu", remediation_step: "S-5.3@S03" };

  it("BUG-34: cờ đỏ luôn đứng trước cờ vàng, rồi tới thứ tự step", () => {
    expect(sortFlags([yellow, stale, baseFlag]).map((f) => f.id)).toEqual(["FL11", "FL01", "FL10"]);
  });

  it("BUG-17: cờ về sơ đồ có nút Vẽ lại; cờ khác thì không", async () => {
    const onRedraw = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(<FlagsPanel flags={[stale, yellow]} onWaive={vi.fn()} onRecompute={vi.fn()} onRedraw={onRedraw} />);

    const redraw = screen.getAllByRole("button", { name: "Vẽ lại" });
    expect(redraw).toHaveLength(1);
    fireEvent.click(redraw[0]);
    await waitFor(() => expect(onRedraw).toHaveBeenCalledWith(stale));
  });
});
