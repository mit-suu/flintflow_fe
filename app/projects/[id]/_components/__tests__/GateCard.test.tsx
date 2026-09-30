import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import GateCard, { groupSummary, joinSummaryTexts, type GateNewFlag } from "../GateCard";
import { fallbackGateMessage } from "../gate-helpers";
import type { GateAction, GateReadyEvent } from "@/types/pipeline";

const ALL: GateAction[] = ["accept", "revision", "regenerate"];

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Thêm lựa chọn" }));

describe("GateCard — tin nhắn AI + chip", () => {
  it("hiện lời AI (message_vi), chip Đúng rồi đi tiếp / Tôi muốn sửa, và không còn khung form cũ", () => {
    const payload = { type: "gate_ready", step_id: "B-0.1", actions: ALL, regenerate_used: 0, calls_used: 2, message_vi: "Mình hiểu đây là app đặt lịch khám. Bạn xem giúp nhé." } as GateReadyEvent;
    renderWithIntl(<GateCard stepId="B-0.1" actions={ALL} regenerateUsed={0} payload={payload} onAction={vi.fn()} />);

    const gate = screen.getByLabelText("Cổng chốt");
    expect(gate).toHaveTextContent("Mình hiểu đây là app đặt lịch khám. Bạn xem giúp nhé.");
    expect(screen.getByRole("button", { name: /Đúng rồi, đi tiếp/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tôi muốn sửa" })).toBeInTheDocument();
    for (const gone of [/Giai đoạn/, /AI đã ghi nhận/, /AI tự giả định/, /credit/, /B-0\.1/]) expect(gate).not.toHaveTextContent(gone);
    expect(screen.queryByRole("button", { name: /Yêu cầu sửa/ })).toBeNull();
  });

  it("Đúng rồi, đi tiếp gọi onAction('accept'); Tôi muốn sửa chỉ đưa con trỏ vào ô chat", () => {
    const onAction = vi.fn();
    const onWantEdit = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={1} onWantEdit={onWantEdit} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Tôi muốn sửa" }));
    expect(onWantEdit).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Đúng rồi, đi tiếp/ }));
    expect(onAction).toHaveBeenCalledWith("accept");
  });

  it("menu ⋯: Làm lại hiện số lượt còn lại và gọi regenerate", () => {
    const onAction = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={1} onAction={onAction} />);
    openMenu();
    const regenerate = screen.getByRole("menuitem", { name: /Làm lại · còn 2 lần/ });
    expect(regenerate).not.toBeDisabled();
    fireEvent.click(regenerate);
    expect(onAction).toHaveBeenCalledWith("regenerate");
  });

  it("hết 3 lượt Làm lại ⇒ mục tắt, Duyệt như hiện tại xuất hiện; chưa hết thì không có", () => {
    const { unmount } = renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} onAction={vi.fn()} />);
    openMenu();
    expect(screen.queryByRole("menuitem", { name: /Duyệt như hiện tại/ })).not.toBeInTheDocument();
    unmount();

    renderWithIntl(<GateCard stepId="S-3.1" actions={["accept", "revision", "accept_as_is"]} regenerateUsed={3} onAction={vi.fn()} />);
    openMenu();
    expect(screen.getByRole("menuitem", { name: /Làm lại · còn 0 lần/ })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: /Duyệt như hiện tại/ })).toBeInTheDocument();
  });

  it("Duyệt như hiện tại bắt buộc lý do trước khi gửi", () => {
    const onAction = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.1" actions={["accept", "accept_as_is"]} regenerateUsed={3} onAction={onAction} />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Duyệt như hiện tại/ }));
    const confirm = screen.getByRole("button", { name: "Xác nhận duyệt như hiện tại" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lý do chấp nhận/), { target: { value: "   " } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lý do chấp nhận/), { target: { value: "Khách hàng đồng ý bản này" } });
    fireEvent.click(confirm);
    expect(onAction).toHaveBeenCalledWith("accept_as_is", "Khách hàng đồng ý bản này");
  });

  it("busy thì khoá chip chính và mục Làm lại", () => {
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} busy onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Đúng rồi, đi tiếp/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tôi muốn sửa" })).toBeDisabled();
  });

  // L11b: trước đây lô op rỗng đi tới gate y như một lượt chạy thành công — user Accept, cờ đỏ vẫn treo, bấm
  // "Mở lại" lại rơi vào đúng vòng đó cho tới khi cạn trần 8 lượt gọi model (gặp thật 2026-09-20).
  describe("cảnh báo lượt chạy không ghi được gì (L11b)", () => {
    it("lô op rỗng ⇒ nói thẳng bằng một câu, vẫn cho Duyệt", () => {
      renderWithIntl(<GateCard stepId="S-7.2" actions={ALL} regenerateUsed={0} wroteOps={false} onAction={vi.fn()} />);
      expect(screen.getByRole("status")).toHaveTextContent("AI không soạn được nội dung nào ở lượt này");
      expect(screen.getByRole("button", { name: /Đúng rồi, đi tiếp/ }), "vẫn là quyết định của người dùng").not.toBeDisabled();
    });

    it("AI không được gọi vì field đã chốt ở bước trước ⇒ không cảnh báo, chỉ nói lý do", () => {
      const settled = {
        type: "gate_ready",
        step_id: "B-0.2",
        actions: ALL,
        regenerate_used: 0,
        calls_used: 0,
        spine_version: 5,
        wrote_ops: false,
        empty_sections: [],
        summary: [],
        new_assumptions: [],
        no_change_reason: "Nền tảng đã chốt ở bước Kể hết ý tưởng — không cần hỏi lại.",
      } as unknown as GateReadyEvent;
      renderWithIntl(<GateCard stepId="B-0.2" actions={ALL} regenerateUsed={0} wroteOps={false} payload={settled} onAction={vi.fn()} />);
      expect(screen.queryByText(/AI không soạn được nội dung nào ở lượt này/)).not.toBeInTheDocument();
      expect(screen.getByText(/Nền tảng đã chốt ở bước Kể hết ý tưởng/)).toBeInTheDocument();
    });

    it("có ghi op nhưng mục vẫn trống ⇒ gọi tên mục, nói rõ Duyệt không đóng được cờ và chỉ lối ra", () => {
      renderWithIntl(
        <GateCard
          stepId="S-7.2"
          actions={ALL}
          regenerateUsed={0}
          wroteOps
          emptySections={[{ section_id: "fixed:5.2", title: "Common Requirements" }]}
          onAction={vi.fn()}
        />
      );
      const banner = screen.getByRole("status");
      expect(banner).toHaveTextContent("Chạy xong nhưng mục vẫn trống");
      expect(banner).toHaveTextContent("Common Requirements");
      expect(banner, "không lộ mã mục nội bộ").not.toHaveTextContent("fixed:5.2");
      expect(banner, "phải chỉ lối ra, không chỉ báo lỗi").toHaveTextContent(/bỏ qua cờ|chat/i);
    });

    it("chạy bình thường thì không có cảnh báo nào", () => {
      renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} wroteOps emptySections={[]} onAction={vi.fn()} />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});

describe("GateCard — dự án cũ chưa có message_vi", () => {
  const payload: GateReadyEvent = {
    type: "gate_ready",
    step_id: "S-4.3",
    actions: ["accept", "revision", "regenerate"],
    regenerate_used: 0,
    calls_used: 3,
    summary: [
      { kind: "add", collection: "permissions", id: "P010", title_vi: "Admin tạo trên Manage Staff" },
      { kind: "add", collection: "permissions", id: "P011", title_vi: "Admin xoá trên Manage Staff" },
      { kind: "update", collection: "functions", id: "FN005", title_vi: "Check In Patient · name" },
    ],
    new_assumptions: [{ id: "AS12", text: "Lễ tân không được xoá lịch hẹn" }],
    flags: { red: 2, yellow: 5, red_delta: -1, yellow_delta: 0 },
    duration_ms: 58_000,
    credits_used: 4,
    doc_progress: { before: 44, after: 46 },
  };

  it("dựng một câu tạm từ tóm tắt; không hiện giả định, credit, số cờ hay thời gian", () => {
    renderWithIntl(<GateCard stepId="S-4.3" actions={ALL} regenerateUsed={0} payload={payload} onAction={vi.fn()} />);
    const gate = screen.getByLabelText("Cổng chốt");
    expect(gate).toHaveTextContent(/Tôi đã cập nhật: thêm 2 quyền \(Admin tạo trên Manage Staff; Admin xoá trên Manage Staff\), sửa 1 chức năng/);
    expect(gate).toHaveTextContent("Bạn xem giúp, ổn thì mình đi tiếp nhé.");
    expect(screen.queryByText(/credit/)).toBeNull();
    expect(screen.queryByText(/Lễ tân không được xoá/)).toBeNull();
    expect(screen.queryByText(/cờ đỏ/)).toBeNull();
    expect(screen.queryByText(/giây/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Đúng" })).toBeNull();
  });

  it("field dự án dịch sang lời thường; giả định không kể lần hai", () => {
    expect(
      fallbackGateMessage([
        { kind: "update", collection: "project", id: null, title_vi: "complexity: small" },
        { kind: "add", collection: "assumptions", id: "AS3", title_vi: "Small internal tool" },
      ])
    ).toBe("Tôi đã cập nhật: sửa 1 thông tin dự án (Độ phức tạp: Nhỏ). Bạn xem giúp, ổn thì mình đi tiếp nhé.");
  });

  it("chỉ có giả định hoặc không có gì ⇒ vẫn là một câu đọc được", () => {
    expect(fallbackGateMessage([])).toBe("Tôi đã xong bước này. Bạn xem giúp, ổn thì mình đi tiếp nhé.");
    expect(fallbackGateMessage([{ kind: "add", collection: "assumptions", id: "AS3", title_vi: "X" }])).toMatch(/^Tôi đã xong bước này/);
  });

  it("Duyệt vẫn xác nhận các giả định mới trước khi chốt bước (chưa có ô Đúng/Sửa/Bỏ)", async () => {
    const onConfirmAssumptions = vi.fn().mockResolvedValue(undefined);
    const onAction = vi.fn();
    const brief: GateReadyEvent = {
      ...payload,
      new_assumptions: [
        { id: "AS1", text: "A" },
        { id: "AS2", text: "B" },
      ],
    };
    renderWithIntl(
      <GateCard
        stepId="B-0.1"
        actions={ALL}
        regenerateUsed={0}
        payload={brief}
        settledAssumptionIds={new Set(["AS2"])}
        onConfirmAssumptions={onConfirmAssumptions}
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Đúng rồi, đi tiếp/ }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith("accept"));
    // AS2 đã chốt ở Spine ⇒ không gửi lại; chỉ xác nhận đúng giả định tin của cổng đã nói
    expect(onConfirmAssumptions).toHaveBeenCalledWith(["AS1"]);
  });

  it("cổng cuối giai đoạn: chỉ xác nhận giả định của tin cổng, không kéo theo giả định khác đang treo", async () => {
    const onConfirmAssumptions = vi.fn().mockResolvedValue(undefined);
    const onAction = vi.fn();
    renderWithIntl(
      <GateCard
        stepId="B-1.6"
        actions={ALL}
        regenerateUsed={0}
        phaseSummary={[]}
        message="Tôi tạm hiểu là không gửi SMS."
        payload={{ ...payload, new_assumptions: [{ id: "AS-STEP", text: "Của bước cuối" }] }}
        spokenAssumptions={[{ id: "AS3", text: "Không SMS" }, { id: "AS4", text: "BHYT tại viện" }]}
        onConfirmAssumptions={onConfirmAssumptions}
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Đúng rồi, đi tiếp/ }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith("accept"));
    expect(onConfirmAssumptions).toHaveBeenCalledWith(["AS3", "AS4"]);
  });

  it("không có giả định nào được nói ⇒ Accept không ghi xác nhận nào", async () => {
    const onConfirmAssumptions = vi.fn().mockResolvedValue(undefined);
    const onAction = vi.fn();
    renderWithIntl(
      <GateCard stepId="B-1.2" actions={ALL} regenerateUsed={0} payload={{ ...payload, new_assumptions: [] }} onConfirmAssumptions={onConfirmAssumptions} onAction={onAction} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Đúng rồi, đi tiếp/ }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith("accept"));
    expect(onConfirmAssumptions).not.toHaveBeenCalled();
  });

  it("bấm Đúng rồi 2 lần trong lúc chờ xác nhận giả định ⇒ chỉ một lượt Duyệt, chip khoá", async () => {
    let release: () => void = () => undefined;
    const onConfirmAssumptions = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const onAction = vi.fn();
    const brief: GateReadyEvent = { ...payload, new_assumptions: [{ id: "AS1", text: "A" }] };
    renderWithIntl(
      <GateCard stepId="B-1.2" actions={ALL} regenerateUsed={0} payload={brief} onConfirmAssumptions={onConfirmAssumptions} onAction={onAction} />
    );
    const accept = screen.getByRole("button", { name: /Đúng rồi, đi tiếp/ });
    fireEvent.click(accept);
    fireEvent.click(accept);
    await waitFor(() => expect(accept).toBeDisabled());
    release();
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    expect(onConfirmAssumptions).toHaveBeenCalledTimes(1);
  });

  it("step không đổi gì thì nói rõ vì sao trong lời AI", () => {
    renderWithIntl(
      <GateCard
        stepId="S-5.3@S03"
        actions={ALL}
        regenerateUsed={0}
        payload={{ ...payload, summary: [], new_assumptions: [], no_change_reason: "Bước sổ sách của vòng màn hình — không có nội dung để ghi." }}
        onAction={vi.fn()}
      />
    );
    expect(screen.getByText(/không thay đổi tài liệu/)).toBeInTheDocument();
  });

  it("groupSummary gộp theo loại thay đổi và collection", () => {
    expect(groupSummary(payload.summary ?? []).map((g) => g.label)).toEqual(["+2 quyền", "~1 chức năng"]);
  });

  it("nối tóm tắt: bỏ dấu câu cuối mỗi mục, nối bằng '; '", () => {
    expect(joinSummaryTexts(["Tuân thủ quy định nhà nước.", "Từ 50 người dùng,", "  ", "Bảo mật;"])).toBe(
      "Tuân thủ quy định nhà nước; Từ 50 người dùng; Bảo mật"
    );
  });
});

