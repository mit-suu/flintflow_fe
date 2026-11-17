/**
 * Trợ lý Google Docs (BE contract #48–#50): chat với một Google Doc; trợ lý đọc qua tool MCP, còn mọi thay đổi chỉ là
 * **đề xuất** — Google Doc chỉ đổi khi người dùng bấm Áp dụng. 2 credit / tin nhắn; Áp dụng / Bỏ qua miễn phí.
 */
import { streamSse, type SseHandlers } from "../ai-stream";
import { apiCall } from "./client";

export type DocsAgentTool = "replace_text" | "insert_text";

export interface DocsAgentPendingAction {
  id: string;
  tool: DocsAgentTool;
  documentId: string;
  /** replace_text: `{ find, replace, matchCase }` · insert_text: `{ afterHeading? | atEnd?, text, asHeading }`. */
  args: Record<string, unknown>;
  /** replace_text: `{ matches, samples[{ heading, before, after }] }` · insert_text: `{ location, text, asHeading, headingLevel }`. */
  preview: Record<string, unknown>;
  expiresAt: string;
}

export interface DocsAgentTurn {
  role: "user" | "assistant";
  content: string;
}

export type DocsAgentEvent =
  | { type: "tool-call"; name: string; args: { heading?: string; query?: string; afterHeading?: string } }
  | { type: "text-delta"; delta: string }
  | {
      type: "finish";
      data: { reply: string; pending_actions: DocsAgentPendingAction[]; document_title: string };
      cost: number;
    }
  | { type: "error"; error: string; code?: string };

const base = (projectId: string) => `/projects/${projectId}/google-docs/agent`;

/** Lỗi trước khi mở luồng (chưa nối Google, không có quyền với tài liệu) ném `ApiClientError` như request thường. */
export const streamDocsAgentMessage = (
  projectId: string,
  body: { documentId: string; message: string; history: DocsAgentTurn[] },
  handlers: SseHandlers<DocsAgentEvent>
) => streamSse<DocsAgentEvent>(`${base(projectId)}/messages/stream`, body, handlers);

export const applyDocsAgentAction = async (projectId: string, actionId: string) => {
  const res = await apiCall<{ applied: true; actionId: string; documentId: string; revisionId: string | null }>(
    `${base(projectId)}/actions/${actionId}/apply`,
    { method: "POST" }
  );
  return res.data;
};

export const dismissDocsAgentAction = async (projectId: string, actionId: string) => {
  const res = await apiCall<{ dismissed: true; actionId: string }>(`${base(projectId)}/actions/${actionId}/dismiss`, { method: "POST" });
  return res.data;
};

/** Link mở một Google Doc theo ID (dạng link chuẩn của Google Docs). */
export const googleDocUrl = (documentId: string) => `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit`;
