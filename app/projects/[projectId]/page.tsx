"use client";

import { useEffect, useState, useRef, useMemo, type ChangeEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiCall, refreshAccessToken } from "../../../lib/api";
import { isAuthenticated, clearAuthToken } from "../../../lib/auth";
import {
  WorkspacePhase,
  DiscoveryStepNumber,
  SectionType,
  DISCOVERY_STEPS,
} from "../../../lib/constants/section-types";

// Component imports
import WorkspaceHeader, {
  ProjectData,
  UserData,
} from "./_components/WorkspaceHeader";
import PhaseNavBar, { SectionItem } from "./_components/PhaseNavBar";
import DiscoveryStepBar from "./_components/DiscoveryStepBar";
import ChatSessionSidebar, {
  ChatSession,
  ChatMessage,
} from "./_components/ChatSessionSidebar";
import ChatPane from "./_components/ChatPane";
import DocumentPane from "./_components/DocumentPane";
import VerificationPane from "./_components/VerificationPane";
import ConfirmRollbackModal from "./_components/ConfirmRollbackModal";

export default function WorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;

  // Primary Data State
  const [project, setProject] = useState<ProjectData | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [sections, setSections] = useState<SectionItem[]>([]);

  // Workflow State
  const [workspacePhase, setWorkspacePhase] =
    useState<WorkspacePhase>("discovery");
  const [discoveryStep, setDiscoveryStep] = useState<DiscoveryStepNumber>(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Interaction State
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [generatingPhase, setGeneratingPhase] = useState(false);
  const [acceptingType, setAcceptingType] = useState<SectionType | null>(null);
  const [regeneratingType, setRegeneratingType] = useState<SectionType | null>(
    null
  );
  const [approvingBaseline, setApprovingBaseline] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [rollbackTargetIndex, setRollbackTargetIndex] = useState<number | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  // Resize handle state cho 2 bên ChatPane & DocumentPane (phong cách Antigravity)
  const [chatPaneWidth, setChatPaneWidth] = useState<number>(480);
  const [isResizing, setIsResizing] = useState(false);
  const mainContainerRef = useRef<HTMLElement>(null);
  const chatPaneWidthRef = useRef(chatPaneWidth);
  chatPaneWidthRef.current = chatPaneWidth;

  // Khôi phục chiều rộng đã lưu trong localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("flintflow_chat_pane_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 340 && parsed <= 1000) {
          setChatPaneWidth(parsed);
        }
      }
    } catch (_) {}
  }, []);

  // Xử lý sự kiện kéo chuột để resize 2 bên
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const chatPaneEl = document.getElementById("flintflow-chat-pane");
      if (!chatPaneEl || !mainContainerRef.current) return;

      const chatPaneRect = chatPaneEl.getBoundingClientRect();
      const mainRect = mainContainerRef.current.getBoundingClientRect();

      const newWidth = e.clientX - chatPaneRect.left;

      // Giới hạn chiều rộng
      const minWidth = 350;
      const minDocWidth = 320;
      const verificationWidth = verificationOpen ? 380 : 0;
      const sidebarWidth = sidebarOpen ? 230 : 0;
      const maxAllowed = Math.max(
        minWidth,
        mainRect.width - sidebarWidth - verificationWidth - minDocWidth
      );
      const clamped = Math.min(Math.max(minWidth, newWidth), Math.min(1000, maxAllowed));

      setChatPaneWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem("flintflow_chat_pane_width", String(chatPaneWidthRef.current));
      } catch (_) {}
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, verificationOpen, sidebarOpen]);

  const didInitRef = useRef(false);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
      return error.message || fallback;
    }
    return fallback;
  };

  const handleLogout = () => {
    clearAuthToken();
    router.push("/login");
  };

  const handleCreateChatSession = async () => {
    try {
      const res = await apiCall<ChatSession>(`/projects/${projectId}/chats`, {
        method: "POST",
      });
      if (res.data) {
        setChatSessions((prev) => [
          res.data!,
          ...prev.map((s) => ({ ...s, isActive: false })),
        ]);
        setActiveSession(res.data);
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Không thể tạo cuộc trò chuyện mới"));
    }
  };

  // Initialize Workspace Data
  useEffect(() => {
    if (!projectId) return;
    if (didInitRef.current) return;
    didInitRef.current = true;

    const init = async () => {
      if (!isAuthenticated()) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          clearAuthToken();
          router.push("/login");
          return;
        }
      }

      try {
        const [projectRes, userRes, sessionsRes, sectionsRes] =
          await Promise.all([
            apiCall<ProjectData>(`/projects/${projectId}`),
            apiCall<UserData>("/users/me"),
            apiCall<ChatSession[]>(`/projects/${projectId}/chats`),
            apiCall<SectionItem[]>(`/specifications/projects/${projectId}`),
          ]);

        if (projectRes.data) {
          setProject(projectRes.data);
          if (projectRes.data.workspacePhase) {
            setWorkspacePhase(
              projectRes.data.workspacePhase as WorkspacePhase
            );
          }
        }
        if (userRes.data) setUser(userRes.data);
        if (sectionsRes.data) setSections(sectionsRes.data);

        if (sessionsRes.data) {
          setChatSessions(sessionsRes.data);
          const active =
            sessionsRes.data.find((s) => s.isActive) || sessionsRes.data[0];
          if (active) {
            setActiveSession(active);
          } else {
            await handleCreateChatSession();
          }
        }
      } catch (err: unknown) {
        console.error("Workspace init failed:", err);
        if (
          err instanceof Error &&
          "status" in err &&
          (err as { status?: number }).status === 401
        ) {
          clearAuthToken();
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [projectId, router]);

  // Select a Chat Session
  const handleSelectSession = async (session: ChatSession) => {
    try {
      const res = await apiCall<ChatSession>(
        `/projects/${projectId}/chats/${session._id}`
      );
      if (res.data) {
        setActiveSession(res.data);
        setChatSessions((prev) =>
          prev.map((s) => ({ ...s, isActive: s._id === session._id }))
        );
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Không thể tải cuộc trò chuyện"));
    }
  };

  // Delete a Chat Session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiCall(`/projects/${projectId}/chats/${sessionId}`, {
        method: "DELETE",
      });

      setChatSessions((prev) => {
        const filtered = prev.filter((s) => s._id !== sessionId);
        if (activeSession?._id === sessionId) {
          const nextActive = filtered[0];
          if (nextActive) {
            handleSelectSession(nextActive);
          } else {
            setActiveSession(null);
          }
        }
        return filtered;
      });
    } catch (err: unknown) {
      alert("Không thể xoá cuộc trò chuyện: " + getErrorMessage(err, "Lỗi"));
    }
  };

  // Send Message with optional attachments
  const handleSendMessage = async (
    customContent?: string,
    overrideStep?: DiscoveryStepNumber
  ) => {
    const msgToSend = customContent ?? inputMessage;
    if (
      (!msgToSend.trim() && pendingAttachments.length === 0) ||
      !activeSession ||
      sending
    )
      return;

    setSending(true);
    setInputMessage("");

    const activeStepNum = overrideStep ?? discoveryStep;
    const contentToPost = msgToSend.trim() || "[Đính kèm tài liệu]";

    // Optimistic update: hiển thị user message ngay lập tức
    const optimisticMsg: ChatMessage = {
      role: "user",
      content: contentToPost,
      step: workspacePhase === "discovery"
        ? DISCOVERY_STEPS[activeStepNum - 1]?.chatStepName || "vision_problem"
        : "vision_problem",
      workspacePhase,
      createdAt: new Date().toISOString(),
    };
    setActiveSession((prev) =>
      prev
        ? { ...prev, messages: [...prev.messages, optimisticMsg] }
        : prev
    );

    try {
      // 1. Upload pending attachments if any
      if (pendingAttachments.length > 0) {
        for (const file of pendingAttachments) {
          const formData = new FormData();
          formData.append("file", file);

          await apiCall(`/projects/${projectId}/documents`, {
            method: "POST",
            body: formData,
          });
        }
        setPendingAttachments([]);
      }

      // 2. Post chat message with current discovery chat step name if in discovery
      const currentChatStep =
        workspacePhase === "discovery"
          ? DISCOVERY_STEPS[activeStepNum - 1]?.chatStepName || "vision_problem"
          : "vision_problem";

      const res = await apiCall<ChatSession>(
        `/projects/${projectId}/chats/${activeSession._id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            content: contentToPost,
            step: currentChatStep,
            discoveryStep: workspacePhase === "discovery" ? activeStepNum : undefined,
            workspacePhase,
          }),
        }
      );

      if (res.data) {
        // Server response chứa đầy đủ messages (user + AI), thay thế optimistic state
        setActiveSession(res.data);
        const userRes = await apiCall<UserData>("/users/me");
        if (userRes.data) setUser(userRes.data);
      }
    } catch (err: unknown) {
      // Rollback optimistic update nếu lỗi
      setActiveSession((prev) =>
        prev
          ? { ...prev, messages: prev.messages.filter((m) => m !== optimisticMsg) }
          : prev
      );
      alert(getErrorMessage(err, "Không thể gửi tin nhắn"));
    } finally {
      setSending(false);
    }
  };

  const handleSelectAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setPendingAttachments((prev) => [...prev, ...Array.from(files)]);
    event.target.value = "";
  };

  const handleRemoveAttachment = (fileName: string) => {
    setPendingAttachments((prev) =>
      prev.filter((f) => f.name !== fileName)
    );
  };

  // Batch Generate Sections for the current phase
  const handleGeneratePhase = async () => {
    if (!activeSession || generatingPhase) return;
    setGeneratingPhase(true);

    try {
      const res = await apiCall<{
        generated: SectionItem[];
        errors: Array<{ type: string; error: string }>;
      }>(`/specifications/projects/${projectId}/generate-phase`, {
        method: "POST",
        body: JSON.stringify({
          workspacePhase,
          chatSessionId: activeSession._id,
        }),
      });

      if (res.data) {
        setSections((prev) => {
          const updated = [...prev];
          for (const newSec of res.data!.generated) {
            const idx = updated.findIndex((s) => s.type === newSec.type);
            if (idx !== -1) updated[idx] = newSec;
            else updated.push(newSec);
          }
          return updated;
        });

        const userRes = await apiCall<UserData>("/users/me");
        if (userRes.data) setUser(userRes.data);
      }
    } catch (err: unknown) {
      alert(
        "Sinh đặc tả thất bại: " +
          getErrorMessage(err, "Vui lòng chat làm rõ thêm thông tin!")
      );
    } finally {
      setGeneratingPhase(false);
    }
  };

  // Accept a single section and advance Phase Gate if all required are accepted
  const handleAcceptSection = async (sectionType: SectionType) => {
    try {
      setAcceptingType(sectionType);
      const res = await apiCall<{
        section: SectionItem;
        phaseProgression?: {
          advanced: boolean;
          newWorkspacePhase?: WorkspacePhase;
          progressPercent: number;
        };
      }>(`/specifications/projects/${projectId}/${sectionType}/accept`, {
        method: "PUT",
      });

      if (res.data) {
        const returnedSec = res.data.section;
        setSections((prev) =>
          prev.map((s) => (s.type === sectionType ? returnedSec : s))
        );

        if (res.data.phaseProgression) {
          const { advanced, newWorkspacePhase, progressPercent } =
            res.data.phaseProgression;

          setProject((prev) =>
            prev ? { ...prev, progressPercent } : null
          );

          if (advanced && newWorkspacePhase) {
            setWorkspacePhase(newWorkspacePhase);
          }
        }
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Nghiệm thu section thất bại"));
    } finally {
      setAcceptingType(null);
    }
  };

  // Request revision via chat
  const handleRequestRevision = (sectionType: SectionType) => {
    setInputMessage(
      `Tôi muốn chỉnh sửa phần đặc tả "${sectionType}": `
    );
  };

  // Regenerate a single section
  const handleRegenerateSection = async (sectionType: SectionType) => {
    if (!activeSession) return;
    try {
      setRegeneratingType(sectionType);
      const res = await apiCall<SectionItem>(
        `/specifications/projects/${projectId}/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            type: sectionType,
            chatSessionId: activeSession._id,
          }),
        }
      );

      if (res.data) {
        setSections((prev) => {
          const idx = prev.findIndex((s) => s.type === sectionType);
          if (idx !== -1) {
            const u = [...prev];
            u[idx] = res.data!;
            return u;
          }
          return [...prev, res.data!] as SectionItem[];
        });
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Tạo lại đặc tả thất bại"));
    } finally {
      setRegeneratingType(null);
    }
  };

  // Save manual edits to a section
  const handleSaveSectionContent = async (
    type: SectionType,
    content: string
  ) => {
    const res = await apiCall<SectionItem>(
      `/specifications/projects/${projectId}/${type}`,
      {
        method: "PUT",
        body: JSON.stringify({
          content,
          status: "edited_manually",
        }),
      }
    );

    if (res.data) {
      setSections((prev) =>
        prev.map((s) => (s.type === type ? res.data! : s))
      );
    }
  };

  // Approve Discovery Summary and advance to Product Overview (persist to DB)
  const handleApproveSummary = async () => {
    try {
      await apiCall(`/specifications/projects/${projectId}/advance-to-generation`, {
        method: "POST",
      });
      setWorkspacePhase("product_overview");
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Không thể chuyển sang giai đoạn sinh đặc tả"));
    }
  };

  // Advance discovery step khi AI gợi ý step hiện tại đã đủ thông tin
  const handleAdvanceStep = async (nextStep: number) => {
    if (nextStep >= 1 && nextStep <= 6) {
      const stepNum = nextStep as DiscoveryStepNumber;
      setDiscoveryStep(stepNum);
      const nextStepInfo = DISCOVERY_STEPS[stepNum - 1];
      const promptText = `Bắt đầu Step ${stepNum}: ${nextStepInfo?.label || ""}`;
      await handleSendMessage(promptText, stepNum);
    }
  };

  // Mở modal xác nhận hoàn tác
  const handleRequestRollback = (index: number) => {
    if (sending || rollingBack) return;
    setRollbackTargetIndex(index);
  };

  // Thực thi hoàn tác sau khi người dùng xác nhận
  const handleConfirmRollback = async () => {
    if (
      rollbackTargetIndex === null ||
      !activeSession ||
      rollingBack ||
      sending
    ) {
      return;
    }

    const targetMsg = activeSession.messages[rollbackTargetIndex];
    if (!targetMsg) {
      setRollbackTargetIndex(null);
      return;
    }

    setRollingBack(true);
    // Làm trống ô nhập tin nhắn của người dùng sau khi hoàn tác
    setInputMessage("");
    setPendingAttachments([]);

    try {
      const res = await apiCall<{
        session: ChatSession;
        project: ProjectData;
        sections: SectionItem[];
        workspacePhase: WorkspacePhase;
      }>(
        `/projects/${projectId}/chats/${activeSession._id}/rollback`,
        {
          method: "POST",
          body: JSON.stringify({ messageIndex: rollbackTargetIndex }),
        }
      );

      if (res.data) {
        if (res.data.session) {
          setActiveSession(res.data.session);
        }
        if (res.data.project) {
          setProject(res.data.project);
        }
        if (res.data.sections) {
          setSections(res.data.sections);
        }
        if (res.data.workspacePhase) {
          setWorkspacePhase(res.data.workspacePhase);
        }

        // Đồng bộ lại discoveryStep và tiến trình theo các tin nhắn còn lại
        const remainingMsgs = res.data.session?.messages || [];
        let newStep: DiscoveryStepNumber = 1;

        for (let i = remainingMsgs.length - 1; i >= 0; i--) {
          const msg = remainingMsgs[i];
          if (msg.role === "ai") {
            try {
              const parsed = JSON.parse(msg.content);
              if (parsed.evaluation?.currentStep) {
                newStep = parsed.evaluation.currentStep as DiscoveryStepNumber;
                break;
              }
            } catch (_) {}
          } else if (msg.discoveryStep) {
            newStep = msg.discoveryStep as DiscoveryStepNumber;
            break;
          }
        }
        setDiscoveryStep(newStep);
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Không thể hoàn tác cuộc trò chuyện"));
    } finally {
      setRollingBack(false);
      setRollbackTargetIndex(null);
    }
  };

  // Tập hợp các step Discovery đã hoàn thành
  const completedSteps = useMemo((): DiscoveryStepNumber[] => {
    const completed = new Set<DiscoveryStepNumber>();
    const msgs = activeSession?.messages || [];
    for (const msg of msgs) {
      if (msg.role === "ai") {
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed.evaluation?.isStepComplete && parsed.evaluation?.currentStep) {
            completed.add(parsed.evaluation.currentStep as DiscoveryStepNumber);
          }
        } catch (_) {}
      }
    }
    return Array.from(completed);
  }, [activeSession?.messages]);

  // Approve SRS Baseline v1.0 (UC 6.14)
  const handleApproveBaseline = async () => {
    try {
      setApprovingBaseline(true);
      const res = await apiCall<{
        baselineVersion: string;
      }>(`/specifications/projects/${projectId}/approve-baseline`, {
        method: "POST",
      });

      if (res.data) {
        setProject((prev) =>
          prev
            ? {
                ...prev,
                baselineVersion: res.data!.baselineVersion,
                progressPercent: 100,
              }
            : null
        );
        alert(
          `🏆 Phê duyệt thành công SRS Baseline ${res.data.baselineVersion}! Quyền xuất bản đã được mở khóa.`
        );
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Phê duyệt SRS Baseline thất bại"));
    } finally {
      setApprovingBaseline(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F3F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 rounded-full border-3 border-[#E4E1DC] border-t-[#4F46E5] animate-spin shrink-0" />
          <span className="text-[#8A867E] font-medium text-sm">
            Đang tải không gian làm việc SRS…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#F5F3F0] font-sans">
      {/* 1. Top Header Bar */}
      <WorkspaceHeader
        project={project}
        user={user}
        onExportClick={() => setWorkspacePhase("export")}
        onLogout={handleLogout}
      />

      {/* 2. Phase Gate Navigation Bar (5 Phases) */}
      <PhaseNavBar
        currentPhase={workspacePhase}
        sections={sections}
        progressPercent={project?.progressPercent ?? 0}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onPhaseClick={(phase) => setWorkspacePhase(phase)}
        verificationOpen={verificationOpen}
        onVerificationClick={() => setVerificationOpen(!verificationOpen)}
      />

      {/* 3. Discovery 6-Step Bar (when in discovery) */}
      {workspacePhase === "discovery" && (
        <DiscoveryStepBar
          currentStep={discoveryStep}
          completedSteps={completedSteps}
        />
      )}

      {/* 4. Main 3-Pane Workspace Container */}
      <main ref={mainContainerRef} className="flex-1 flex overflow-hidden bg-[#F5F3F0]">
        {/* Left Sidebar: Chat Sessions History */}
        {sidebarOpen && (
          <ChatSessionSidebar
            sessions={chatSessions}
            activeSessionId={activeSession?._id || null}
            onSelectSession={handleSelectSession}
            onCreateSession={handleCreateChatSession}
            onDeleteSession={handleDeleteSession}
          />
        )}

        {/* Pane 1 (Left): Chat & Elicitation Workspace */}
        <ChatPane
          width={chatPaneWidth}
          session={activeSession}
          workspacePhase={workspacePhase}
          discoveryStep={discoveryStep}
          sections={sections}
          generatingPhase={generatingPhase}
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          onSendMessage={handleSendMessage}
          sending={sending}
          pendingAttachments={pendingAttachments}
          onSelectAttachment={handleSelectAttachment}
          onRemoveAttachment={handleRemoveAttachment}
          onAcceptSection={handleAcceptSection}
          onRequestRevision={handleRequestRevision}
          onRegenerateSection={handleRegenerateSection}
          onApproveSummary={handleApproveSummary}
          onGeneratePhase={handleGeneratePhase}
          onApproveBaseline={handleApproveBaseline}
          approvingBaseline={approvingBaseline}
          acceptingType={acceptingType}
          regeneratingType={regeneratingType}
          onAdvanceStep={handleAdvanceStep}
          onRequestRollback={handleRequestRollback}
        />

        {/* Thanh Resize ngăn cách 2 bên - Phong cách Antigravity */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          onDoubleClick={() => {
            setChatPaneWidth(480);
            try {
              localStorage.setItem("flintflow_chat_pane_width", "480");
            } catch (_) {}
          }}
          className="relative w-[10px] -mx-[5px] z-20 cursor-col-resize group shrink-0 select-none flex items-center justify-center transition-all"
          title="Kéo để thay đổi kích thước 2 bên (Nháy đúp để về mặc định)"
        >
          {/* Đường kẻ phân cách (rõ ràng và dày hơn) */}
          <div
            className={`h-full transition-all ${
              isResizing
                ? "w-[3px] bg-[#4F46E5] shadow-[0_0_10px_rgba(79,70,229,0.6)]"
                : "w-[2px] bg-[#E2DFD9] group-hover:w-[3px] group-hover:bg-[#4F46E5]"
            }`}
          />

          {/* Grip tay cầm ở giữa to rõ hơn xuất hiện khi hover giống Antigravity */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-5 h-9 rounded-full flex items-center justify-center pointer-events-none transition-all shadow-sm ${
              isResizing
                ? "opacity-100 bg-[#4F46E5] text-white scale-110 shadow-[0_2px_8px_rgba(79,70,229,0.35)]"
                : "opacity-0 group-hover:opacity-100 bg-white border border-[#DDD9F6] text-[#4F46E5]"
            }`}
          >
            <div className="flex flex-col gap-1 items-center">
              <span className="w-1 h-1 rounded-full bg-current" />
              <span className="w-1 h-1 rounded-full bg-current" />
              <span className="w-1 h-1 rounded-full bg-current" />
            </div>
          </div>
        </div>

        {/* Pane 2 (Center): Live 5-Chapter SRS Document Tree */}
        <DocumentPane
          projectName={project?.name}
          sections={sections}
          workspacePhase={workspacePhase}
          onSaveSectionContent={handleSaveSectionContent}
        />

        {/* Pane 3 (Right): Verification & Readiness Panel */}
        {verificationOpen && (
          <VerificationPane
            projectId={projectId}
            onClose={() => setVerificationOpen(false)}
          />
        )}
      </main>

      {/* Confirm Rollback Modal */}
      <ConfirmRollbackModal
        isOpen={rollbackTargetIndex !== null}
        messageSnippet={
          rollbackTargetIndex !== null
            ? activeSession?.messages[rollbackTargetIndex]?.content
            : undefined
        }
        onConfirm={handleConfirmRollback}
        onCancel={() => !rollingBack && setRollbackTargetIndex(null)}
        isRollingBack={rollingBack}
      />
    </div>
  );
}