describe("GateCard — cờ và bảng", () => {
  it("cờ đỏ chặn baseline ⇒ một câu + chip Xem chỗ bị chặn dẫn tới step xử lý", () => {
    const onGoToStep = vi.fn();
    renderWithIntl(
      <GateCard
        stepId="S-9.5"
        actions={ALL}
        regenerateUsed={0}
        blockingFlags={[{ id: "FL031", message: "Giả định AS28 chưa được xác nhận", remediation_step: "S-9.1" }]}
        onGoToStep={onGoToStep}
        onAction={vi.fn()}
      />
    );
    expect(screen.getByText(/còn 1 cờ đỏ chưa xử lý/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Xem chỗ bị chặn/ }));
    expect(onGoToStep).toHaveBeenCalledWith("S-9.1");
    // Chip Duyệt không bị chặn: BE vẫn là nơi quyết định
    expect(screen.getByRole("button", { name: /Đúng rồi, đi tiếp/ })).not.toBeDisabled();
  });

  const flag: GateNewFlag = { id: "FL07", level: "red", message: "Use case UC03 chưa có chức năng", waivable: true };

  it("cờ mới: câu nêu cờ + Sửa theo đề xuất gọi onFixFlag", () => {
    const onFixFlag = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.5" actions={ALL} regenerateUsed={0} newFlags={[flag]} onFixFlag={onFixFlag} onKeepFlag={vi.fn()} onAction={vi.fn()} />);
    expect(screen.getByText(/Vấn đề cần xử lý:/)).toBeInTheDocument();
    expect(screen.getByText(/Use case UC03 chưa có chức năng/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sửa theo đề xuất" }));
    expect(onFixFlag).toHaveBeenCalledWith(flag);
  });

  it("Giữ nguyên mở ô lý do (≥ 20 ký tự) rồi mới waive; lỗi hiện ngay dưới chip", async () => {
    const onKeepFlag = vi.fn().mockRejectedValueOnce(new Error("Không bỏ qua được")).mockResolvedValueOnce(undefined);
    renderWithIntl(<GateCard stepId="S-3.5" actions={ALL} regenerateUsed={0} newFlags={[flag]} onFixFlag={vi.fn()} onKeepFlag={onKeepFlag} onAction={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Giữ nguyên" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận giữ nguyên" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Vì sao bạn muốn giữ nguyên/), { target: { value: "ngắn quá" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Vì sao bạn muốn giữ nguyên/), { target: { value: "Use case này để dành cho giai đoạn sau" } });
    fireEvent.click(confirm);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không bỏ qua được");
    expect(onKeepFlag).toHaveBeenCalledWith(flag, "Use case này để dành cho giai đoạn sau");

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận giữ nguyên" }));
    await waitFor(() => expect(screen.queryByLabelText(/Vì sao bạn muốn giữ nguyên/)).toBeNull());
  });

  it("cờ không waive được ⇒ chỉ có Sửa theo đề xuất", () => {
    renderWithIntl(
      <GateCard stepId="S-3.5" actions={ALL} regenerateUsed={0} newFlags={[{ ...flag, waivable: false }]} onFixFlag={vi.fn()} onKeepFlag={vi.fn()} onAction={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: "Giữ nguyên" })).toBeNull();
  });

  it("bảng thu gọn dưới tin, mở khi bấm", () => {
    const payload = {
      type: "gate_ready",
      step_id: "S-9.4",
      actions: ALL,
      regenerate_used: 0,
      calls_used: 1,
      summary: [],
      table: { title_vi: "Ưu tiên MoSCoW", columns: ["Yêu cầu", "Mức"], rows: [["Đặt lịch", "Must"]], truncated: 2 },
    } as unknown as GateReadyEvent;
    renderWithIntl(<GateCard stepId="S-9.4" actions={ALL} regenerateUsed={0} payload={payload} onAction={vi.fn()} />);
    expect(screen.getByText(/Xem bảng: Ưu tiên MoSCoW \(3 dòng\)/)).toBeInTheDocument();
    expect(screen.getByText("Must")).toBeInTheDocument();
    expect(screen.getByText(/và 2 dòng nữa/)).toBeInTheDocument();
  });

  it("bảng S-1.1 (Brief của bạn | Bản đưa vào SRS) mở sẵn", () => {
    const payload = {
      type: "gate_ready",
      step_id: "S-1.1",
      actions: ALL,
      regenerate_used: 0,
      calls_used: 1,
      summary: [],
      table: { title_vi: "Tầm nhìn và mục tiêu", columns: ["Brief của bạn", "Bản đưa vào SRS"], rows: [["Ứng dụng đặt lịch khám", "Appointment booking app"]], truncated: 0 },
    } as unknown as GateReadyEvent;
    const { container } = renderWithIntl(<GateCard stepId="S-1.1" actions={ALL} regenerateUsed={0} payload={payload} onAction={vi.fn()} />);
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(screen.getByText("Bản đưa vào SRS")).toBeInTheDocument();
    expect(screen.getByText("Appointment booking app")).toBeInTheDocument();
  });

  it("cổng cuối giai đoạn dùng message của giai đoạn, không lấy lời của bước cuối", () => {
    const stepGate = { type: "gate_ready", step_id: "S-3.6", actions: ALL, regenerate_used: 0, calls_used: 1, message_vi: "Lời của bước cuối" } as GateReadyEvent;
    renderWithIntl(
      <GateCard
        stepId="S-3.6"
        actions={ALL}
        regenerateUsed={0}
        payload={stepGate}
        phaseSummary={[{ kind: "add", collection: "actors", id: "A01", title_vi: "Bệnh nhân" }]}
        message="Xong phần Người dùng rồi, bạn xem giúp nhé."
        onAction={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Cổng chốt")).toHaveTextContent("Xong phần Người dùng rồi");
    expect(screen.queryByText(/Lời của bước cuối/)).toBeNull();

    // Giai đoạn cũ chưa có message_vi ⇒ câu tạm dựng từ tóm tắt cả giai đoạn
    renderWithIntl(<GateCard stepId="S-3.6" actions={ALL} regenerateUsed={0} payload={stepGate} phaseSummary={[{ kind: "add", collection: "actors", id: "A01", title_vi: "Bệnh nhân" }]} onAction={vi.fn()} />);
    expect(screen.getAllByLabelText("Cổng chốt")[1]).toHaveTextContent("thêm 1 actor (Bệnh nhân)");
  });
});
