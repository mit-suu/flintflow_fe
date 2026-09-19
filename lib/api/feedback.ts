import { apiCall } from "./client";

/** Loại góp ý — khớp `FEEDBACK_CATEGORIES` ở BE (`modules/feedback/feedback.model.ts`). */
export type FeedbackCategory = "bug" | "suggestion" | "other";

export const FEEDBACK_MESSAGE_MAX = 2000;

export interface FeedbackRequest {
  category: FeedbackCategory;
  message: string;
}

export interface FeedbackReceipt extends FeedbackRequest {
  _id: string;
  createdAt: string;
}

/** `POST /feedback` (UC-12): member gửi góp ý; admin đọc ở `GET /admin/feedback`. */
export const submitFeedback = (body: FeedbackRequest) =>
  apiCall<FeedbackReceipt>("/feedback", { method: "POST", body: JSON.stringify(body) });
