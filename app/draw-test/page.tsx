"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import ExcalidrawWrapper from "@/components/diagram/ExcalidrawWrapper";
import AuthGuard from "@/components/AuthGuard";
import Sidebar from "@/components/Sidebar";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { apiCall } from "@/lib/api";
import { getStoredAuthToken, decodeJwt } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  balance?: number;
}

function getUserInfo() {
  const token = getStoredAuthToken();
  if (!token) return { name: "User", plan: "Free Plan" };

  const payload = decodeJwt(token);
  const email = payload?.email ?? "";
  const name = email ? email.split("@")[0] : "User";
  const role = payload?.role ?? "user";
  const plan = role === "admin" ? "Admin" : "Free Plan";

  return { name, plan };
}

const MERMAID_TEMPLATES: Record<string, { label: string; description: string; code: string }> = {
  context: {
    label: "Context Diagram",
    description: "Sơ đồ ngữ cảnh hệ thống & tác nhân bên ngoài",
    code: `graph TB
    User[Khach hang - User]
    Admin[Quan tri vien - Admin]
    PayGW[Cong thanh toan VNPay]
    EmailSvc[Dich vu Email SendGrid]

    System{HE THONG FLINTFLOW}

    User -->|Gui yeu cau va thanh toan| System
    System -->|Tra ve ket qua| User

    Admin -->|Quan ly nguoi dung| System
    System -->|Bao cao thong ke| Admin

    System -->|Gui yeu cau thanh toan| PayGW
    PayGW -->|Webhook xac nhan| System

    System -->|Gui email thong bao| EmailSvc`,
  },
  screenflow: {
    label: "Screenflow",
    description: "Luồng di chuyển giữa các màn hình giao diện",
    code: `graph LR
    Splash([Man hinh Khoi dong]) --> Login{Da dang nhap?}

    Login -->|Chua| AuthScreen[Dang nhap / Dang ky]
    AuthScreen -->|Thanh cong| Dashboard[Trang chu]
    Login -->|Roi| Dashboard

    Dashboard --> ProjectList[Danh sach Du an]
    Dashboard --> CreateProject[Tao Du an Moi]
    Dashboard --> UserProfile[Cai dat Tai khoan]

    ProjectList --> Workspace[Khong gian lam viec]
    CreateProject --> Workspace

    Workspace --> SpecEditor[Soan thao PRD]
    Workspace --> DiagramStudio[Diagram Studio]
    Workspace --> ExportModal[Xuat tai lieu]

    DiagramStudio --> ExportModal`,
  },
  usecase: {
    label: "Use Case Diagram",
    description: "Sơ đồ chức năng theo từng Actor",
    code: `graph LR
    User[Khach hang]
    Admin[Quan tri vien]

    UC1([Dang nhap / Xac thuc])
    UC2([Tao du an moi])
    UC3([Sinh so do bang AI])
    UC4([Chinh sua ma Mermaid])
    UC5([Xuat tai lieu PRD])
    UC6([Quan ly nguoi dung])
    UC7([Xem thong ke chi tieu])

    User --- UC1
    User --- UC2
    User --- UC3
    User --- UC4
    User --- UC5

    Admin --- UC1
    Admin --- UC6
    Admin --- UC7

    UC3 -.->|include| UC1
    UC5 -.->|include| UC1
    UC4 -.->|extend| UC3`,
  },
  erd: {
    label: "ERD (Cơ sở dữ liệu)",
    description: "Sơ đồ thực thể quan hệ & cấu trúc bảng",
    code: `erDiagram
    USERS ||--o{ PROJECTS : owns
    USERS ||--o{ TRANSACTIONS : makes
    PROJECTS ||--|{ SECTIONS : contains
    PROJECTS ||--o{ DIAGRAMS : has

    USERS {
        string id PK
        string email
        string passwordHash
        int balance
        string role
        datetime createdAt
    }

    PROJECTS {
        string id PK
        string userId FK
        string name
        string domain
        string status
        datetime updatedAt
    }

    SECTIONS {
        string id PK
        string projectId FK
        string type
        string content
        string status
    }

    DIAGRAMS {
        string id PK
        string projectId FK
        string title
        string diagramType
        json rawData
    }

    TRANSACTIONS {
        string id PK
        string userId FK
        int amount
        string actionType
        datetime createdAt
    }`,
  },
};

