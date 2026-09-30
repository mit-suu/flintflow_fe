import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSpine } from "./useSpine";

const getSpine = vi.fn();

vi.mock("@/lib/api/spine", () => ({ getSpine: (...args: unknown[]) => getSpine(...args) }));
vi.mock("@/lib/api/pipeline", () => ({ resumeProject: vi.fn().mockResolvedValue({}) }));

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
