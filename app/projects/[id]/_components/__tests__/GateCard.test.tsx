import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import GateCard, { groupSummary, joinSummaryTexts } from "../GateCard";
import type { GateAction, GateReadyEvent } from "@/types/pipeline";

const ALL: GateAction[] = ["accept", "revision", "regenerate"];

describe("GateCard", () => {
  it("Duyệt gọi onAction ngay; Làm lại hiện số lượt còn lại", () => {
    const onAction = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={1} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: /Duyệt, sang bước tiếp/ }));
    expect(onAction).toHaveBeenCalledWith("accept");

    const regenerate = screen.getByRole("button", { name: /Làm lại · còn 2 lần/ });
    expect(regenerate).not.toBeDisabled();
    fireEvent.click(regenerate);
    expect(onAction).toHaveBeenCalledWith("regenerate");
  });

  it("hết 3 lượt Làm lại ⇒ nút tắt, Duyệt như hiện tại xuất hiện", () => {
    renderWithIntl(<GateCard stepId="S-3.1" actions={["accept", "revision", "accept_as_is"]} regenerateUsed={3} onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Làm lại · còn 0 lần/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duyệt như hiện tại" })).toBeInTheDocument();
  });

  it("chưa hết Làm lại thì không hiện Duyệt như hiện tại", () => {
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} onAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Duyệt như hiện tại" })).not.toBeInTheDocument();
  });

  it("Duyệt như hiện tại bắt buộc lý do trước khi gửi", () => {
    const onAction = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.1" actions={["accept", "accept_as_is"]} regenerateUsed={3} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Duyệt như hiện tại" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận duyệt như hiện tại" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lý do chấp nhận/), { target: { value: "   " } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lý do chấp nhận/), { target: { value: "Khách hàng đồng ý bản này" } });
    fireEvent.click(confirm);
    expect(onAction).toHaveBeenCalledWith("accept_as_is", "Khách hàng đồng ý bản này");
  });

  it("Yêu cầu sửa cần ghi chú", () => {
    const onAction = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: /Yêu cầu sửa/ }));
    fireEvent.change(screen.getByLabelText("Cần sửa gì?"), { target: { value: "Thiếu actor Guest" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu sửa" }));
    expect(onAction).toHaveBeenCalledWith("revision", "Thiếu actor Guest");
  });

  it("busy thì khoá mọi hành động", () => {
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} busy onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Duyệt, sang bước tiếp/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Làm lại/ })).toBeDisabled();
  });

  // L11b: trước đây lô op rỗng đi tới gate y như một lượt chạy thành công — user Accept, cờ đỏ vẫn treo, bấm
  // "Mở lại" lại rơi vào đúng vòng đó cho tới khi cạn trần 8 lượt gọi model (gặp thật 2026-09-20).
  describe("cảnh báo lượt chạy không ghi được gì (L11b)", () => {
    it("lô op rỗng ⇒ nói thẳng, vẫn cho Duyệt", () => {
      renderWithIntl(<GateCard stepId="S-7.2" actions={ALL} regenerateUsed={0} wroteOps={false} onAction={vi.fn()} />);
      expect(screen.getByRole("status")).toHaveTextContent("AI không soạn được nội dung nào ở lượt này");
      expect(screen.getByRole("button", { name: /Duyệt, sang bước tiếp/ }), "vẫn là quyết định của người dùng").not.toBeDisabled();
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
      expect(screen.queryByText("AI không soạn được nội dung nào ở lượt này")).not.toBeInTheDocument();
      expect(screen.getByText(/Nền tảng đã chốt ở bước Kể hết ý tưởng/)).toBeInTheDocument();
    });

    it("có ghi op nhưng mục vẫn trống ⇒ gọi tên mục và nói rõ Duyệt không đóng được cờ", () => {
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
      expect(banner).toHaveTextContent("fixed:5.2");
      expect(banner, "phải chỉ lối ra, không chỉ báo lỗi").toHaveTextContent(/waive|chat/i);
    });

    it("chạy bình thường thì không có cảnh báo nào", () => {
      renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} wroteOps emptySections={[]} onAction={vi.fn()} />);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});

