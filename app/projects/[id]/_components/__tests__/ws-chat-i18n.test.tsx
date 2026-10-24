import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import type { Locale } from "@/lib/i18n";
import type { ChatSession } from "@/types/chat";
import type { PreviewResult } from "@/types/pipeline";
import ChatPane from "../ChatPane";
import ChatEditCard from "../ChatEditCard";
import ChatSessionHistory from "../ChatSessionHistory";
import GateCard from "../GateCard";
import KnowledgeAnswer from "../KnowledgeAnswer";
import LanguageCommandCard from "../LanguageCommandCard";
import QuestionStepperInput from "../QuestionStepperInput";
import ScreenQueuePanel from "../ScreenQueuePanel";
import ElicitPanel from "../ElicitPanel";

// Dữ liệu (tin nhắn, câu hỏi, tên màn) để không dấu: phép thử "còn tiếng Việt không" chỉ đo chữ của giao diện.
const SESSION: ChatSession = {
  _id: "s-0001",
  is_pipeline: false,
  messages: [
    { role: "user", content: "Hello", createdAt: "2026-10-01T08:00:00Z", step: "S-3.1" },
    { role: "ai", content: JSON.stringify({ kind: "change_preview", reply: "Done", change_count: 2 }), createdAt: "2026-10-01T08:00:05Z" },
    { role: "ai", content: "Plain answer", createdAt: "2026-10-01T08:00:06Z" },
  ],
} as ChatSession;

const noop = () => {};

const renderPane = (locale: Locale) =>
  renderWithIntl(
    <ChatPane
      session={SESSION}
      inputMessage=""
      setInputMessage={noop}
      onSendMessage={noop}
      sending={false}
      pendingAttachments={[new File(["x"], "spec.pdf")]}
      onSelectAttachment={noop}
      onRemoveAttachment={noop}
      onRequestRollback={noop}
      onGoToPipeline={noop}
      onEditInstruction={noop}
      onToggleEditMode={noop}
      onToggleKnowledgeMode={noop}
      knowledgePending
      headerStart={
        <ChatSessionHistory sessions={[SESSION]} activeSessionId="s-0001" onSelectSession={noop} onCreateSession={noop} onDeleteSession={noop} />
      }
    />,
    locale
  );

const preview = {
  ok: true,
  violations: [],
  changes: [
    { op: "set", path: "actors[id=A01].name", value: "Admin" },
    { op: "set", path: "actors[id=A02].name", value: "Staff" },
    { op: "set", path: "actors[id=A03].name", value: "Guest" },
    { op: "set", path: "actors[id=A04].name", value: "Bot" },
  ],
  impact: { sections: ["fixed:2.1"] },
} as unknown as PreviewResult;

