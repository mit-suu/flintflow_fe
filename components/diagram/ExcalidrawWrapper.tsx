"use client";

import React from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";

// Import động Excalidraw và tắt Server-Side Rendering (SSR)
// dynamic<any>: gói @excalidraw/excalidraw không có type (xem types/excalidraw.d.ts),
// nên next/dynamic suy ra props là {} và mọi prop truyền vào thành lỗi TS2769.
const Excalidraw = dynamic<any>(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false }
);

interface ExcalidrawWrapperProps {
  initialData?: any;
  onChange?: (elements: readonly any[], appState: any) => void;
  excalidrawRef?: any;
  UIOptions?: any;
}

export default function ExcalidrawWrapper({
  initialData,
  onChange,
  excalidrawRef,
  UIOptions
}: ExcalidrawWrapperProps) {
  return (
    <div className="w-full h-full min-h-[500px] border-0 overflow-hidden relative">
      <Excalidraw
        excalidrawAPI={(api: any) => {
          if (excalidrawRef) {
            excalidrawRef.current = api;
          }
        }}
        initialData={initialData}
        onChange={onChange}
        UIOptions={UIOptions || {
          canvasActions: {
            toggleTheme: true,
            export: {
              saveFileToDisk: true,
            },
            loadScene: true,
            saveToActiveFile: true,
            clearCanvas: true,
          }
        }}
      />
    </div>
  );
}