describe("GateCard — Lớp 4 \"Bạn vừa có\" (WP-5)", () => {
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

  it("hiện nội dung vừa ghi, chênh lệch cờ và credit — không hiện thời gian (gồm cả lúc chờ user)", () => {
    renderWithIntl(<GateCard stepId="S-4.3" actions={ALL} regenerateUsed={0} payload={payload} onAction={vi.fn()} />);
    expect(screen.getByText(/AI đã ghi nhận/)).toBeInTheDocument();
    expect(screen.getByText(/\+2 quyền/)).toBeInTheDocument();
    expect(screen.getByText(/Admin tạo trên Manage Staff/)).toBeInTheDocument();
    expect(screen.getByText(/cờ đỏ 3 → 2/)).toBeInTheDocument();
    expect(screen.getByText("4 credit")).toBeInTheDocument();
    expect(screen.queryByText(/giây/)).toBeNull();
  });

  it("field dự án dịch sang lời thường; giả định không lặp ở danh sách vừa ghi; không có gì đổi thì ẩn dòng kiểm tra", () => {
    const brief: GateReadyEvent = {
      ...payload,
      summary: [
        { kind: "update", collection: "project", id: null, title_vi: "complexity: small" },
        { kind: "add", collection: "assumptions", id: "AS3", title_vi: "Small internal tool" },
      ],
      new_assumptions: [{ id: "AS3", text: "Small internal tool" }],
      flags: { red: 0, yellow: 0, red_delta: 0, yellow_delta: 0 },
      doc_progress: { before: 0, after: 0 },
    };
    renderWithIntl(<GateCard stepId="B-0.2" actions={ALL} regenerateUsed={0} payload={brief} onAction={vi.fn()} />);
    expect(screen.getByText(/Độ phức tạp: Nhỏ/)).toBeInTheDocument();
    expect(screen.queryByText(/\+1 giả định/)).toBeNull();
    expect(screen.getAllByText("Small internal tool")).toHaveLength(1);
    expect(screen.queryByText("AS3")).toBeNull();
    expect(screen.queryByText(/Kiểm tra:/)).toBeNull();
  });

  it("giả định mới có ba nút Đúng / Sửa / Bỏ; Sửa xong vẫn hiện câu mới với nhãn Đã sửa", async () => {
    const onAssumptionDecision = vi.fn();
    renderWithIntl(
      <GateCard stepId="S-4.3" actions={ALL} regenerateUsed={0} payload={payload} onAssumptionDecision={onAssumptionDecision} onAction={vi.fn()} />
    );
    expect(screen.getByText(/AI tự giả định/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Sửa giả định AS12"), { target: { value: "Lễ tân được xoá lịch trong ngày" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(onAssumptionDecision).toHaveBeenCalledWith({ kind: "edit", id: "AS12", statement: "Lễ tân được xoá lịch trong ngày" });
    // "Sửa" chờ BE dịch bản sửa xong rồi mới đổi dòng: giả định không biến mất, hiện câu mới, hết nút quyết
    await waitFor(() => expect(screen.getByText("Đã sửa:")).toBeInTheDocument());
    expect(screen.getByText("Lễ tân được xoá lịch trong ngày")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đúng" })).toBeNull();
  });

  it("giả định về nền tảng: Sửa mở danh sách lựa chọn, chọn ⇒ quyết định pick, không mở ô gõ", async () => {
    const onAssumptionDecision = vi.fn().mockResolvedValue(true);
    const brief: GateReadyEvent = {
      ...payload,
      summary: [{ kind: "update", collection: "project", id: null, title_vi: "form_factor: web_app" }],
      new_assumptions: [{ id: "AS1", text: "Web app", text_vi: "Nền tảng là web" }],
    };
    renderWithIntl(
      <GateCard
        stepId="B-0.1"
        actions={ALL}
        regenerateUsed={0}
        payload={brief}
        assumptionPaths={{ AS1: "project.form_factor" }}
        onAssumptionDecision={onAssumptionDecision}
        onAction={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    expect(screen.queryByLabelText("Sửa giả định AS1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mobile" }));

    expect(onAssumptionDecision).toHaveBeenCalledWith({ kind: "pick", id: "AS1", path: "project.form_factor", value: "mobile_app", label: "Mobile" });
    await waitFor(() => expect(screen.getByText("Nền tảng: Mobile")).toBeInTheDocument());
    // Giá trị cũ không còn hiện ở "AI đã ghi nhận"
    expect(screen.queryByText(/Nền tảng: Web/)).toBeNull();
  });

  it("bấm Duyệt 2 lần trong lúc chờ xác nhận giả định ⇒ chỉ một lượt Duyệt, nút khoá", async () => {
    let release: () => void = () => undefined;
    const onConfirmAssumptions = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const onAction = vi.fn();
    const brief: GateReadyEvent = { ...payload, new_assumptions: [{ id: "AS1", text: "A" }] };
    renderWithIntl(
      <GateCard stepId="B-1.2" actions={ALL} regenerateUsed={0} payload={brief} onConfirmAssumptions={onConfirmAssumptions} onAction={onAction} />
    );
    const accept = screen.getByRole("button", { name: /Duyệt, sang bước tiếp/ });
    fireEvent.click(accept);
    fireEvent.click(accept);
    await waitFor(() => expect(accept).toBeDisabled());
    release();
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    expect(onConfirmAssumptions).toHaveBeenCalledTimes(1);
  });

  it("reload: giả định trong payload đã xác nhận ở Spine không hiện lại để hỏi", () => {
    const brief: GateReadyEvent = { ...payload, new_assumptions: [{ id: "AS1", text: "Web app" }] };
    renderWithIntl(<GateCard stepId="B-0.1" actions={ALL} regenerateUsed={0} payload={brief} settledAssumptionIds={new Set(["AS1"])} onAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Đúng" })).toBeNull();
  });

  it("reload sau khi chọn Mobile: dòng tóm tắt cũ 'Nền tảng: Web' không hiện lại", () => {
    const brief: GateReadyEvent = {
      ...payload,
      summary: [{ kind: "update", collection: "project", id: null, title_vi: "form_factor: web_app" }],
      new_assumptions: [{ id: "AS1", text: "Web app", text_vi: "Nền tảng là web" }],
    };
    renderWithIntl(
      <GateCard
        stepId="B-0.1"
        actions={ALL}
        regenerateUsed={0}
        payload={brief}
        assumptionPaths={{ AS1: "project.form_factor" }}
        settledAssumptionIds={new Set(["AS1"])}
        onAction={vi.fn()}
      />
    );
    expect(screen.queryByText(/Nền tảng: Web/)).toBeNull();
  });

  it("Duyệt chỉ xác nhận giả định chưa quyết — giả định đã Sửa không gửi lại", async () => {
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
        onAssumptionDecision={vi.fn().mockResolvedValue(true)}
        onConfirmAssumptions={onConfirmAssumptions}
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Sửa" })[0]);
    fireEvent.change(screen.getByLabelText("Sửa giả định AS1"), { target: { value: "A mới" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(screen.getByText("A mới")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Duyệt, sang bước tiếp/ }));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith("accept"));
    expect(onConfirmAssumptions).toHaveBeenCalledWith(["AS2"]);
  });

  it("step không đổi gì thì nói rõ vì sao", () => {
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

  it("BUG-01: Accept ở S-9.5 bị chặn ⇒ hiện cờ đang chặn kèm lối đi tới step xử lý", () => {
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
    fireEvent.click(screen.getByRole("button", { name: /S-9.1/ }));
    expect(onGoToStep).toHaveBeenCalledWith("S-9.1");
  });

  it("groupSummary gộp theo loại thay đổi và collection", () => {
    expect(groupSummary(payload.summary ?? []).map((g) => g.label)).toEqual(["+2 quyền", "~1 chức năng"]);
  });

  it("nối tóm tắt: bỏ dấu câu cuối mỗi mục, nối bằng '; '", () => {
    expect(joinSummaryTexts(["Tuân thủ quy định nhà nước.", "Từ 50 người dùng,", "  ", "Bảo mật;"])).toBe(
      "Tuân thủ quy định nhà nước; Từ 50 người dùng; Bảo mật"
    );
  });

  it("trường đang có giả định chờ không hiện ở 'AI đã ghi nhận'; không còn ', .' hay '., '", () => {
    const brief: GateReadyEvent = {
      ...payload,
      summary: [
        { kind: "update", collection: "project", id: null, title_vi: "form_factor: web_app" },
        { kind: "update", collection: "project", id: null, title_vi: "complexity: small" },
        { kind: "add", collection: "addendum", id: "AD1", title_vi: "Tuân thủ quy định nhà nước." },
        { kind: "add", collection: "addendum", id: "AD2", title_vi: "Từ 50 người dùng." },
      ],
      new_assumptions: [{ id: "AS1", text: "Web app", text_vi: "Nền tảng là web" }],
    };
    const { container } = renderWithIntl(
      <GateCard stepId="B-0.1" actions={ALL} regenerateUsed={0} payload={brief} assumptionPaths={{ AS1: "project.form_factor" }} onAction={vi.fn()} />
    );
    expect(screen.queryByText(/Nền tảng: Web/)).toBeNull();
    expect(screen.getByText(/~1 thông tin dự án/)).toBeInTheDocument();
    expect(screen.getByText(/Tuân thủ quy định nhà nước; Từ 50 người dùng/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/, \.|\., /);
  });
});
