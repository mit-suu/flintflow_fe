"use client";

import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { apiCall, setAccessToken } from "../../../lib/api";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  step?: string;
  createdAt: string;
}

interface ChatSession {
  _id: string;
  projectId: string;
  messages: ChatMessage[];
  isActive: boolean;
  createdAt: string;
}

interface Project {
  _id: string;
  name: string;
  domain?: string;
  status: string;
  currentStep: string;
  progressPercent: number;
}

interface User {
  id: string;
  email: string;
  balance?: number;
}

interface Section {
  _id: string;
  type: string;
  content: string;
  status: string;
  sourceType: string;
}

type StepType = "vision_problem" | "target_users" | "value_proposition" | "mvp_scope";

const STEPS: { id: StepType; label: string }[] = [
  { id: "vision_problem", label: "Vision & Problem" },
  { id: "target_users", label: "Target users" },
  { id: "value_proposition", label: "Value proposition" },
  { id: "mvp_scope", label: "MVP scope" }
];

export default function WorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [activeStep, setActiveStep] = useState<StepType>("vision_problem");
  const [viewMode, setViewMode] = useState<"chat" | "spec">("chat");
  const [sections, setSections] = useState<Section[]>([]);

  // States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [generatingSpec, setGeneratingSpec] = useState(false);
  const [editingSpec, setEditingSpec] = useState(false);
  const [editedSpecContent, setEditedSpecContent] = useState("");
  const [savingSpec, setSavingSpec] = useState(false);

  // PRD Modal
  const [showPrdModal, setShowPrdModal] = useState(false);
  const [prdContent, setPrdContent] = useState("");
  const [loadingPrd, setLoadingPrd] = useState(false);

  // Delete Chat Session Modal
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<string | null>(null);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentUploadMessage, setDocumentUploadMessage] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuSessionId(null);
    if (openMenuSessionId) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuSessionId]);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
      return error.message || fallback;
    }
    return fallback;
  };

  const handleCreateChatSession = async () => {
    try {
      const res = await apiCall<ChatSession>(`/projects/${projectId}/chats`, {
        method: "POST"
      });
      if (res.data) {
        setChatSessions((prev) => [res.data!, ...prev.map(s => ({ ...s, isActive: false }))]);
        setActiveSession(res.data);
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Không thể tạo cuộc trò chuyện mới"));
    }
  };

  // Initialize Auth & Data
  useEffect(() => {
    if (!projectId) return;

    const init = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        router.push("/login");
        return;
      }
      setAccessToken(token);

      try {
        // Fetch project, user, and sessions
        const [projectRes, userRes, sessionsRes, sectionsRes] = await Promise.all([
          apiCall<Project>(`/projects/${projectId}`),
          apiCall<User>("/users/me"),
          apiCall<ChatSession[]>(`/projects/${projectId}/chats`),
          apiCall<Section[]>(`/specifications/projects/${projectId}`)
        ]);

        if (projectRes.data) setProject(projectRes.data);
        if (userRes.data) setUser(userRes.data);
        if (sectionsRes.data) setSections(sectionsRes.data);

        if (sessionsRes.data) {
          setChatSessions(sessionsRes.data);
          // Auto select active session or the first session
          const active = sessionsRes.data.find((s) => s.isActive) || sessionsRes.data[0];
          if (active) {
            setActiveSession(active);
          } else {
            // Create a default session if none exists
            await handleCreateChatSession();
          }
        }
      } catch (err: unknown) {
        console.error("Workspace init failed:", err);
        if (err instanceof Error && "status" in err && typeof (err as { status?: unknown }).status === "number" && (err as { status?: number }).status === 401) {
          localStorage.removeItem("accessToken");
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [projectId, router]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, activeStep, viewMode]);

  // Select Chat Session
  const handleSelectSession = async (session: ChatSession) => {
    try {
      const res = await apiCall<ChatSession>(`/projects/${projectId}/chats/${session._id}`);
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

  // Delete Chat Session
  const handleDeleteChatSession = async () => {
    if (!deleteConfirmSessionId) return;
    setDeleting(true);
    try {
      await apiCall(`/projects/${projectId}/chats/${deleteConfirmSessionId}`, {
        method: "DELETE"
      });

      setChatSessions((prev) => {
        const filtered = prev.filter((s) => s._id !== deleteConfirmSessionId);

        // If the active session was deleted, select another one
        if (activeSession?._id === deleteConfirmSessionId) {
          const nextActive = filtered[0];
          if (nextActive) {
            handleSelectSession(nextActive);
          } else {
            setActiveSession(null);
          }
        }

        return filtered;
      });

      setDeleteConfirmSessionId(null);
    } catch (err: unknown) {
      alert("Không thể xoá cuộc trò chuyện: " + getErrorMessage(err, "Lỗi chưa xác định"));
    } finally {
      setDeleting(false);
    }
  };

  // Send Message
  const handleSendMessage = async (customContent?: string) => {
    const msgToSend = customContent || inputMessage;
    if ((!msgToSend.trim() && pendingAttachments.length === 0) || !activeSession || sending) return;

    setSending(true);
    if (!customContent) setInputMessage("");

    try {
      if (pendingAttachments.length > 0) {
        for (const file of pendingAttachments) {
          const formData = new FormData();
          formData.append("file", file);

          const uploadRes = await apiCall<{ _id: string; originalName: string; url: string }>(
            `/projects/${projectId}/documents`,
            {
              method: "POST",
              body: formData
            }
          );

          if (uploadRes.data) {
            setDocumentUploadMessage(`Đã lưu ${pendingAttachments.length} tài liệu`);
          }
        }
        setPendingAttachments([]);
      }
      // If there is text use it; otherwise if attachments were uploaded send a placeholder
      const shouldPost = msgToSend.trim() || /* attachments were uploaded */ false;
      const contentToPost = msgToSend.trim() || (/* if we uploaded attachments just now */ (/* note: documentUploadMessage set above */ "[Đính kèm tài liệu]"));

      if (contentToPost.trim()) {
        const res = await apiCall<ChatSession>(
          `/projects/${projectId}/chats/${activeSession._id}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: contentToPost.trim(),
              step: activeStep
            })
          }
        );

        if (res.data) {
          setActiveSession(res.data);
          const userRes = await apiCall<User>("/users/me");
          if (userRes.data) setUser(userRes.data);
        }
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Không thể gửi tin nhắn"));
    } finally {
      setSending(false);
    }
  };

  const handleSelectAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !projectId) return;

    const selectedFiles = Array.from(files);
    setPendingAttachments((prev) => [...prev, ...selectedFiles]);
    setDocumentUploadMessage(`Đã chọn ${selectedFiles.length} file`);
    event.target.value = "";
  };

  const removePendingAttachment = (fileName: string) => {
    setPendingAttachments((prev) => prev.filter((file) => file.name !== fileName));
    setDocumentUploadMessage(null);
  };

  const handleUploadOnly = async () => {
    if (!projectId || pendingAttachments.length === 0) return;
    setUploadingDocument(true);
    setDocumentUploadMessage(null);

    try {
      for (const file of pendingAttachments) {
        const formData = new FormData();
        formData.append("file", file);

        await apiCall<{ _id: string; originalName: string; url: string }>(
          `/projects/${projectId}/documents`,
          {
            method: "POST",
            body: formData
          }
        );
      }

      setDocumentUploadMessage(`Đã tải lên ${pendingAttachments.length} file`);
      setPendingAttachments([]);
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Không thể tải file lên"));
    } finally {
      setUploadingDocument(false);
    }
  };

  // Generate Spec Section
  const handleGenerateSpec = async () => {
    if (!activeSession) return;
    setGeneratingSpec(true);
    setViewMode("spec");

    try {
      const res = await apiCall<Section>(`/specifications/projects/${projectId}/generate`, {
        method: "POST",
        body: JSON.stringify({
          type: activeStep,
          chatSessionId: activeSession._id
        })
      });

      if (res.data) {
        setSections((prev) => {
          const idx = prev.findIndex((s) => s.type === activeStep);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = res.data!;
            return updated;
          }
          return [...prev, res.data!];
        });
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Tạo đặc tả thất bại. Hãy chat làm rõ thêm thông tin!"));
    } finally {
      setGeneratingSpec(false);
    }
  };

  // Edit Spec Section
  const startEditSpec = (section: Section) => {
    setEditingSpec(true);
    setEditedSpecContent(section.content);
  };

  // Save Spec Section
  const handleSaveSpec = async () => {
    setSavingSpec(true);
    try {
      const res = await apiCall<Section>(`/specifications/projects/${projectId}/${activeStep}`, {
        method: "PUT",
        body: JSON.stringify({
          content: editedSpecContent,
          status: "edited_manually"
        })
      });

      if (res.data) {
        setSections((prev) =>
          prev.map((s) => (s.type === activeStep ? res.data! : s))
        );
        setEditingSpec(false);
      }
    } catch (err: unknown) {
      alert(getErrorMessage(err, "Lưu đặc tả thất bại."));
    } finally {
      setSavingSpec(false);
    }
  };

  // Compile full PRD Document
  const handleGeneratePrd = async () => {
    setShowPrdModal(true);
    setLoadingPrd(true);

    try {
      const specSections = ["vision_problem", "target_users", "value_proposition", "mvp_scope"];
      let text = `# Đặc tả yêu cầu sản phẩm (PRD) — ${project?.name || "Dự án"}\n\n`;

      if (project?.domain) {
        text += `**Ngành/Lĩnh vực:** ${project.domain}\n\n`;
      }

      let hasAnySpec = false;
      specSections.forEach((stepId) => {
        const sect = sections.find((s) => s.type === stepId);
        const stepLabel = STEPS.find((st) => st.id === stepId)?.label || stepId;
        text += `## ${stepLabel}\n\n`;
        if (sect && sect.content) {
          text += `${sect.content}\n\n`;
          hasAnySpec = true;
        } else {
          text += `*Chưa có thông tin đặc tả được sinh cho phần này.*\n\n`;
        }
      });

      setPrdContent(text);
    } catch (err) {
      setPrdContent("Không thể tải PRD.");
    } finally {
      setLoadingPrd(false);
    }
  };

  const activeSectionMessages = activeSession?.messages.filter((m) => m.step === activeStep) || [];
  const activeSectionData = sections.find((s) => s.type === activeStep);

  // Helper to parse AI JSON Message
  const parseAiMessage = (content: string): { reply: string; suggestedQuestions?: string[] } => {
    if (content.startsWith("{") && content.endsWith("}")) {
      try {
        return JSON.parse(content);
      } catch (_) {
        return { reply: content };
      }
    }
    return { reply: content };
  };

  // Helper to render basic markdown bold/list
  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      // Bold **text**
      let formatted = line;
      const boldRegex = /\*\*(.*?)\*\*/g;
      formatted = formatted.replace(boldRegex, "<strong>$1</strong>");

      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li
            key={i}
            className="ml-4 list-disc text-sm text-slate-700 leading-relaxed py-0.5"
            dangerouslySetInnerHTML={{ __html: formatted.replace(/^[-*]\s+/, "") }}
          />
        );
      }
      if (line.trim() === "") {
        return <div key={i} className="h-2" />;
      }
      return (
        <p
          key={i}
          className="text-sm text-slate-700 leading-relaxed mb-1"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
      );
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-10 h-10 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="31.4" strokeDashoffset="10.4" strokeLinecap="round" strokeWidth="4"></circle>
          </svg>
          <span className="text-slate-500 font-medium text-sm">Đang tải workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-sans">

      {/* TopHeader */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 h-[60px]" data-purpose="main-header">
        <div className="flex items-center gap-3">
          <Link href="/home" className="w-8 h-8 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-sm hover:brightness-90 transition-all">
            F
          </Link>
          <div className="flex items-center text-sm text-slate-500 gap-2">
            <Link href="/home" className="hover:underline">Projects</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900 truncate max-w-[200px]">
              {project?.name}
            </span>
          </div>
          {project?.domain && (
            <div className="ml-4 px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              {project.domain}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center text-xs text-emerald-600 gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Saved • vừa xong
          </div>
          {user && (
            <div className="flex items-center px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              {user.balance ?? 0} credits
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-purple-200 border-2 border-white shadow-sm flex items-center justify-center font-bold text-xs text-purple-700">
            {user?.email.substring(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      {/* NavigationBar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-2 shrink-0 h-[56px] overflow-x-auto scrollbar-hide" data-purpose="step-navigation">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors mr-2 shrink-0"
          title="Toggle Sidebar"
        >
          <span className="material-symbols-outlined text-xl">
            {sidebarOpen ? "menu_open" : "menu"}
          </span>
        </button>

        <span className="text-xs font-bold text-slate-400 mr-2 uppercase tracking-wider shrink-0">BRIEF</span>

        {STEPS.map((step) => {
          const isActive = activeStep === step.id;
          const hasSpec = sections.some((s) => s.type === step.id && s.content);
          return (
            <button
              key={step.id}
              onClick={() => {
                setActiveStep(step.id);
                setViewMode("chat");
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shrink-0 transition-all ${isActive
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {hasSpec ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : "bg-slate-400"}`}></span>
              )}
              {step.label}
            </button>
          );
        })}

        <div className="w-[1px] h-4 bg-slate-200 mx-2 shrink-0"></div>

        <button
          onClick={handleGeneratePrd}
          className="px-4 py-1.5 rounded-full bg-orange-50 text-orange-600 text-xs font-bold flex items-center gap-1.5 hover:bg-orange-100 transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-sm">article</span>
          Generate PRD
        </button>
      </nav>

      {/* MainContent Workspace Layout */}
      <main className="flex-1 flex overflow-hidden bg-slate-50" data-purpose="workspace-layout">

        {/* SIDEBAR: Chat History */}
        {sidebarOpen && (
          <aside className="w-[260px] border-r border-slate-200 bg-white flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-indigo-600">forum</span>
                Lịch sử chat
              </span>
              <button
                onClick={handleCreateChatSession}
                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Tạo chat mới"
              >
                <span className="material-symbols-outlined text-lg font-bold">add</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatSessions.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">
                  Chưa có cuộc trò chuyện nào
                </div>
              ) : (
                chatSessions.map((session) => {
                  const isActive = activeSession?._id === session._id;
                  const previewMsg = session.messages[session.messages.length - 1];
                  let previewText = "Cuộc trò chuyện trống";
                  if (previewMsg) {
                    previewText = previewMsg.content;
                    if (previewMsg.role === "ai" && previewText.startsWith("{")) {
                      const parsed = parseAiMessage(previewText);
                      previewText = parsed.reply;
                    }
                  }

                  const isMenuOpen = openMenuSessionId === session._id;

                  return (
                    <div
                      key={session._id}
                      className={`group relative flex items-center justify-between p-3 rounded-xl transition-all ${isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "hover:bg-slate-100 text-slate-700"
                        }`}
                    >
                      {/* Session Name & Preview — clickable to select */}
                      <button
                        onClick={() => {
                          setOpenMenuSessionId(null);
                          handleSelectSession(session);
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="font-semibold text-xs truncate">
                          Cuộc trò chuyện #{session._id.substring(session._id.length - 4)}
                        </div>
                        <div className={`text-[10px] truncate mt-1 ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                          {previewText}
                        </div>
                      </button>

                      {/* More Options — ... button */}
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuSessionId(isMenuOpen ? null : session._id);
                          }}
                          className={`p-1 rounded-lg transition-colors md:opacity-0 group-hover:opacity-100 focus:opacity-100 ${isMenuOpen ? "opacity-100" : ""
                            } ${isActive
                              ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                              : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                            }`}
                          title="Tùy chọn"
                        >
                          <span className="material-symbols-outlined text-base">more_horiz</span>
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            className="absolute right-0 top-8 z-30 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setOpenMenuSessionId(null);
                                setDeleteConfirmSessionId(session._id);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
                            >
                              Xoá cuộc trò chuyện
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}

        {/* MAIN CHAT & SPEC WORKSPACE */}
        <section className="flex-1 flex flex-col bg-white" data-purpose="chat-interface">

          {/* Header of Main Panel */}
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 shrink-0 h-[60px] z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-indigo-600">
                  {viewMode === "chat" ? "chat_bubble" : "description"}
                </span>
                {viewMode === "chat" ? "Trò chuyện làm rõ" : "Tài liệu đặc tả"}
              </h2>
              <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-full">
                Brief › {STEPS.find((s) => s.id === activeStep)?.label}
              </span>
            </div>

            {/* Toggle View Mode */}
            <div className="bg-slate-100 p-0.5 rounded-xl flex gap-1 shadow-inner">
              <button
                onClick={() => setViewMode("chat")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === "chat"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                Trò chuyện
              </button>
              <button
                onClick={() => setViewMode("spec")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === "spec"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
              >
                Đặc tả
              </button>
            </div>
          </div>

          {/* VIEW: CHAT INTERFACE */}
          {viewMode === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col bg-slate-50/50">

                {activeSectionMessages.length === 0 && (
                  <div className="m-auto max-w-md text-center py-12 flex flex-col items-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <span className="material-symbols-outlined">lightbulb</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">Bắt đầu làm rõ bước này</h3>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                        Hãy chat với BA để làm rõ thông tin cho phần **{STEPS.find((s) => s.id === activeStep)?.label}**. Nhập ý tưởng ban đầu hoặc dán thông tin bạn có.
                      </p>
                    </div>
                  </div>
                )}

                {activeSectionMessages.map((msg, idx) => {
                  const isUser = msg.role === "user";

                  if (isUser) {
                    return (
                      <div key={idx} className="flex flex-col items-end space-y-1">
                        <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm text-sm">
                          <p>{msg.content}</p>
                        </div>
                      </div>
                    );
                  }

                  // AI Response
                  const parsed = parseAiMessage(msg.content);

                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                        F
                      </div>
                      <div className="flex flex-col gap-1.5 w-full max-w-[85%]">
                        <span className="text-[10px] font-bold text-slate-400">FlintFlow BA</span>
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-5 shadow-sm space-y-4">
                          <div className="text-slate-800 space-y-2">
                            {renderMarkdown(parsed.reply)}
                          </div>

                          {/* Suggested reply pills */}
                          {parsed.suggestedQuestions && parsed.suggestedQuestions.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                              {parsed.suggestedQuestions.map((q, qidx) => (
                                <button
                                  key={qidx}
                                  onClick={() => handleSendMessage(q)}
                                  className="px-3 py-1.5 border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/30 text-indigo-600 text-xs font-semibold rounded-full transition-all text-left"
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                      F
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <span className="text-[10px] font-bold text-slate-400">FlintFlow BA</span>
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm inline-block max-w-[200px]">
                        <div className="flex gap-1.5 justify-center py-2">
                          <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                          <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                          <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Container */}
              <div className="p-4 bg-white border-t border-slate-200 shrink-0" data-purpose="chat-input">
                <div className="border border-slate-200 hover:border-indigo-500 focus-within:border-indigo-500 rounded-xl p-3 bg-slate-50/50 flex flex-col gap-2 transition-all relative">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1 font-bold text-slate-500">
                      <span className="material-symbols-outlined text-sm">description</span>
                      Nhập thông tin hoặc chọn ý kiến làm rõ ở trên
                    </span>
                    <span>Gemini-3.1-flash</span>
                  </div>

                  <textarea
                    rows={2}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Nhập thông tin làm rõ..."
                    className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder-slate-400 outline-none text-slate-900 p-0 resize-none h-12"
                  />

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <div className="flex flex-col gap-2 text-slate-400">
                      {pendingAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {pendingAttachments.map((file) => (
                            <div key={file.name} className="flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                              <span className="truncate max-w-[180px]">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removePendingAttachment(file.name)}
                                className="text-slate-500 hover:text-red-500"
                                title="Bỏ đính kèm"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.md,.txt"
                        className="hidden"
                        multiple
                        onChange={handleSelectAttachment}
                      />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingDocument}
                          className="hover:text-indigo-600 transition-colors disabled:opacity-50"
                          title="Đính kèm tài liệu"
                        >
                          <span className="material-symbols-outlined text-lg">attach_file</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {documentUploadMessage && (
                        <span className="text-[10px] text-emerald-600 font-semibold">{documentUploadMessage}</span>
                      )}
                      <span className="text-[10px] text-slate-400 font-semibold">~2 credits / action</span>
                      <button
                        onClick={() => handleSendMessage()}
                        disabled={sending || (!inputMessage.trim() && pendingAttachments.length === 0)}
                        className="w-8 h-8 bg-indigo-600 disabled:bg-slate-200 text-white rounded-full flex items-center justify-center hover:bg-indigo-500 transition-all shadow-sm"
                      >
                        <span className="material-symbols-outlined text-lg font-bold">arrow_upward</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SPEC DOCUMENT */}
          {viewMode === "spec" && (
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {generatingSpec ? (
                <div className="max-w-2xl mx-auto py-16 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="31.4" strokeDashoffset="10.4" strokeLinecap="round" strokeWidth="4"></circle>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Đang tạo đặc tả chi tiết bằng AI</h3>
                    <p className="text-slate-500 text-xs mt-1">
                      AI đang tóm tắt ngữ cảnh cuộc hội thoại và sinh đặc tả chi tiết. Vui lòng chờ...
                    </p>
                  </div>
                </div>
              ) : activeSectionData ? (
                <div className="max-w-3xl mx-auto space-y-6">

                  {/* Editor view */}
                  {editingSpec ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <h3 className="font-bold text-slate-900 text-sm">Sửa đặc tả thủ công</h3>
                        <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">User Edited</span>
                      </div>
                      <textarea
                        rows={12}
                        value={editedSpecContent}
                        onChange={(e) => setEditedSpecContent(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 bg-white text-sm outline-none text-slate-800 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600/10 font-mono"
                      />
                      <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => setEditingSpec(false)}
                          className="px-4 py-2 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={handleSaveSpec}
                          disabled={savingSpec}
                          className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 transition-all disabled:opacity-50"
                        >
                          {savingSpec ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
                            {STEPS.find((s) => s.id === activeStep)?.label}
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Nguồn: {activeSectionData.sourceType === "ai_generated" ? "✨ AI Generated" : "✍️ User Edited"} • Trạng thái: {activeSectionData.status}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditSpec(activeSectionData)}
                            className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-1 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Sửa
                          </button>
                          <button
                            onClick={handleGenerateSpec}
                            className="px-3 py-1.5 border border-indigo-200 text-indigo-600 text-xs font-bold rounded-xl hover:bg-indigo-50 transition-all flex items-center gap-1 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-sm">cached</span>
                            Làm mới bằng AI
                          </button>
                        </div>
                      </div>

                      {/* Content Markdown container */}
                      <div className="text-slate-800 space-y-2 prose max-w-none pt-2">
                        {renderMarkdown(activeSectionData.content)}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="max-w-2xl mx-auto py-16 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-2xl">description</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Chưa sinh tài liệu đặc tả</h3>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed max-w-sm">
                      Bạn cần thực hiện trò chuyện làm rõ ý kiến với AI trước, sau đó bấm nút bên dưới để AI tự động đúc rút đặc tả nghiệp vụ cho phần này.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateSpec}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    Sinh đặc tả bằng AI (~5 credits)
                  </button>
                </div>
              )}
            </div>
          )}

        </section>
      </main>

      {/* FULL PRD MODAL */}
      {showPrdModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl border border-slate-100 transform transition-all overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-950">Tài liệu đặc tả PRD tổng hợp</h2>
                <p className="text-slate-400 text-[10px] mt-0.5">Tổng hợp từ tất cả các phần đặc tả hiện tại</p>
              </div>
              <button
                onClick={() => setShowPrdModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              {loadingPrd ? (
                <div className="h-full flex items-center justify-center">
                  <svg className="w-8 h-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="31.4" strokeDashoffset="10.4" strokeLinecap="round" strokeWidth="4"></circle>
                  </svg>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-6 max-w-3xl mx-auto">
                  <div className="text-slate-800 space-y-4 font-mono text-xs whitespace-pre-wrap leading-relaxed select-all">
                    {prdContent}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(prdContent);
                  alert("Đã sao chép tài liệu PRD vào clipboard!");
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Copy Clipboard
              </button>
              <button
                onClick={() => {
                  const element = document.createElement("a");
                  const file = new Blob([prdContent], { type: 'text/markdown' });
                  element.href = URL.createObjectURL(file);
                  element.download = `${project?.name || "flintflow"}-prd.md`;
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                }}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-500 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Tải về (.md)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmSessionId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 transform transition-all">
            {/* Icon */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-red-500">delete_forever</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Xoá cuộc trò chuyện?</h2>
                <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                  Thao tác này sẽ xóa vĩnh viễn toàn bộ tin nhắn trong cuộc trò chuyện này.<br />
                  Không thể hoàn tác sau khi xác nhận.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmSessionId(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleDeleteChatSession}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeDasharray="31.4" strokeDashoffset="10.4" strokeLinecap="round" strokeWidth="4"></circle>
                    </svg>
                    Đang xoá...
                  </>
                ) : (
                  <>
                    Xoá cuộc trò chuyện
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
