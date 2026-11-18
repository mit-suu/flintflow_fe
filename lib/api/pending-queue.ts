/**
 * Hàng việc chờ người quyết (FLF-443, contract #51). Chỉ đọc, không gọi model.
 */
import type { PendingQueue } from "@/types/pending-queue";
import { apiCall } from "./client";

export const getPendingQueue = (projectId: string) =>
  apiCall<PendingQueue>(`/projects/${projectId}/pending-queue`);
