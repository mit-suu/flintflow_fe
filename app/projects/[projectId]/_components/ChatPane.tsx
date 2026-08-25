"use client";

import { useRef, useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  WorkspacePhase,
  DiscoveryStepNumber,
  DISCOVERY_STEPS,
  PHASE_SECTION_MAP,
  SECTION_TYPE_LABELS,
  SectionType,
  WORKSPACE_PHASES,
  DiscoveryEvaluation,
} from "../../../../lib/constants/section-types";
import { ChatSession } from "./ChatSessionSidebar";
import { SectionItem } from "./PhaseNavBar";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import DraftReviewCard from "./DraftReviewCard";
import SummaryReviewCard from "./SummaryReviewCard";
import GeneratingIndicator from "./GeneratingIndicator";
import StepTransitionBanner from "./StepTransitionBanner";

interface ChatPaneProps {
  session: ChatSession | null;
  workspacePhase: WorkspacePhase;
  discoveryStep: DiscoveryStepNumber;
  sections: SectionItem[];
  generatingPhase: boolean;
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  onSendMessage: (customContent?: string) => void;
  sending: boolean;
  pendingAttachments: File[];
  onSelectAttachment: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (name: string) => void;
  onAcceptSection: (type: SectionType) => void;
  onRequestRevision: (type: SectionType) => void;
  onRegenerateSection: (type: SectionType) => void;
  onApproveSummary: () => void;
  onGeneratePhase: () => void;
  onApproveBaseline?: () => void;
  approvingBaseline?: boolean;
  acceptingType?: SectionType | null;
  regeneratingType?: SectionType | null;
  onAdvanceStep?: (nextStep: number) => void;
}

