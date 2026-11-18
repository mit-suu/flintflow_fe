import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { Spine } from "@/types/spine";
import ProjectRecordPanel from "../ProjectRecordPanel";

vi.mock("../../hooks/useSources", () => ({ useSources: () => ({ sources: [], loading: false, error: null }) }));

const spine = {
  spine_version: 3,
  progress: { current_phase: "S-2" },
  project: { system_name: "Clinic Hub", form_factor: ["web_app"], stakes: "regulated", vision: "Book visits", goals: ["Fewer calls"] },
  addendum: [],
  assumptions: [],
  other_requirements: [
    { id: "OR01", kind: "risk", statement: "Gateway may be down", statement_vi: "Cổng thanh toán có thể sập" },
    { id: "OR02", kind: "open_question", statement: "Refund window?", statement_vi: "Hoàn tiền trong bao lâu?" },
  ],
  decisions: [{ id: "DC01", topic_key: "uptime", question: "Uptime?", answer: "99%", step_id: "S-1.4", at: "2026-09-22T10:00:00.000Z", superseded_by: null }],
  actors: [{ id: "A01", name: "Nurse" }],
  entities: [],
  screens: [],
  glossary: [],
} as unknown as Spine;

const renderPanel = (over: Partial<Parameters<typeof ProjectRecordPanel>[0]> = {}) =>
  renderWithIntl(
    <ProjectRecordPanel
      projectId="p1"
      spine={spine}
      onSubmitOps={vi.fn()}
      onMarkPlaceholder={vi.fn()}
      inBriefPhase={false}
      history={[]}
      historyLoading={false}
      onLoadHistory={vi.fn()}
      {...over}
    />
  );

describe("ProjectRecordPanel - sửa qua chat, không sửa tay", () => {
  it("tab Đã thống nhất: không có ô nhập; Sửa qua chat ở quyết định và tên gọi onEditByChat với lệnh điền sẵn", () => {
    const onEditByChat = vi.fn();
    const onSubmitOps = vi.fn();
    renderPanel({ onEditByChat, onSubmitOps });
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sửa qua chat" }));
    expect(onEditByChat).toHaveBeenLastCalledWith('Sửa quyết định "Uptime" (hiện là "99%") thành ');
    fireEvent.click(screen.getByRole("button", { name: "Sửa tên Nurse qua chat" }));
    expect(onEditByChat).toHaveBeenLastCalledWith('Đổi tên "Nurse" thành ');
    expect(onSubmitOps).not.toHaveBeenCalled();
  });

  it("tab Chờ bạn quyết: chỉ câu hỏi mở (có Trả lời trong chat), rủi ro không còn trong panel và không tính vào số đếm", () => {
    const onAnswerInChat = vi.fn();
    renderPanel({ onAnswerInChat });
    // Không có việc nào có nút quyết ⇒ tab không mang số, panel mở ở Đã thống nhất
    const pendingTab = screen.getByRole("tab", { name: /Chờ bạn quyết/ });
    expect(pendingTab).toHaveTextContent(/^Chờ bạn quyết$/);
    fireEvent.click(pendingTab);

    expect(screen.getByRole("heading", { name: "Câu hỏi mở (1)" })).toBeInTheDocument();
    // Rủi ro đã là nội dung mục Other Requirements của tài liệu, không lặp ở panel
    expect(screen.queryByText("Cổng thanh toán có thể sập")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Trả lời trong chat" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Trả lời trong chat" }));
    expect(onAnswerInChat).toHaveBeenCalledWith('Trả lời câu hỏi "Hoàn tiền trong bao lâu?": ');
  });

  it("Viewer (readOnly): không có nút sửa / trả lời qua chat", () => {
    renderPanel({ readOnly: true, onEditByChat: vi.fn(), onAnswerInChat: vi.fn() });
    expect(screen.queryByRole("button", { name: /qua chat/ })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Chờ bạn quyết/ }));
    expect(screen.queryByRole("button", { name: "Trả lời trong chat" })).toBeNull();
  });
});
