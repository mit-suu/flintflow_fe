"use client";

import { useCallback, useEffect, useState } from "react";
import { getProject } from "@/lib/api/projects";
import { fetchBalance } from "@/lib/api/billing";
import type { Project } from "@/types/project";
import { useErrorText } from "../../_components/mode1/i18n";

/** Project + số credit khả dụng cho khung trang mode 1. `reload` gọi lại sau mỗi bước làm đổi `import_state`. */
export function useMode1Project(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errText = useErrorText();

  // setState chỉ trong callback của promise (react-hooks/set-state-in-effect)
  const reload = useCallback(
    () =>
      Promise.all([
        getProject(projectId)
          .then((res) => {
            setProject(res.data);
            setError(null);
          })
          .catch((err: unknown) => setError(errText(err, "loadProject"))),
        fetchBalance()
          .then((b) => setCredits(b.available ?? b.balance))
          .catch(() => undefined),
      ]).then(() => undefined),
    [projectId, errText]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { project, credits, error, reload };
}