const AI_SUGGESTIONS = [
  "Luồng đăng ký tài khoản bằng SĐT & xác thực mã OTP",
  "Quy trình thanh toán đơn hàng qua Cổng thanh toán VNPay / MoMo",
  "Kiến trúc Microservices xử lý AI Actions với Redis Queue",
  "Sơ đồ phân quyền RBAC cho Admin, Manager và Thành viên",
  "Luồng tạo và xuất tài liệu SRS / PRD tự động",
];

export default function DrawTestPage() {
  const excalidrawRef = useRef<any>(null);

  // Sidebar user info
  const [sidebarUser, setSidebarUser] = useState<{ name: string; plan: string }>({
    name: "User",
    plan: "Free Plan",
  });

  // Tab state: "ai" | "mermaid"
  const [activeTab, setActiveTab] = useState<"ai" | "mermaid">("ai");

  // User balance & info
  const [user, setUser] = useState<User | null>(null);

  // Mermaid Code Editor state
  const [mermaidCode, setMermaidCode] = useState<string>(MERMAID_TEMPLATES.context.code);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("context");
  const [mermaidError, setMermaidError] = useState<string>("");
  const [mermaidCompiling, setMermaidCompiling] = useState<boolean>(false);
  const [mermaidSuccessMsg, setMermaidSuccessMsg] = useState<string>("");

  // AI Generator state
  const [aiPrompt, setAiPrompt] = useState<string>(
    "vẽ luồng đăng ký tài khoản mới bằng số điện thoại và gửi mã OTP"
  );
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [aiDiagramType, setAiDiagramType] = useState<string>("");
  const [aiStats, setAiStats] = useState<{ latencyMs?: number; totalCost?: number } | null>(null);

  // Canvas stats / panel toggle
  const [canvasStatus, setCanvasStatus] = useState<string>("Sẵn sàng làm việc");
  const [elementCount, setElementCount] = useState<number>(0);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);

  // Initialize user information
  useEffect(() => {
    setSidebarUser(getUserInfo());
    const fetchUser = async () => {
      try {
        const res = await apiCall<User>("/users/me");
        if (res.data) setUser(res.data);
      } catch (err) {
        console.warn("Không lấy được thông tin người dùng:", err);
      }
    };
    fetchUser();
  }, []);

  const handleCanvasChange = (elements: readonly any[], appState: any) => {
    if (elements && elements.length > 0) {
      setElementCount(elements.length);
      const sceneData = JSON.stringify({ elements, appState });
      localStorage.setItem("flintflow_draw_test", sceneData);
      setCanvasStatus(`Đã tự động lưu (${elements.length} đối tượng)`);
    }
  };

  const handleLoadFromLocal = () => {
    if (!excalidrawRef.current) return;
    const saved = localStorage.getItem("flintflow_draw_test");
    if (saved) {
      try {
        const { elements, appState } = JSON.parse(saved);
        excalidrawRef.current.updateScene({ elements, appState, commitToHistory: true });
        setCanvasStatus(`Đã khôi phục bản vẽ (${elements?.length || 0} đối tượng)`);
      } catch (e) {
        console.error("Lỗi parse dữ liệu vẽ:", e);
        alert("Lỗi khi khôi phục dữ liệu bản vẽ.");
      }
    } else {
      alert("Không có bản vẽ nào được lưu trước đó trong trình duyệt.");
    }
  };

  const handleClearCanvas = () => {
    if (!excalidrawRef.current) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ bản vẽ trên bảng?")) {
      excalidrawRef.current.updateScene({
        elements: [],
        commitToHistory: true,
      });
      localStorage.removeItem("flintflow_draw_test");
      setElementCount(0);
      setCanvasStatus("Bảng vẽ đã được xóa");
    }
  };

  // Helper to format Excalidraw elements to clean/standard style (roughness: 0, normal font: 2, solid fill)
  const formatElementsToStyle = (elements: any[], style: "clean" | "sketchy" = "clean") => {
    return elements.map((el: any) => {
      const isClean = style === "clean";
      return {
        ...el,
        roughness: isClean ? 0 : 2, // 0 = Clean/Sharp (mặc định), 2 = Sketchy/Hand-drawn
        fontFamily: isClean ? 2 : 1, // 2 = Helvetica/Sans-serif (mặc định), 1 = Virgil (vẽ tay)
        fillStyle: isClean ? "solid" : (el.fillStyle || "hachure"),
        strokeStyle: el.strokeStyle || "solid",
        roundness: el.roundness ?? (isClean ? { type: 3 } : { type: 2 }),
      };
    });
  };

  // Helper function to compile and draw Mermaid code onto Excalidraw canvas
  const drawMermaidToCanvas = async (code: string) => {
    const { elements, files } = await parseMermaidToExcalidraw(code, {
      themeVariables: {
        fontSize: "18px",
      },
    });
    const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
    const rawElements = convertToExcalidrawElements(elements);
    
    // Apply clean default styling (straight lines, normal font, solid fills)
    const excalidrawElements = formatElementsToStyle(rawElements, "clean");

    if (excalidrawRef.current) {
      if (files && Object.keys(files).length > 0) {
        excalidrawRef.current.addFiles(Object.values(files));
      }
      excalidrawRef.current.updateScene({
        elements: excalidrawElements,
        commitToHistory: true,
      });
      excalidrawRef.current.scrollToContent(excalidrawElements, {
        fitToContent: true,
      });
      setElementCount(excalidrawElements.length);
    }
  };

  // Action: Compile Mermaid manually
  const handleImportMermaid = async () => {
    if (!mermaidCode.trim()) {
      setMermaidError("Vui lòng nhập mã nguồn Mermaid.");
      return;
    }
    setMermaidCompiling(true);
    setMermaidError("");
    setMermaidSuccessMsg("");
    try {
      await drawMermaidToCanvas(mermaidCode);
      setMermaidSuccessMsg("Đã vẽ sơ đồ lên Canvas thành công!");
      setCanvasStatus("Đã biên dịch Mermaid lên Canvas");
      setTimeout(() => setMermaidSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error("Lỗi biên dịch Mermaid:", err);
      setMermaidError(err.message || "Cú pháp Mermaid không hợp lệ. Vui lòng kiểm tra lại.");
    } finally {
      setMermaidCompiling(false);
    }
  };

  const handleSelectTemplate = (key: string) => {
    setSelectedTemplate(key);
    if (MERMAID_TEMPLATES[key]) {
      setMermaidCode(MERMAID_TEMPLATES[key].code);
      setMermaidError("");
    }
  };

  // Action: Call Backend AI Diagram Pipeline
  const handleGenerateDiagramWithAI = async () => {
    if (!aiPrompt.trim()) {
      setAiError("Vui lòng nhập mô tả ý tưởng sơ đồ của bạn.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setAiExplanation("");
    setAiDiagramType("");
    setAiStats(null);
    setCanvasStatus("AI đang thiết kế sơ đồ...");

    try {
      const response = await apiCall<{
        explanation?: string;
        excalidrawElements: any[];
        appState?: { viewBackgroundColor?: string; gridSize?: number };
        diagramType?: string;
        classification?: any;
        latencyMs?: number;
        totalCost?: number;
      }>("/ai-actions/execute", {
        method: "POST",
        body: JSON.stringify({
          actionType: "generate_diagram",
          input: {
            input_text: aiPrompt,
          },
        }),
      });

      if (response.data) {
        const { excalidrawElements, explanation, diagramType, appState, latencyMs, totalCost } =
          response.data;

        if (explanation) setAiExplanation(explanation);
        if (diagramType) setAiDiagramType(diagramType);
        setAiStats({ latencyMs, totalCost });

        if (excalidrawElements && excalidrawElements.length > 0 && excalidrawRef.current) {
          const cleanAiElements = formatElementsToStyle(excalidrawElements, "clean");
          excalidrawRef.current.updateScene({
            elements: cleanAiElements,
            appState: appState || { viewBackgroundColor: "#ffffff" },
            commitToHistory: true,
          });
          excalidrawRef.current.scrollToContent(cleanAiElements, {
            fitToContent: true,
          });
          setElementCount(cleanAiElements.length);
          setCanvasStatus(`AI đã vẽ xong sơ đồ (${cleanAiElements.length} phần tử)`);
        }
      }
    } catch (err: any) {
      console.error("Lỗi gọi AI sinh sơ đồ:", err);
      if (err.status === 401) {
        setAiError("Bạn chưa đăng nhập. Vui lòng đăng nhập để sử dụng tính năng AI.");
      } else if (err.code === "INSUFFICIENT_CREDIT" || err.status === 402) {
        setAiError("Tài khoản của bạn không đủ Credit để thực thi AI Action này.");
      } else {
        setAiError(err.message || "Đã xảy ra lỗi khi gọi AI sinh sơ đồ.");
      }
      setCanvasStatus("Lỗi khi gọi AI");
    } finally {
      setAiLoading(false);
    }
  };

  // Export PNG
  const handleExportPNG = async () => {
    if (!excalidrawRef.current) return;
    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();

    if (!elements || elements.length === 0) {
      alert("Bản vẽ chưa có đối tượng nào để xuất ảnh!");
      return;
    }
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements,
        appState,
        mimeType: "image/png",
        exportPadding: 24,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flintflow-diagram-${Date.now()}.png`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Lỗi xuất ảnh PNG:", e);
    }
  };

  // Export SVG
  const handleExportSVG = async () => {
    if (!excalidrawRef.current) return;
    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();

    if (!elements || elements.length === 0) {
      alert("Bản vẽ chưa có đối tượng nào để xuất ảnh!");
      return;
    }
    try {
      const { exportToSvg } = await import("@excalidraw/excalidraw");
      const svg = await exportToSvg({
        elements,
        appState,
        exportPadding: 24,
      });
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flintflow-diagram-${Date.now()}.svg`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Lỗi xuất ảnh SVG:", e);
    }
  };

  return (
    <AuthGuard>
      <div
        className="flex h-screen overflow-hidden bg-[#F5F3F0]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {/* ── FLINTFLOW DEFAULT SIDEBAR ── */}
        <Sidebar activePath="/draw-test" user={sidebarUser} />

        {/* ── MAIN CONTENT AREA ── */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* ── FLINTFLOW TOP BAR ── */}
          <div
            className="h-[74px] bg-white border-b border-[#ECEAE5] flex items-center justify-between flex-shrink-0 z-10"
            style={{ padding: "0 28px" }}
          >
            {/* Left: Page Title / Breadcrumbs */}
            <div className="flex items-center gap-3">
              <h1 className="text-[20px] font-[800] text-[#191817] flex items-center gap-2.5">
                <span>Diagram Studio</span>
                <span className="text-[11px] font-bold bg-[#EDEBE7] text-[#6B6862] rounded-full px-2.5 py-0.5">
                  AI + Mermaid
                </span>
              </h1>
            </div>

            {/* Right Action Tools */}
            <div className="flex items-center gap-2.5">
              {/* Credit balance chip */}
              <div
                className="hidden sm:flex items-center gap-2 bg-[#F0EEEA] rounded-full text-[13px] font-semibold text-[#191817]"
                style={{ padding: "8px 16px" }}
              >
                <span className="w-2 h-2 rounded-full bg-[#4F46E5] flex-shrink-0 animate-pulse" />
                <span>{user?.balance ?? 0} credits</span>
              </div>

              {/* Load previous drawing */}
              <button
                type="button"
                onClick={handleLoadFromLocal}
                title="Khôi phục bản vẽ từ LocalStorage"
                className="flex items-center gap-1.5 bg-white border-[1.5px] border-[#E4E1DC] hover:border-[#C7C4BE] hover:bg-[#FAF9F7] text-[#4B4842] text-[13px] font-semibold rounded-full px-3.5 py-2 transition active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[17px]">history</span>
                <span className="hidden md:inline">Tải lại</span>
              </button>

              {/* Clear canvas */}
              <button
                type="button"
                onClick={handleClearCanvas}
                title="Xóa trắng bảng vẽ"
                className="flex items-center gap-1.5 bg-white border-[1.5px] border-[#E4E1DC] hover:border-red-200 hover:bg-red-50 text-[#8A867E] hover:text-red-600 text-[13px] font-semibold rounded-full px-3 py-2 transition"
              >
                <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
              </button>

              {/* Export PNG */}
              <button
                type="button"
                onClick={handleExportPNG}
                className="flex items-center gap-1.5 bg-white border-[1.5px] border-[#E4E1DC] hover:border-[#4F46E5] hover:bg-[#F5F3FF] text-[#4F46E5] text-[13px] font-semibold rounded-full px-3.5 py-2 transition active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[17px]">image</span>
                <span>PNG</span>
              </button>

              {/* Export SVG */}
              <button
                type="button"
                onClick={handleExportSVG}
                className="flex items-center gap-1.5 bg-white border-[1.5px] border-[#E4E1DC] hover:border-[#4F46E5] hover:bg-[#F5F3FF] text-[#4F46E5] text-[13px] font-semibold rounded-full px-3.5 py-2 transition active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[17px]">code</span>
                <span>SVG</span>
              </button>

              {/* Toggle Side Panel Button */}
              <button
                type="button"
                onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                title={isPanelCollapsed ? "Mở rộng bảng AI" : "Thu gọn bảng AI"}
                className={`flex items-center gap-1.5 border-[1.5px] text-[13px] font-semibold rounded-full px-3 py-2 transition ${
                  isPanelCollapsed
                    ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                    : "bg-white border-[#E4E1DC] text-[#4B4842] hover:bg-[#FAF9F7]"
                }`}
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isPanelCollapsed ? "dock_to_left" : "dock_to_right"}
                </span>
                <span className="hidden lg:inline">
                  {isPanelCollapsed ? "Mở bảng AI" : "Thu gọn"}
                </span>
              </button>
            </div>
          </div>

          {/* ── WORKSPACE BODY ── */}
          <div className="flex flex-1 gap-4 p-4 min-h-0 overflow-hidden">
            {/* ── LEFT SIDE: DEFAULT EXCALIDRAW CANVAS ── */}
            <div className="flex-1 min-w-0 bg-white rounded-2xl border border-[#ECEAE5] shadow-sm flex flex-col relative overflow-hidden">
              <div className="flex-1 w-full h-full relative">
                <ExcalidrawWrapper excalidrawRef={excalidrawRef} onChange={handleCanvasChange} />
              </div>

              {/* Canvas Status Badge */}
              <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2.5 bg-white/90 backdrop-blur-md border border-[#E4E1DC] shadow-sm rounded-full px-3.5 py-1 text-[11px] text-[#6B6862]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="font-medium">{canvasStatus}</span>
                {elementCount > 0 && (
                  <>
                    <span className="text-[#D6D2CB]">•</span>
                    <span className="font-semibold text-[#191817]">{elementCount} phần tử</span>
                  </>
                )}
              </div>
            </div>

            {/* ── RIGHT SIDE: AI & MERMAID CONTROL CENTER ── */}
            {!isPanelCollapsed && (
              <div className="w-[430px] shrink-0 bg-white rounded-2xl border border-[#ECEAE5] shadow-sm flex flex-col overflow-hidden transition-all duration-200">
                {/* Right Panel Header */}
                <div className="p-4 border-b border-[#ECEAE5] bg-[#FAF9F7]/70">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-[14px] font-bold text-[#191817] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-[#4F46E5]">
                          auto_fix_high
                        </span>
                        Công cụ Tạo Sơ đồ
                      </h2>
                      <p className="text-[11px] text-[#8A867E]">
                        Sinh bằng AI hoặc tinh chỉnh mã Mermaid
                      </p>
                    </div>
                  </div>

                  {/* Segmented Control Pill Tabs */}
                  <div className="grid grid-cols-2 p-1 bg-[#EDEBE7] rounded-xl text-xs font-bold text-[#6B6862]">
                    <button
                      type="button"
                      onClick={() => setActiveTab("ai")}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
                        activeTab === "ai"
                          ? "bg-white text-[#4F46E5] shadow-sm"
                          : "hover:text-[#191817]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">sparkles</span>
                      <span>AI Gen Diagram</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("mermaid")}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
                        activeTab === "mermaid"
                          ? "bg-white text-[#4F46E5] shadow-sm"
                          : "hover:text-[#191817]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">data_object</span>
                      <span>Mermaid Thô</span>
                    </button>
                  </div>
                </div>

                {/* Panel Scrollable Body */}
                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                  {/* ══════════════ TAB 1: AI GEN DIAGRAM ══════════════ */}
                  {activeTab === "ai" && (
                    <div className="flex flex-col gap-3.5">
                      {/* AI Badge & Description */}
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EDE9FE] border border-[#DDD6FE] text-[#6D28D9] text-[11px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" />
                          AI-Native Pipeline
                        </div>
                        <span className="text-[11px] font-semibold text-[#8A867E]">
                          5 credits / lần
                        </span>
                      </div>

                      {/* Textarea Input */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-[#191817]">
                          Mô tả ý tưởng hoặc quy trình:
                        </label>
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          rows={4}
                          placeholder="Ví dụ: Vẽ sơ đồ luồng người dùng thanh toán qua cổng VNPay..."
                          className="w-full p-3 text-[13px] text-[#191817] bg-[#FAF9F7] border border-[#E4E1DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:bg-white resize-none leading-relaxed transition"
                        />
                      </div>

                      {/* Quick Suggestion Chips */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A867E]">
                          Mẫu gợi ý nhanh:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {AI_SUGGESTIONS.map((suggestion, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setAiPrompt(suggestion)}
                              className="text-[11px] font-medium bg-[#FAF9F7] hover:bg-[#F0EEEA] text-[#4B4842] border border-[#E4E1DC] rounded-lg px-2.5 py-1 text-left transition active:scale-[0.98]"
                            >
                              + {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Error Banner */}
                      {aiError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-red-500 flex-shrink-0">
                            warning
                          </span>
                          <span className="flex-1 font-medium">{aiError}</span>
                        </div>
                      )}

                      {/* AI Generate Action Button */}
                      <button
                        type="button"
                        onClick={handleGenerateDiagramWithAI}
                        disabled={aiLoading}
                        className={`w-full py-2.5 px-4 rounded-xl text-white text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${
                          aiLoading
                            ? "opacity-75 cursor-not-allowed"
                            : "hover:brightness-95 active:scale-[0.98]"
                        }`}
                        style={{
                          background: "linear-gradient(135deg,#7C74F0,#4F46E5 60%,#3B34B0)",
                          boxShadow: "0 6px 18px rgba(79,70,229,0.25)",
                        }}
                      >
                        {aiLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            <span>Đang thiết kế sơ đồ...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[17px]">
                              auto_awesome
                            </span>
                            <span>Tạo sơ đồ với AI ✨</span>
                          </>
                        )}
                      </button>

                      {/* AI Explanation / Result Output Card */}
                      {aiExplanation && (
                        <div className="p-3 bg-[#FAF9F7] border border-[#E4E1DC] rounded-xl flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B6862]">
                              Kết quả từ AI:
                            </span>
                            {aiDiagramType && (
                              <span className="px-2 py-0.5 text-[10px] font-bold text-[#4F46E5] bg-[#EEF2FF] border border-[#C7D2FE] rounded-full uppercase">
                                {aiDiagramType}
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-[#33312E] leading-relaxed whitespace-pre-wrap">
                            {aiExplanation}
                          </p>
                          {aiStats && aiStats.latencyMs && (
                            <div className="pt-2 border-t border-[#ECEAE5] flex items-center justify-between text-[11px] text-[#8A867E]">
                              <span>Thời gian: {(aiStats.latencyMs / 1000).toFixed(1)}s</span>
                              <button
                                type="button"
                                onClick={() => setActiveTab("mermaid")}
                                className="text-[#4F46E5] hover:underline font-semibold"
                              >
                                Tinh chỉnh mã thô ➔
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ══════════════ TAB 2: MERMAID THÔ ══════════════ */}
                  {activeTab === "mermaid" && (
                    <div className="flex flex-col gap-3 flex-1">
                      {/* Template Preset Selector - 4 Diagrams */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-bold text-[#191817] flex items-center justify-between">
                          <span>Chọn mẫu sơ đồ:</span>
                          <span className="text-[11px] font-normal text-[#8A867E]">4 mẫu chuẩn BA</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(MERMAID_TEMPLATES).map(([key, template]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleSelectTemplate(key)}
                              className={`p-2.5 rounded-xl text-left border transition flex flex-col gap-0.5 ${
                                selectedTemplate === key
                                  ? "bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5] shadow-xs"
                                  : "bg-[#FAF9F7] border-[#E4E1DC] text-[#4B4842] hover:bg-[#F0EEEA]"
                              }`}
                            >
                              <span className="text-[12px] font-bold tracking-tight">
                                {template.label}
                              </span>
                              <span className="text-[10px] text-[#8A867E] line-clamp-1 leading-snug">
                                {template.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Raw Code Editor */}
                      <div className="flex flex-col gap-1.5 flex-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[12px] font-bold text-[#191817]">
                            Mã nguồn Mermaid:
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(mermaidCode);
                              alert("Đã sao chép mã Mermaid!");
                            }}
                            className="text-[11px] text-[#4F46E5] hover:underline font-semibold flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              content_copy
                            </span>
                            Sao chép
                          </button>
                        </div>
                        <textarea
                          value={mermaidCode}
                          onChange={(e) => setMermaidCode(e.target.value)}
                          rows={11}
                          spellCheck={false}
                          className="w-full p-3 text-[12px] text-[#191817] bg-[#FAF9F7] border border-[#E4E1DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:bg-white resize-none leading-relaxed transition"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          placeholder="graph TD..."
                        />
                      </div>

                      {/* Success Message */}
                      {mermaidSuccessMsg && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-emerald-600">
                            check_circle
                          </span>
                          <span className="font-semibold">{mermaidSuccessMsg}</span>
                        </div>
                      )}

                      {/* Error Banner */}
                      {mermaidError && (
                        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-red-500 flex-shrink-0">
                            error
                          </span>
                          <span className="flex-1 font-mono text-[11px]">{mermaidError}</span>
                        </div>
                      )}

                      {/* Compile Button */}
                      <button
                        type="button"
                        onClick={handleImportMermaid}
                        disabled={mermaidCompiling}
                        className="w-full py-2.5 px-4 rounded-xl text-white text-[13px] font-bold transition-all flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.98] shadow-sm"
                        style={{
                          background: "linear-gradient(135deg,#059669,#10B981)",
                          boxShadow: "0 6px 18px rgba(16,185,129,0.25)",
                        }}
                      >
                        {mermaidCompiling ? (
                          <span>Đang biên dịch...</span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[17px]">
                              play_circle
                            </span>
                            <span>Vẽ sơ đồ lên Canvas ⚡</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
