"use client";

import { ChatMessage } from "./ChatSessionSidebar";
import { DiscoveryEvaluation } from "../../../../lib/constants/section-types";

interface ChatBubbleProps {
  message: ChatMessage;
  onEvaluationReceived?: (evaluation: DiscoveryEvaluation) => void;
  overrideCompleteness?: number | null;
}

export default function ChatBubble({
  message,
  onEvaluationReceived: _onEvaluationReceived,
  overrideCompleteness,
}: ChatBubbleProps) {
  const isUser = message.role === "user";

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
    return (
      <div className="flex flex-col items-end space-y-1">
        <div className="bg-[#F4F3FE] border border-[#DDD9F6] text-[#191817] px-4 py-3 rounded-[16px] rounded-tr-[3px] max-w-[85%] text-[13px] shadow-[0_2px_8px_rgba(79,70,229,0.06)] leading-relaxed">
          <p className="whitespace-pre-wrap">{message.content}</p>
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