export default function ChatPane({
  session,
  workspacePhase,
  discoveryStep,
  sections,
  generatingPhase,
  inputMessage,
  setInputMessage,
  onSendMessage,
  sending,
  pendingAttachments,
  onSelectAttachment,
  onRemoveAttachment,
  onAcceptSection,
  onRequestRevision,
  onRegenerateSection,
  onApproveSummary,
  onGeneratePhase,
  onApproveBaseline,
  approvingBaseline = false,
  acceptingType,
  regeneratingType,
  onAdvanceStep,
}: ChatPaneProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, workspacePhase, discoveryStep, generatingPhase]);

  const messages = session?.messages || [];
  const currentPhaseSections = PHASE_SECTION_MAP[workspacePhase] || [];
  const phaseInfo = WORKSPACE_PHASES.find((p) => p.id === workspacePhase);

  // Parse evaluation từ AI message gần nhất CHO STEP HIỆN TẠI
  const lastEvaluation = useMemo((): DiscoveryEvaluation | null => {
    const aiMessages = messages.filter((m) => m.role === "ai");
    for (let i = aiMessages.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(aiMessages[i].content);
        if (parsed.evaluation) {
          const eval_ = parsed.evaluation as DiscoveryEvaluation;
          // Chỉ lấy evaluation của step hiện tại (hoặc isDiscoveryComplete)
          if (eval_.currentStep === discoveryStep || eval_.isDiscoveryComplete) {
            return eval_;
          }
        }
      } catch (_) {}
    }
    return null;
  }, [messages, discoveryStep]);

  // Reset banner dismiss khi step thay đổi hoặc có evaluation mới
  const prevStepRef = useRef(discoveryStep);
  useEffect(() => {
    if (prevStepRef.current !== discoveryStep) {
      prevStepRef.current = discoveryStep;
      setBannerDismissed(false);
    }
  }, [discoveryStep]);

  // Set completedSteps cho DiscoveryStepBar
  const completedSteps = useMemo((): Set<number> => {
    const completed = new Set<number>();
    for (const msg of messages) {
      if (msg.role === "ai") {
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.evaluation?.isStepComplete && parsed.evaluation?.currentStep) {
            completed.add(parsed.evaluation.currentStep);
          }
        } catch (_) {}
      }
    }
    return completed;
  }, [messages]);

  // Gom stepSummary từ tất cả evaluation hoàn thành → SummaryReviewCard
  const discoverySummaryData = useMemo(() => {
    // Map: step number → latest stepSummary (khi isStepComplete = true)
    const stepSummaries = new Map<number, string>();
    for (const msg of messages) {
      if (msg.role === "ai") {
        try {
          const parsed = JSON.parse(msg.content);
          const ev = parsed.evaluation;
          if (ev?.isStepComplete && ev?.currentStep && ev?.stepSummary) {
            stepSummaries.set(ev.currentStep, ev.stepSummary);
          }
        } catch (_) {}
      }
    }
    if (stepSummaries.size === 0) return undefined;
    return {
      problem: stepSummaries.get(1),   // Step 1: Vision & Problem
      users: stepSummaries.get(2),     // Step 2: Target Users
      solution: stepSummaries.get(3),  // Step 3: Value Proposition
      scope: stepSummaries.get(4),     // Step 4: MVP Scope
      metrics: stepSummaries.get(5),   // Step 5: Success Metrics
      risks: stepSummaries.get(6),     // Step 6: Risks & Assumptions
    };
  }, [messages]);

  // Find generated sections in current phase that are waiting for review
  const phaseGeneratedSections = sections.filter(
    (s) =>
      currentPhaseSections.includes(s.type as SectionType) &&
      (s.status === "draft" || s.status === "generated" || s.status === "edited_manually") &&
      Boolean(s.content)
  );

  const phaseAcceptedSections = sections.filter(
    (s) =>
      currentPhaseSections.includes(s.type as SectionType) &&
      s.status === "accepted"
  );

  const isAllPhaseAccepted =
    currentPhaseSections.length > 0 &&
    phaseAcceptedSections.length === currentPhaseSections.length;

  return (
    <section className="w-[440px] flex-none border-r border-[#ECEAE5] bg-[#F5F3F0] flex flex-col overflow-hidden">
      {/* Chat Pane Header */}
      <div className="px-5 py-3 border-b border-[#ECEAE5] flex justify-between items-center bg-white shrink-0 h-[52px]">
        <div className="flex items-center gap-2">
          <span className="text-[#4F46E5] text-sm">✦</span>
          <h2 className="font-extrabold text-[#191817] text-[13px]">
            {workspacePhase === "discovery"
              ? "Khảo sát làm rõ (Discovery)"
              : `Hội thoại & Duyệt ${phaseInfo?.label || ""}`}
          </h2>
        </div>

        <div className="text-[11px] font-bold text-[#4F46E5] bg-[#F4F3FE] border border-[#DDD9F6] px-2.5 py-0.5 rounded-full truncate max-w-[170px]">
          {workspacePhase === "discovery"
            ? `Step ${discoveryStep}: ${DISCOVERY_STEPS[discoveryStep - 1]?.shortLabel}`
            : phaseInfo?.label}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col">
        {/* Welcome message if session is empty */}
        {messages.length === 0 && (
          <div className="my-auto max-w-sm text-center py-8 flex flex-col items-center gap-3 bg-white border border-[#ECEAE5] rounded-[20px] p-6 shadow-2xs">
            <div className="w-10 h-10 rounded-[12px] bg-[#F4F3FE] text-[#4F46E5] flex items-center justify-center text-[18px]">
              💡
            </div>
            <div>
              <h3 className="font-extrabold text-[#191817] text-[14px]">
                {workspacePhase === "discovery"
                  ? "Bắt đầu khảo sát ý tưởng"
                  : `Không gian làm việc ${phaseInfo?.label}`}
              </h3>
              <p className="text-[#8A867E] text-[12px] mt-1 leading-relaxed">
                {workspacePhase === "discovery"
                  ? "Hãy chia sẻ về bài toán kinh doanh, nhóm người dùng mục tiêu, hoặc đính kèm tài liệu tham khảo để bắt đầu."
                  : "Bạn có thể trò chuyện với AI Analyst để làm rõ thêm thông tin hoặc kích hoạt lệnh sinh đặc tả."}
              </p>
            </div>
          </div>
        )}

        {/* Discovery Follow-up Pills when in discovery */}
        {workspacePhase === "discovery" && (
          <div className="bg-white border border-[#ECEAE5] rounded-[14px] p-3 flex flex-col gap-2 shadow-2xs">
            <div className="text-[10.5px] font-extrabold text-[#4F46E5] tracking-wider uppercase">
              FOLLOW-UP · {DISCOVERY_STEPS[discoveryStep - 1]?.label}
            </div>
            <p className="text-[12px] text-[#4B4842] leading-relaxed">
              {DISCOVERY_STEPS[discoveryStep - 1]?.description}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {DISCOVERY_STEPS[discoveryStep - 1]?.sampleQuestions.map(
                (q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSendMessage(q)}
                    className="px-2.5 py-1 bg-[#FAF9F7] hover:bg-[#F4F3FE] border border-[#ECEAE5] hover:border-[#DDD9F6] text-[11px] font-semibold text-[#3B34B0] rounded-full text-left transition-colors cursor-pointer"
                  >
                    💬 {q}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* Message history */}
        {messages.map((msg, idx) => (
          <ChatBubble
            key={idx}
            message={msg}
            onSuggestedQuestionClick={(q) => onSendMessage(q)}
          />
        ))}

        {/* Step Transition Banner — AI xác nhận step hiện tại đủ thông tin */}
        {workspacePhase === "discovery" &&
          lastEvaluation?.isStepComplete &&
          !lastEvaluation?.isDiscoveryComplete &&
          !bannerDismissed && (
            <StepTransitionBanner
              currentStep={discoveryStep}
              stepSummary={lastEvaluation.stepSummary}
              onContinue={() => {
                setBannerDismissed(true);
                onAdvanceStep?.(discoveryStep + 1);
              }}
              onStayHere={() => setBannerDismissed(true)}
            />
          )}

        {/* Discovery Summary Card — AI xác nhận tất cả 6 steps đủ thông tin */}
        {workspacePhase === "discovery" && lastEvaluation?.isDiscoveryComplete && (
          <SummaryReviewCard
            summary={discoverySummaryData}
            status="pending"
            onEdit={() => {
              setInputMessage("Tôi muốn chỉnh sửa thông tin khảo sát...");
            }}
            onApprove={onApproveSummary}
          />
        )}

        {/* Batch Generate Trigger Card when in non-discovery phase with no drafts */}
        {workspacePhase !== "discovery" &&
          workspacePhase !== "export" &&
          phaseGeneratedSections.length === 0 &&
          !isAllPhaseAccepted &&
          !generatingPhase && (
            <div className="bg-white border border-[#DDD9F6] rounded-[16px] p-5 shadow-[0_8px_24px_rgba(79,70,229,0.08)] flex flex-col gap-3 my-2">
              <div className="flex items-center gap-2">
                <span className="text-[#4F46E5] font-extrabold text-base">
                  ✦
                </span>
                <h4 className="font-extrabold text-[13px] text-[#191817]">
                  Sinh đặc tả cho {phaseInfo?.label}
                </h4>
              </div>
              <p className="text-[12px] text-[#6B6862] leading-relaxed">
                Hệ thống sẽ tổng hợp toàn bộ ngữ cảnh từ Product Brief và các
                phiên chat để tự động sinh{" "}
                <strong>{currentPhaseSections.length} sections</strong> thuộc{" "}
                {phaseInfo?.label}.
              </p>
              <button
                type="button"
                onClick={onGeneratePhase}
                disabled={generatingPhase}
                className="self-start px-4 py-2 rounded-full btn-gradient-primary text-white text-[12px] font-bold flex items-center gap-2 cursor-pointer shadow-md hover:opacity-95 transition-opacity"
              >
                <span>⚡</span>
                <span>Bắt đầu sinh đặc tả toàn bộ Phase</span>
              </button>
            </div>
          )}

        {/* Generating Indicator when batch is running */}
        {generatingPhase && (
          <GeneratingIndicator
            phaseLabel={phaseInfo?.label || "Phase"}
            sectionTypes={currentPhaseSections}
            completedTypes={phaseAcceptedSections.map(
              (s) => s.type as SectionType
            )}
          />
        )}

        {/* Draft Review Cards for generated sections */}
        {phaseGeneratedSections.map((sec) => (
          <DraftReviewCard
            key={sec.type}
            sectionType={sec.type as SectionType}
            sectionLabel={
              SECTION_TYPE_LABELS[sec.type as SectionType] || sec.type
            }
            contentPreview={sec.content}
            status={sec.status}
            isAccepting={acceptingType === sec.type}
            isRegenerating={regeneratingType === sec.type}
            onAccept={() => onAcceptSection(sec.type as SectionType)}
            onRevise={() => onRequestRevision(sec.type as SectionType)}
            onRegenerate={() => onRegenerateSection(sec.type as SectionType)}
          />
        ))}

        {/* Phase All Accepted Banner */}
        {isAllPhaseAccepted && (
          <div className="bg-[#E9F7EE] border border-[#BFE6CE] rounded-[14px] p-4 text-[#1F7A45] flex flex-col gap-1.5">
            <div className="font-extrabold text-[13px] flex items-center gap-1.5">
              <span>🎉</span>
              <span>
                Toàn bộ {currentPhaseSections.length} section của {phaseInfo?.label} đã được nghiệm thu!
              </span>
            </div>
            <p className="text-[12px] text-[#4B4842]">
              Cổng Phase Gate đã tự động mở khóa giai đoạn tiếp theo.
            </p>
          </div>
        )}

        {/* Export Phase Approval Card */}
        {workspacePhase === "export" && (
          <div className="bg-white border-2 border-[#4F46E5] rounded-[18px] p-5 shadow-lg flex flex-col gap-3.5 my-2">
            <div className="flex items-center gap-2 text-[#4F46E5]">
              <span className="text-xl">🏆</span>
              <h4 className="font-extrabold text-[14px] text-[#191817]">
                Phê duyệt SRS Baseline v1.0 (UC 6.14)
              </h4>
            </div>
            <p className="text-[12.5px] text-[#4B4842] leading-relaxed">
              Tất cả các phần đặc tả của 5 chương đã hoàn thành nghiệm thu. Phê
              duyệt bản Baseline v1.0 để đóng băng tài liệu và kích hoạt quyền
              xuất bản DOCX/PDF/Jira.
            </p>
            {onApproveBaseline && (
              <button
                type="button"
                onClick={onApproveBaseline}
                disabled={approvingBaseline}
                className="self-start px-5 py-2.5 rounded-full bg-[#191817] hover:bg-[#33312D] text-white text-[12px] font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all"
              >
                {approvingBaseline ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>★</span>
                )}
                <span>Phê duyệt SRS Baseline v1.0 & Mở khóa Export</span>
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <ChatInput
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        onSendMessage={() => onSendMessage()}
        sending={sending}
        pendingAttachments={pendingAttachments}
        onSelectAttachment={onSelectAttachment}
        onRemoveAttachment={onRemoveAttachment}
      />
    </section>
  );
}
