"use client";

import { ChatMessage } from "./ChatSessionSidebar";

interface ChatBubbleProps {
  message: ChatMessage;
  onSuggestedQuestionClick?: (question: string) => void;
}

export default function ChatBubble({
  message,
  onSuggestedQuestionClick,
}: ChatBubbleProps) {
  const isUser = message.role === "user";

  const parseAiMessage = (
    content: string
  ): { reply: string; suggestedQuestions?: string[] } => {
    if (content.startsWith("{") && content.endsWith("}")) {
      try {
        return JSON.parse(content);
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
          <p>{message.content}</p>
        </div>
      </div>
    );
  }

  const parsed = parseAiMessage(message.content);

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

          {/* Suggested Reply Questions */}
          {parsed.suggestedQuestions &&
            parsed.suggestedQuestions.length > 0 && (
              <div className="pt-2 border-t border-[#F0EEEA] flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A8A49C]">
                  Gợi ý trả lời nhanh:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.suggestedQuestions.map((q, qIdx) => (
                    <button
                      key={qIdx}
                      onClick={() => onSuggestedQuestionClick?.(q)}
                      className="px-3 py-1 rounded-full bg-[#FAF9F7] hover:bg-[#F4F3FE] border border-[#ECEAE5] hover:border-[#DDD9F6] text-[11.5px] font-semibold text-[#4F46E5] text-left transition-all cursor-pointer shadow-2xs"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
