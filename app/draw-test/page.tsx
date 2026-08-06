"use client";

import React, { useRef, useState } from "react";
import ExcalidrawWrapper from "@/components/diagram/ExcalidrawWrapper";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { apiCall } from "@/lib/api";

export default function DrawTestPage() {
  const excalidrawRef = useRef<any>(null);
  
  // Trạng thái cho tính năng Import Mermaid
  const [mermaidCode, setMermaidCode] = useState<string>(
    "graph TD\n    A[Bắt đầu] --> B(Đăng nhập)\n    B --> C{Thành công?}\n    C -->|Đúng| D[Vào Dashboard]\n    C -->|Sai| E[Thông báo lỗi]"
  );
  const [mermaidError, setMermaidError] = useState<string>("");

  // Trạng thái cho tính năng AI sinh sơ đồ
  const [aiPrompt, setAiPrompt] = useState<string>("vẽ luồng đăng ký tài khoản mới bằng số điện thoại và gửi mã OTP");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [aiDiagramType, setAiDiagramType] = useState<string>("");

  const handleCanvasChange = (elements: readonly any[], appState: any) => {
    if (elements.length > 0) {
      const sceneData = JSON.stringify({ elements, appState });
      localStorage.setItem("flintflow_draw_test", sceneData);
    }
  };

  const handleLoadFromLocal = () => {
    if (!excalidrawRef.current) return;
    const saved = localStorage.getItem("flintflow_draw_test");
    if (saved) {
      try {
        const { elements, appState } = JSON.parse(saved);
        excalidrawRef.current.updateScene({ elements, appState });
      } catch (e) {
        console.error("Lỗi parse dữ liệu vẽ:", e);
      }
    } else {
      alert("Không có bản vẽ nào được lưu trước đó trong trình duyệt.");
    }
  };

  // Hàm helper dùng chung để parse và vẽ Mermaid lên canvas
  const drawMermaidToCanvas = async (code: string) => {
    const { elements } = await parseMermaidToExcalidraw(code, {
      themeVariables: {
        fontSize: "20px",
      },
    });
    const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
    const excalidrawElements = convertToExcalidrawElements(elements);
    if (excalidrawRef.current) {
      excalidrawRef.current.updateScene({
        elements: excalidrawElements,
        commitToHistory: true,
      });
    }
  };

  // Tính năng: Biên dịch Mermaid sang Excalidraw Elements thủ công
  const handleImportMermaid = async () => {
    if (!mermaidCode.trim()) {
      setMermaidError("Vui lòng nhập code Mermaid.");
      return;
    }
    setMermaidError("");
    try {
      await drawMermaidToCanvas(mermaidCode);
    } catch (err: any) {
      console.error("Lỗi biên dịch Mermaid:", err);
      setMermaidError(err.message || "Cú pháp Mermaid không hợp lệ. Vui lòng kiểm tra lại.");
    }
  };

  // Tính năng: Gọi Backend để AI sinh sơ đồ Excalidraw JSON rồi vẽ lên canvas
  const handleGenerateDiagramWithAI = async () => {
    if (!aiPrompt.trim()) {
      setAiError("Vui lòng nhập mô tả ý tưởng sơ đồ.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setAiExplanation("");
    setAiDiagramType("");

    try {
      // Gọi API execute AI Action — giờ trả về Excalidraw JSON elements trực tiếp
      const response = await apiCall<{
        explanation?: string;
        excalidrawElements: any[];
        appState?: { viewBackgroundColor?: string; gridSize?: number };
        diagramType?: string;
        classification?: any;
      }>(
        "/ai-actions/execute",
        {
          method: "POST",
          body: JSON.stringify({
            actionType: "generate_diagram",
            input: {
              input_text: aiPrompt,
            },
          }),
        }
      );

      if (response.data) {
        const { excalidrawElements, explanation, diagramType, appState } = response.data;
        
        // 1. Cập nhật giải thích và loại sơ đồ
        if (explanation) {
          setAiExplanation(explanation);
        }
        if (diagramType) {
          setAiDiagramType(diagramType);
        }
        
        // 2. Load Excalidraw elements trực tiếp lên canvas
        if (excalidrawElements && excalidrawElements.length > 0 && excalidrawRef.current) {
          excalidrawRef.current.updateScene({
            elements: excalidrawElements,
            appState: appState || { viewBackgroundColor: "#ffffff" },
            commitToHistory: true,
          });
        }
      }
    } catch (err: any) {
      console.error("Lỗi gọi AI sinh sơ đồ:", err);
      if (err.status === 401) {
        setAiError("Bạn chưa Đăng nhập. Hãy đăng nhập vào FlintFlow trước để cấp quyền gọi AI.");
      } else if (err.code === "INSUFFICIENT_CREDIT" || err.status === 402) {
        setAiError("Tài khoản của bạn không đủ Credit để thực thi AI Action này.");
      } else {
        setAiError(err.message || "Đã xảy ra lỗi khi gọi AI sinh sơ đồ.");
      }
    } finally {
      setAiLoading(false);
    }
  };

  // Tính năng: Xuất ảnh PNG tải xuống máy
  const handleExportPNG = async () => {
    if (!excalidrawRef.current) return;
    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();
    
    if (!elements || elements.length === 0) {
      alert("Bản vẽ chưa có hình vẽ nào để xuất ảnh!");
      return;
    }
    try {
      const { exportToBlob } = await import("@excalidraw/excalidraw");
      const blob = await exportToBlob({
        elements,
        appState,
        mimeType: "image/png",
        exportPadding: 20,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flintflow-diagram.png";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Lỗi xuất ảnh PNG:", e);
    }
  };

  // Tính năng: Xuất ảnh SVG tải xuống máy
  const handleExportSVG = async () => {
    if (!excalidrawRef.current) return;
    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();

    if (!elements || elements.length === 0) {
      alert("Bản vẽ chưa có hình vẽ nào để xuất ảnh!");
      return;
    }
    try {
      const { exportToSvg } = await import("@excalidraw/excalidraw");
      const svg = await exportToSvg({
        elements,
        appState,
        exportPadding: 20,
      });
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flintflow-diagram.svg";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Lỗi xuất ảnh SVG:", e);
    }
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-gray-50 p-4">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-800">FlintFlow Board - Tích hợp AI & Mermaid</h1>
          <p className="text-sm text-gray-500">Sinh sơ đồ tự động bằng AI Action Framework và chỉnh sửa trực quan</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleLoadFromLocal}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Tải bản vẽ cũ
          </button>
          <button
            onClick={handleExportPNG}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Xuất file PNG
          </button>
          <button
            onClick={handleExportSVG}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
          >
            Xuất file SVG
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left Side: Control Panel (AI & Mermaid Input) */}
        <div className="w-80 bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col gap-6 overflow-y-auto">
          
          {/* Section 1: AI Prompt Generator */}
          <div className="flex flex-col gap-3 pb-4 border-b border-gray-100">
            <div>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider text-purple-600 bg-purple-50 rounded-full uppercase">AI-Native</span>
              <h2 className="text-sm font-bold text-gray-700 mt-1 uppercase tracking-wider">Sinh sơ đồ bằng AI</h2>
              <p className="text-xs text-gray-400">Nhập ý tưởng nghiệp vụ để AI tự động vẽ</p>
            </div>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="w-full p-2 h-24 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Ví dụ: luồng mua hàng và thanh toán bằng ví Momo..."
            />
            {aiError && <p className="text-xs text-red-500 font-medium">{aiError}</p>}
            
            <button
              onClick={handleGenerateDiagramWithAI}
              disabled={aiLoading}
              className={`w-full py-2 text-sm font-bold text-white rounded-md transition-all ${
                aiLoading ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 shadow-sm"
              }`}
            >
              {aiLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang thiết kế...
                </span>
              ) : (
                "Thiết kế bằng AI ✨"
              )}
            </button>

            {aiExplanation && (
              <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                {aiDiagramType && (
                  <span className="inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 bg-blue-50 rounded-full uppercase mb-2">
                    {aiDiagramType}
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase text-purple-700 block">Giải thích từ AI:</span>
                <p className="text-xs text-purple-950 mt-1 leading-relaxed">{aiExplanation}</p>
              </div>
            )}
          </div>

          {/* Section 2: Raw Mermaid Input */}
          <div className="flex-1 flex flex-col gap-3 min-h-[250px]">
            <div>
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Mã nguồn Sơ đồ (Mermaid)</h2>
              <p className="text-xs text-gray-400">Xem và sửa mã Mermaid thô để tinh chỉnh</p>
            </div>
            <textarea
              value={mermaidCode}
              onChange={(e) => setMermaidCode(e.target.value)}
              className="flex-1 w-full p-2 text-sm font-mono border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="graph TD..."
            />
            {mermaidError && <p className="text-xs text-red-500 font-medium">{mermaidError}</p>}
            <button
              onClick={handleImportMermaid}
              className="w-full py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors"
            >
              Vẽ sơ đồ lên Canvas
            </button>
          </div>

        </div>

        {/* Right Side: Excalidraw Canvas */}
        <div className="flex-1 bg-white rounded-lg shadow-inner overflow-hidden border border-gray-200">
          <ExcalidrawWrapper
            excalidrawRef={excalidrawRef}
            onChange={handleCanvasChange}
          />
        </div>
      </div>
    </div>
  );
}
