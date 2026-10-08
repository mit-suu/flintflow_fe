import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSpine } from "./useSpine";

const getSpine = vi.fn();

vi.mock("@/lib/api/spine", () => ({ getSpine: (...args: unknown[]) => getSpine(...args) }));
const resumeProject = vi.fn<(projectId: string) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock("@/lib/api/pipeline", () => ({ resumeProject: (projectId: string) => resumeProject(projectId) }));

const spineAt = (version: number) => ({ data: { projectId: "p1", spine_version: version } });

describe("useSpine.reload", () => {
  it("trả spine_version vừa đọc để nơi gọi nâng base_version ngay (không đợi effect theo state)", async () => {
    getSpine.mockResolvedValueOnce(spineAt(10));
    const { result } = renderHook(() => useSpine("p1"));
    await waitFor(() => expect(result.current.version).toBe(10));

    getSpine.mockResolvedValueOnce(spineAt(11));
    let version: number | null = null;
    await act(async () => {
      version = await result.current.reload();
    });
    expect(version).toBe(11);
  });

  it("lỗi mạng ⇒ null, không ném", async () => {
    getSpine.mockResolvedValueOnce(spineAt(10));
    const { result } = renderHook(() => useSpine("p1"));
    await waitFor(() => expect(result.current.version).toBe(10));

    getSpine.mockRejectedValueOnce(new Error("mất mạng"));
    let version: number | null = 0;
    await act(async () => {
      version = await result.current.reload();
    });
    expect(version).toBeNull();
  });
});

describe("useSpine — Viewer", () => {
  it("canEdit = false ⇒ chỉ đọc Spine, không gọi POST /resume (thao tác ghi, Viewer luôn nhận 403)", async () => {
    resumeProject.mockClear();
    getSpine.mockResolvedValueOnce(spineAt(5));
    const { result } = renderHook(() => useSpine("p1", true, false));
    await waitFor(() => expect(result.current.version).toBe(5));
    expect(resumeProject).not.toHaveBeenCalled();
  });

  it("canEdit = true ⇒ resume trước rồi mới đọc Spine", async () => {
    resumeProject.mockClear();
    getSpine.mockResolvedValueOnce(spineAt(6));
    const { result } = renderHook(() => useSpine("p1", true, true));
    await waitFor(() => expect(result.current.version).toBe(6));
    expect(resumeProject).toHaveBeenCalledWith("p1");
  });
});
