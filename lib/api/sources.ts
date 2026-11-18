/**
 * Nguồn tài liệu của yêu cầu (FLF-292): yêu cầu nào được viết từ đoạn nào của tài liệu upload.
 */
import type { RequirementSourcesResponse } from "@/types/sources";
import { apiCall } from "./client";

export const listRequirementSources = (projectId: string) =>
  apiCall<RequirementSourcesResponse>(`/projects/${projectId}/sources`);
