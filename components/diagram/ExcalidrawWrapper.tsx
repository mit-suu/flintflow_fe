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
}

export default function ExcalidrawWrapper({
  initialData,
  onChange,
  excalidrawRef
}: ExcalidrawWrapperProps) {
  return (
    <div className="w-full h-full min-h-[500px] border border-gray-200 rounded-lg overflow-hidden relative">
      <Excalidraw
        excalidrawAPI={(api) => {
          if (excalidrawRef) {
            excalidrawRef.current = api;
          }
        }}
        initialData={initialData}
        onChange={onChange}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: false,
            loadScene: false,
          }
        }}
      />
    </div>
  );
}
