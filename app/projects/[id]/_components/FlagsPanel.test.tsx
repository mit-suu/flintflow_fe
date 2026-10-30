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

  it("FLF-329: cờ đỏ ⇒ 'Giữ nguyên (vẫn chặn)' gọi onKeep (không phải onWaive), modal nói rõ vẫn chặn, rồi đóng", async () => {
    const onKeep = vi.fn().mockResolvedValue(undefined);
    const onWaive = vi.fn();
    renderWithIntl(<FlagsPanel flags={[baseFlag]} onWaive={onWaive} onKeep={onKeep} onRecompute={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Giữ nguyên (vẫn chặn)" }));
    expect(await screen.findByText("Giữ nguyên vấn đề này?")).toBeInTheDocument();
    expect(screen.getByText(/vẫn chặn gửi duyệt và chốt bản/)).toBeInTheDocument();
    const textarea = screen.getByLabelText(/Lý do/);
    fireEvent.change(textarea, { target: { value: "Chấp nhận rủi ro vì phạm vi MVP hiện tại" } });

    const confirm = screen.getByRole("button", { name: "Xác nhận giữ nguyên" });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(onKeep).toHaveBeenCalledWith("FL01", "Chấp nhận rủi ro vì phạm vi MVP hiện tại"));
    expect(onWaive).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByLabelText(/Lý do/)).not.toBeInTheDocument());
  });

  it("FLF-329: cờ đỏ không có onKeep ⇒ không có nút giữ nguyên", () => {
    renderWithIntl(<FlagsPanel flags={[baseFlag]} onWaive={vi.fn()} onRecompute={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Giữ nguyên (vẫn chặn)" })).toBeNull();
  });

  it("FLF-329: cờ đỏ đã giữ nguyên vẫn nằm ở tab Cần xử lý kèm lý do, nút đổi thành sửa lý do", () => {
    const kept: Flag = { ...baseFlag, id: "FLK", rule_id: "nfr_missing_number", message: "Chưa có NFR nào", kept_reason: "Khách chốt số đo ở bản sau", kept_by: "u1", kept_at: "2026-10-26T00:00:00.000Z" };
    renderWithIntl(<FlagsPanel flags={[kept]} onKeep={vi.fn()} onRecompute={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /Cần xử lý/ })).toHaveTextContent("1");
    expect(screen.getByText(/Đã giữ nguyên: Khách chốt số đo ở bản sau/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sửa lý do giữ nguyên" })).toBeInTheDocument();
  });

  it("cờ vàng: 'Bỏ qua' gọi onWaive như cũ", async () => {
    const onWaive = vi.fn().mockResolvedValue(undefined);
    const yellow: Flag = { ...baseFlag, id: "FLY", level: "yellow", rule_id: "orphan_actor", message: "Actor Guest chưa gắn use case nào" };
    renderWithIntl(<FlagsPanel flags={[yellow]} onWaive={onWaive} onKeep={vi.fn()} onRecompute={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));
    fireEvent.change(await screen.findByLabelText(/Lý do/), { target: { value: "Chấp nhận rủi ro vì phạm vi MVP hiện tại" } });
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua vấn đề" }));
    await waitFor(() => expect(onWaive).toHaveBeenCalledWith("FLY", "Chấp nhận rủi ro vì phạm vi MVP hiện tại"));
  });

  it("lý do dưới 20 ký tự thì nút xác nhận bị khoá", async () => {
    renderWithIntl(<FlagsPanel flags={[baseFlag]} onKeep={vi.fn()} onRecompute={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Giữ nguyên (vẫn chặn)" }));
    const textarea = await screen.findByLabelText(/Lý do/);
    fireEvent.change(textarea, { target: { value: "Quá ngắn" } });

    expect(screen.getByRole("button", { name: "Xác nhận giữ nguyên" })).toBeDisabled();
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

  it("FLF-248: mục trống mà bước sở hữu đã chốt là vấn đề cần xử lý, mở được bước đó", () => {
    const onSelectStep = vi.fn();
    const empty: Flag = {
      ...baseFlag,
      id: "E9",
      rule_id: "section_empty",
      section_id: "fixed:5.2",
      message: "Mục bắt buộc fixed:5.2 chưa có dữ liệu",
      remediation_step: "S-7.2",
    };
    renderWithIntl(
      <FlagsPanel
        flags={[empty]}
        onWaive={vi.fn()}
        onRecompute={vi.fn()}
        onSelectStep={onSelectStep}
        acceptedSteps={new Set(["S-7.2"])}
        sectionLabelOf={(id) => (id === "fixed:5.2" ? "§5.2 Common Requirements" : undefined)}
      />
    );

    expect(screen.queryByText("Sẽ điền ở bước sau")).toBeNull();
    expect(screen.getByText("Mục bắt buộc còn trống")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Cần xử lý/ })).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: /Mở bước .*(S-7.2)/ }));
    expect(onSelectStep).toHaveBeenCalledWith("S-7.2");
  });

  it("tab Nên xem hiện cờ vàng, tab Đã bỏ qua hiện lý do", () => {
    const yellow: Flag = { ...baseFlag, id: "Y1", level: "yellow", rule_id: "non_english_content", message: "Có câu tiếng Việt trong §2" };
    // FLF-329: chỉ cờ vàng mới waive được ⇒ tab Đã bỏ qua chỉ còn cờ vàng
    const waived: Flag = { ...baseFlag, id: "W1", level: "yellow", rule_id: "screen_no_function", waived_by_user: true, waive_reason: "MVP chấp nhận để sau" };
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

describe("FlagsPanel — bấm chấm đỏ trên tài liệu", () => {
  const reaccept: Flag = { ...baseFlag, id: "FL20", rule_id: "section_awaiting_reaccept", section_id: "fixed:1", remediation_step: "S-1.1" };
  const other: Flag = { ...baseFlag, id: "FL21", rule_id: "section_awaiting_reaccept", section_id: "fixed:2.1", remediation_step: "S-2.1" };

  it("làm nổi bật đúng dòng của mục, KHÔNG lọc mất các vấn đề khác", () => {
    const { container } = renderWithIntl(
      <FlagsPanel flags={[reaccept, other]} onRecompute={vi.fn()} sectionLabelOf={(id) => (id === "fixed:1" ? "§1 Product Overview" : "§2.1 Actors")} focusSectionId="fixed:1" />
    );

    // Vấn đề của mục khác vẫn còn — trước đây bị lọc mất nên người dùng tưởng panel trống
    expect(screen.getByText("§2.1 Actors")).toBeInTheDocument();

    const focused = container.querySelectorAll("[data-focus-row]");
    expect(focused).toHaveLength(1);
    expect(focused[0]).toHaveTextContent("§1 Product Overview");
  });

  it("không bấm mục nào ⇒ không dòng nào nổi bật", () => {
    const { container } = renderWithIntl(<FlagsPanel flags={[reaccept, other]} onRecompute={vi.fn()} />);
    expect(container.querySelectorAll("[data-focus-row]")).toHaveLength(0);
  });
});

describe("FlagsPanel — mục của mẫu còn trống (FLF-278)", () => {
  it("cờ template_section_empty có nút Nhờ AI soạn kèm nhãn mục; cờ khác không có", () => {
    const empty: Flag = { ...baseFlag, id: "FL30", level: "yellow", rule_id: "template_section_empty", section_id: "custom:CS07", message: "Mục \"Document Conventions\" của mẫu chưa có nội dung" };
    const onDraftSection = vi.fn();
    renderWithIntl(
      <FlagsPanel
        flags={[empty, { ...baseFlag, id: "FL31", level: "yellow", rule_id: "orphan_actor", section_id: "fixed:2.1" }]}
        onRecompute={vi.fn()}
        onDraftSection={onDraftSection}
        sectionLabelOf={(id) => (id === empty.section_id ? "§1.2 Document Conventions" : undefined)}
      />
    );
    const buttons = screen.getAllByRole("button", { name: "Nhờ AI soạn" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onDraftSection).toHaveBeenCalledWith("§1.2 Document Conventions");
  });
});
