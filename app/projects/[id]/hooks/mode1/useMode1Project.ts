"use client";

import { useCallback, useEffect, useState } from "react";
import { getProject } from "@/lib/api/projects";
import { fetchBalance } from "@/lib/api/billing";
import type { Project } from "@/types/project";
import { errorText } from "../../_components/mode1/errors";

/** Project + số credit khả dụng cho khung trang mode 1. `reload` gọi lại sau mỗi bước làm đổi `import_state`. */
export function useMode1Project(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // setState chỉ trong callback của promise (react-hooks/set-state-in-effect)
  const reload = useCallback(
    () =>
      Promise.all([
        getProject(projectId)
          .then((res) => {
            setProject(res.data);
            setError(null);
          })
          .catch((err: unknown) => setError(errorText(err, "Không tải được dự án"))),
        fetchBalance()
          .then((b) => setCredits(b.available ?? b.balance))
          .catch(() => undefined),
      ]).then(() => undefined),
    [projectId]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { project, credits, error, reload };
}
