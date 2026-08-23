"use client";

import React from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";

// Import động Excalidraw và tắt Server-Side Rendering (SSR)
const Excalidraw = dynamic(
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
        excalidrawAPI={(api) => {
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
