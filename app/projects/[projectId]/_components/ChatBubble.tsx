"use client";

import { useState } from "react";
import { ChatMessage } from "./ChatSessionSidebar";
import { DiscoveryEvaluation } from "../../../../lib/constants/section-types";

interface ChatBubbleProps {
  message: ChatMessage;
  onEvaluationReceived?: (evaluation: DiscoveryEvaluation) => void;
  overrideCompleteness?: number | null;
  messageIndex?: number;
  onRequestRollback?: (index: number) => void;
  disabled?: boolean;
}

export default function ChatBubble({
  message,
  onEvaluationReceived: _onEvaluationReceived,
  overrideCompleteness,
  messageIndex,
  onRequestRollback,
  disabled = false,
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
    if (content.startsWith("{") && content.endsWith("}")) {
      try {
        const data = JSON.parse(content);
        return {
          reply: data.reply || content,
          evaluation: data.evaluation,
        };
      } catch (_) {
        return { reply: content };
      }
    }
    return { reply: content };
  };

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      let formatted = line;
      // Bold text **text**
      formatted = formatted.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <li
            key={i}
            className="ml-4 list-disc text-[13px] text-[#33312D] leading-relaxed py-0.5"
            dangerouslySetInnerHTML={{
              __html: formatted.replace(/^[-*]\s+/, ""),
            }}
          />
        );
      }
      if (line.trim() === "") {
        return <div key={i} className="h-1.5" />;
      }
      return (
        <p
          key={i}
          className="text-[13px] text-[#33312D] leading-relaxed mb-1"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />
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

  const parsed = parseAiMessage(message.content);
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
        <span className="text-[10.5px] font-bold text-[#A8A49C]">
          FlintFlow AI Analyst
        </span>
        <div className="bg-white border border-[#ECEAE5] rounded-[18px] rounded-tl-[3px] p-5 shadow-[0_4px_16px_rgba(25,24,23,0.04)] space-y-3.5">
          <div className="text-[#191817] space-y-1.5">
            {renderMarkdown(parsed.reply)}
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
