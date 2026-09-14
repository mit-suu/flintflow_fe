"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types/chat";
import { DiscoveryEvaluation } from "../../../../lib/constants/section-types";

interface ChatBubbleProps {
  message: ChatMessage;
  onEvaluationReceived?: (evaluation: DiscoveryEvaluation) => void;
  overrideCompleteness?: number | null;
  messageIndex?: number;
  onRequestRollback?: (index: number) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export default function ChatBubble({
  message,
  onEvaluationReceived: _onEvaluationReceived,
  overrideCompleteness,
  messageIndex,
  onRequestRollback,
  disabled = false,
  isStreaming = false,
}: ChatBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch (_) {
      return "";
    }
  };

  const parseAiMessage = (
    content: string
  ): {
    reply: string;
    evaluation?: DiscoveryEvaluation;
  } => {
    if (!content) return { reply: "" };

    const cleanReply = (raw: string): string => {
      let str = raw.trim();
      if (!str) return "";

      // Strip code fence
      if (str.startsWith("```")) {
        str = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      }

      // If it starts with { or contains "reply":
      if (str.startsWith("{") || str.includes('"reply"')) {
        // 1. Try full JSON parse
        try {
          const data = JSON.parse(str);
          if (data && typeof data.reply === "string") {
            return cleanReply(data.reply);
          }
        } catch (_) { }

        // 2. Non-greedy regex match for "reply": "..."
        const replyMatch = str.match(
          /(?:'|")reply(?:'|")\s*:\s*(['"])([\s\S]*?)(?<!\\)\1(?:\s*[,}]\s*|$)/
        );
        if (replyMatch && replyMatch[2] !== undefined) {
          try {
            const unescaped = JSON.parse(`"${replyMatch[2]}"`);
            return cleanReply(unescaped);
          } catch (_) {
            return replyMatch[2]
              .replace(/\\n/g, "\n")
              .replace(/\\"/g, '"')
              .replace(/\\t/g, "\t")
              .replace(/\\\\/g, "\\");
          }
        }

        // 3. Truncated in the middle of "reply"
        const openMatch = str.match(/(?:'|")reply(?:'|")\s*:\s*(['"])([\s\S]*)$/);
        if (openMatch && openMatch[2] !== undefined) {
          let unclosed = openMatch[2];
          if (unclosed.endsWith(openMatch[1])) {
            unclosed = unclosed.slice(0, -1);
          }
          return unclosed
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\t/g, "\t")
            .replace(/\\\\/g, "\\")
            .trim();
        }

