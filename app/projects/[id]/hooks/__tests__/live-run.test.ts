import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/pipeline", async (importOriginal) => ({ ...(await importOriginal<object>()), getActiveRunState: vi.fn() }));

import { getActiveRunState } from "@/lib/api/pipeline";
import { liveRunOf } from "../useStepRunner";

const run = (status: string, alive = true) => ({ data: { step_id: "S-5.3@S12", run_id: "r1", status, alive } }) as never;

describe("FLF-432 liveRunOf - luồng SSE đóng mà không có cổng", () => {
  beforeEach(() => vi.mocked(getActiveRunState).mockReset());

  it("BE đã ở cổng / đang chờ trả lời ⇒ trả lượt đó để dựng lại thẻ", async () => {
    vi.mocked(getActiveRunState).mockResolvedValue(run("gate"));
    expect((await liveRunOf("p1"))?.status).toBe("gate");
    vi.mocked(getActiveRunState).mockResolvedValue(run("waiting_answer"));
    expect((await liveRunOf("p1"))?.status).toBe("waiting_answer");
  });

  it("còn chạy và sống ⇒ trả; lượt chết / xong ⇒ null", async () => {
    vi.mocked(getActiveRunState).mockResolvedValue(run("running"));
    expect(await liveRunOf("p1")).not.toBeNull();
    vi.mocked(getActiveRunState).mockResolvedValue(run("running", false));
    expect(await liveRunOf("p1")).toBeNull();
    vi.mocked(getActiveRunState).mockResolvedValue(run("done"));
    expect(await liveRunOf("p1")).toBeNull();
  });
});