describe("Khung chat — song ngữ", () => {
  it("vi giữ nguyên chữ cũ", () => {
    renderPane("vi");
    expect(screen.getByRole("heading", { name: "Trò chuyện và duyệt" })).toBeInTheDocument();
    expect(screen.getByText("Đang tra kho tri thức…")).toBeInTheDocument();
    expect(screen.getByText("Chờ bạn xác nhận (2 thay đổi)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Về phiên chính" })).toBeInTheDocument();
  });

  it("en không còn chữ tiếng Việt ở khung chat, ô nhập, lịch sử phiên", () => {
    const { container } = renderPane("en");
    fireEvent.click(screen.getByRole("button", { name: "Chat history" }));
    expect(screen.getByText("Awaiting your confirmation (2 changes)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove file spec.pdf" })).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("en: thẻ sửa, thẻ ngôn ngữ, câu trả lời tri thức, hàng đợi màn", () => {
    const { container } = renderWithIntl(
      <div>
        <ChatEditCard
          instruction="Rename actors"
          previewing={false}
          applying={false}
          clarification="Which actor?"
          error={null}
          preview={preview}
          applied={null}
          onShowDetail={noop}
          onApply={noop}
          onCancel={noop}
          onDismiss={noop}
        />
        <ChatEditCard
          instruction="x"
          previewing
          applying={false}
          clarification={null}
          error={null}
          preview={null}
          applied={{ instruction: "Rename", count: 3, version: 2 }}
          onShowDetail={noop}
          onApply={noop}
          onCancel={noop}
          onUndo={noop}
          onDismiss={noop}
        />
        <LanguageCommandCard kind="switch" text="to English" target="en" sourceLanguage="vi" onConfirm={noop} onTranslate={noop} onSendAsMessage={noop} onCancel={noop} />
        <LanguageCommandCard kind="same" text="to English" target="en" sourceLanguage="en" missing={2} onConfirm={noop} onTranslate={noop} onSendAsMessage={noop} onCancel={noop} />
        <LanguageCommandCard kind="locked" text="to English" target="en" sourceLanguage="en" onConfirm={noop} onTranslate={noop} onSendAsMessage={noop} onCancel={noop} />
        <KnowledgeAnswer
          reply="Use include [K1]."
          grounded
          citations={[{ ref: "K1", chunk_id: "c1", source: "UML guide", section: "Include", source_kind: "standard" }]}
        />
        <KnowledgeAnswer reply="No grounds" grounded={false} citations={[]} />
        <ScreenQueuePanel
          spine={{
            screens: [
              { id: "S01", name: "Login", detail_status: "pending", queue_order: 1 },
              { id: "S02", name: "Home", detail_status: "signed_off", queue_order: 2 },
            ],
            progress: { screen_cursor: null },
          } as never}
          onMarkPlaceholder={noop}
        />
        <ScreenQueuePanel spine={{ screens: [], progress: {} } as never} onMarkPlaceholder={noop} />
      </div>,
      "en"
    );
    expect(screen.getByText("Will change 4 places · affects 1 section")).toBeInTheDocument();
    expect(screen.getByText("Applied 3 changes")).toBeInTheDocument();
    expect(screen.getByText("Switch the document to English?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Source K1/ }));
    expect(screen.getByText("External standard")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("en: cổng chốt (câu tạm, cờ, bảng, menu) và thẻ hỏi", () => {
    const { container } = renderWithIntl(
      <div>
        <GateCard
          stepId="S-3.1"
          actions={["accept", "revision", "regenerate", "accept_as_is"]}
          regenerateUsed={1}
          wroteOps={false}
          emptySections={[{ section_id: "fixed:2.1", title: "Actors" }]}
          payload={
            {
              summary: [{ kind: "add", collection: "actors", id: "A01", title_vi: "Admin" }],
              table: { title_vi: "Roles", columns: ["Role"], rows: [["Admin"]], truncated: 2 },
            } as never
          }
          blockingFlags={[{ id: "f1", message: "Missing UC", remediation_step: "S-3.2" }]}
          onGoToStep={noop}
          newFlags={[{ id: "f2", level: "red", message: "Broken link", waivable: true }]}
          onFixFlag={noop}
          onKeepFlag={vi.fn()}
          onAction={noop}
        />
        <QuestionStepperInput
          questions={[
            { question: "Platform?", header: "Platform", multiple: true, options: [{ label: "Web (Khuyến nghị)" }, { label: "Mobile" }] },
            { question: "Users?", options: [{ label: "Staff" }] },
          ]}
          onSubmit={noop}
          onDismiss={noop}
        />
      </div>,
      "en"
    );
    expect(screen.getByText(/^I’ve updated: added 1 actors \(Admin\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep as is" }));
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(vietnameseLeftovers(container)).toEqual([]);
  });

  it("en: nhắc câu tự luận chưa trả lời", () => {
    const { container } = renderWithIntl(
      <ElicitPanel
        questions={[
          { id: "q1", text: "Platform?", options: ["Web", "Mobile"] },
          { id: "q2", text: "Goals?" },
          { id: "q3", text: "Users?" },
        ] as never}
        onSubmit={noop}
      />,
      "en"
    );
    fireEvent.click(screen.getByRole("radio", { name: /Web/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send answers" }));
    expect(screen.getByRole("alert")).toHaveTextContent("2 open questions are still unanswered: “Goals?”; “Users?”. Type your answer in the chat box (numbered");
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
