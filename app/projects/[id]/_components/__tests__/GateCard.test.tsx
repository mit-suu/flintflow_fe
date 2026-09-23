import { fireEvent, screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { describe, expect, it, vi } from "vitest";
import GateCard, { groupSummary } from "../GateCard";
import type { GateAction, GateReadyEvent } from "@/types/pipeline";

const ALL: GateAction[] = ["accept", "revision", "regenerate"];

describe("GateCard", () => {
  it("Accept gọi onAction ngay; Regenerate hiện số lượt đã dùng", () => {
    const onAction = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={1} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: /Accept$/ }));
    expect(onAction).toHaveBeenCalledWith("accept");

    const regenerate = screen.getByRole("button", { name: /Regenerate \(1\/3\)/ });
    expect(regenerate).not.toBeDisabled();
    fireEvent.click(regenerate);
    expect(onAction).toHaveBeenCalledWith("regenerate");
  });

  it("hết 3 lượt Regenerate ⇒ nút tắt, Accept as-is xuất hiện", () => {
    renderWithIntl(<GateCard stepId="S-3.1" actions={["accept", "revision", "accept_as_is"]} regenerateUsed={3} onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Regenerate \(3\/3\)/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Accept as-is" })).toBeInTheDocument();
  });

  it("chưa hết Regenerate thì không hiện Accept as-is", () => {
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} onAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Accept as-is" })).not.toBeInTheDocument();
  });

  it("Accept as-is bắt buộc lý do trước khi gửi", () => {
    const onAction = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.1" actions={["accept", "accept_as_is"]} regenerateUsed={3} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Accept as-is" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận Accept as-is" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lý do chấp nhận/), { target: { value: "   " } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Lý do chấp nhận/), { target: { value: "Khách hàng đồng ý bản này" } });
    fireEvent.click(confirm);
    expect(onAction).toHaveBeenCalledWith("accept_as_is", "Khách hàng đồng ý bản này");
  });

  it("Request revision cần ghi chú", () => {
    const onAction = vi.fn();
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: /Request revision/ }));
    fireEvent.change(screen.getByLabelText("Cần sửa gì?"), { target: { value: "Thiếu actor Guest" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu sửa" }));
    expect(onAction).toHaveBeenCalledWith("revision", "Thiếu actor Guest");
  });

  it("busy thì khoá mọi hành động", () => {
    renderWithIntl(<GateCard stepId="S-3.1" actions={ALL} regenerateUsed={0} busy onAction={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Accept$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Regenerate/ })).toBeDisabled();
  });

  // L11b: trước đây lô op rỗng đi tới gate y như một lượt chạy thành công — user Accept, cờ đỏ vẫn treo, bấm
  // "Mở lại" lại rơi vào đúng vòng đó cho tới khi cạn trần 8 lượt gọi model (gặp thật 2026-09-20).
  describe("cảnh báo lượt chạy không ghi được gì (L11b)", () => {
    it("lô op rỗng ⇒ nói thẳng, vẫn cho Accept", () => {
      renderWithIntl(<GateCard stepId="S-7.2" actions={ALL} regenerateUsed={0} wroteOps={false} onAction={vi.fn()} />);
      expect(screen.getByRole("status")).toHaveTextContent("AI không soạn được nội dung nào ở lượt này");
      expect(screen.getByRole("button", { name: /Accept$/ }), "vẫn là quyết định của người dùng").not.toBeDisabled();
    });

    it("có ghi op nhưng mục vẫn trống ⇒ gọi tên mục và nói rõ Accept không đóng được cờ", () => {
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

  it("hiện nội dung vừa ghi, chênh lệch cờ, thời gian và credit — không chỉ con số thay đổi", () => {
    renderWithIntl(<GateCard stepId="S-4.3" actions={ALL} regenerateUsed={0} payload={payload} onAction={vi.fn()} />);
    expect(screen.getByText(/Bạn vừa có/)).toBeInTheDocument();
    expect(screen.getByText(/\+2 quyền/)).toBeInTheDocument();
    expect(screen.getByText(/Admin tạo trên Manage Staff/)).toBeInTheDocument();
    expect(screen.getByText(/cờ đỏ 3 → 2/)).toBeInTheDocument();
    expect(screen.getByText(/58 giây · 4 credit/)).toBeInTheDocument();
  });

  it("giả định mới có ba nút Đúng / Sửa / Bỏ và biến mất sau khi quyết (BUG-13)", () => {
    const onAssumptionDecision = vi.fn();
    renderWithIntl(
      <GateCard stepId="S-4.3" actions={ALL} regenerateUsed={0} payload={payload} onAssumptionDecision={onAssumptionDecision} onAction={vi.fn()} />
    );
    expect(screen.getByText(/1 giả định mới/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Sửa giả định AS12"), { target: { value: "Lễ tân được xoá lịch trong ngày" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(onAssumptionDecision).toHaveBeenCalledWith({ kind: "edit", id: "AS12", statement: "Lễ tân được xoá lịch trong ngày" });
    expect(screen.queryByText(/1 giả định mới/)).not.toBeInTheDocument();
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
});