        // 4. Strip leading {"reply":"... and trailing metadata
        const stripped = str
          .replace(/^\{[\s\S]*?"reply"\s*:\s*"/i, "")
          .replace(/"\s*,[\s\S]*$/, "")
          .replace(/\\n/g, "\n")
          .replace(/\\"/g, '"')
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\");
        if (stripped && !stripped.startsWith("{")) {
          return stripped.trim();
        }
      }

      return str;
    };

    let evaluation: DiscoveryEvaluation | undefined;
    try {
      const data = JSON.parse(content);
      if (data && typeof data === "object") {
        evaluation = data.evaluation;
      }
    } catch (_) {
      const evalMatch = content.match(/"evaluation"\s*:\s*(\{[\s\S]*?\})/);
      if (evalMatch && evalMatch[1]) {
        try {
          evaluation = JSON.parse(evalMatch[1]);
        } catch (_) { }
      }
    }

    return {
      reply: cleanReply(content),
      evaluation,
    };
  };

  const parsed = parseAiMessage(message.content);

  // Smooth continuous typewriter ticker for streaming
  const [displayedReply, setDisplayedReply] = useState(parsed.reply);
  const targetReplyRef = useRef(parsed.reply);

  useEffect(() => {
    targetReplyRef.current = parsed.reply;
  }, [parsed.reply]);

  // Khi không stream, UI dùng thẳng parsed.reply (activeReply) nên ticker chỉ chạy lúc stream
  useEffect(() => {
    if (!isStreaming) return;

    let animationFrameId: number;
    let lastTick = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTick;
      // Run smoothly at ~16ms (60 FPS)
      if (elapsed >= 16) {
        lastTick = now;
        setDisplayedReply((current) => {
          const target = targetReplyRef.current;
          if (current.length >= target.length) return current;

          const diff = target.length - current.length;
          // Smooth adaptive speed: flows continuously, speeds up gracefully if far behind
          let step = 1;
          if (diff > 80) step = 5;
          else if (diff > 40) step = 3;
          else if (diff > 15) step = 2;

          return target.slice(0, current.length + step);
        });
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isStreaming]);

  const activeReply = isStreaming ? displayedReply : parsed.reply;

  const renderMarkdown = (text: string, showCursor: boolean = false) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const isLastLine = i === lines.length - 1;
      let formatted = line;
      // Auto-close incomplete bold tag while streaming
      const starCount = (line.match(/\*\*/g) || []).length;
      if (starCount % 2 !== 0) {
        formatted += "**";
      }
      // Bold text **text**
      formatted = formatted.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

      const cursorElement = showCursor && isLastLine ? (
        <span
          className=""
          style={{ verticalAlign: "-2px" }}
        />
      ) : null;

      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li
            key={i}
            className="ml-4 list-disc text-[13px] text-[#33312D] leading-relaxed py-0.5"
          >
            <span dangerouslySetInnerHTML={{ __html: formatted.replace(/^[-*]\s+/, "") }} />
            {cursorElement}
          </li>
        );
      }
      if (line.trim() === "") {
        if (cursorElement) {
          return (
            <div key={i} className="h-4 flex items-center">
              {cursorElement}
            </div>
          );
        }
        return <div key={i} className="h-1.5" />;
      }
      return (
        <p
          key={i}
          className="text-[13px] text-[#33312D] leading-relaxed mb-1"
        >
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
          {cursorElement}
        </p>
      );
    });
  };

  if (isUser) {
    const formattedTime = formatTimestamp(message.createdAt);
    return (
      <div className="flex flex-col items-end space-y-1 group">
        <div className="bg-[#F4F3FE] border border-[#DDD9F6] text-[#191817] px-4 py-2.5 rounded-[16px] rounded-tr-[3px] max-w-[85%] text-[13px] shadow-[0_2px_8px_rgba(79,70,229,0.06)] leading-relaxed flex flex-col gap-0.5">
          <p className="whitespace-pre-wrap">{message.content}</p>

          {/* Action bar: Timestamp, Copy, Rollback - phong cách Antigravity (chỉ hiện khi hover) */}
          <div className="flex items-center justify-end gap-1.5 text-[11px] text-[#8A867E] select-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto mt-0.5">
            {formattedTime && (
              <span className="text-[10.5px] text-[#8A867E] leading-none">{formattedTime}</span>
            )}

            {/* Nút Sao chép */}
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 hover:bg-[#E8E5F8] text-[#8A867E] hover:text-[#191817] rounded-[5px] transition-colors cursor-pointer flex items-center justify-center"
              title={copied ? "Đã sao chép!" : "Sao chép tin nhắn"}
            >
              {copied ? (
                <span className="text-[#15803D] font-bold text-[11px] leading-none">✓</span>
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              )}
            </button>

            {/* Nút Hoàn tác */}
            {typeof messageIndex === "number" && onRequestRollback && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRequestRollback(messageIndex)}
                className="p-1 hover:bg-[#E8E5F8] text-[#8A867E] hover:text-[#4F46E5] rounded-[5px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                title="Hoàn tác về câu hỏi này"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const completeness =
    typeof overrideCompleteness === "number"
      ? overrideCompleteness
      : parsed.evaluation?.stepCompleteness;

  return (
    <div className="flex items-start gap-3">
      <div
        className="w-7 h-7 rounded-[9px] text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-[0_4px_10px_rgba(79,70,229,0.3)] mt-1"
        style={{
          background: "linear-gradient(135deg,#7C74F0,#4F46E5)",
        }}
      >
        F
      </div>

      <div className="flex flex-col gap-1.5 w-full max-w-[90%]">
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold text-[#A8A49C]">
            FlintFlow AI Analyst
          </span>
          {isStreaming && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4F46E5] bg-[#F4F3FE] px-2 py-0.5 rounded-full border border-[#DDD9F6] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5]" />
              Đang phản hồi...
            </span>
          )}
        </div>
        <div className="bg-white border border-[#ECEAE5] rounded-[18px] rounded-tl-[3px] p-5 shadow-[0_4px_16px_rgba(25,24,23,0.04)] space-y-3.5">
          <div className="text-[#191817] space-y-1.5 relative">
            {activeReply ? (
              renderMarkdown(activeReply, isStreaming)
            ) : isStreaming ? (
              <div className="flex items-center gap-2 py-1.5 text-[#6B6862] text-[12.5px]">
                <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-ping" />
              </div>
            ) : null}
          </div>

          {/* Completeness Indicator for Discovery mode */}
          {parsed.evaluation && (
            <div className="flex items-center gap-1.5 pt-2 border-t border-[#F0EEEA]">
              <div className="flex-1 h-1 bg-[#F0EEEA] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${completeness}%`,
                    background:
                      (completeness ?? 0) >= 80
                        ? "#22C55E"
                        : (completeness ?? 0) >= 50
                          ? "#F59E0B"
                          : "#4F46E5",
                  }}
                />
              </div>
              <span className="text-[10px] font-bold text-[#8A867E] shrink-0">
                {completeness}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
