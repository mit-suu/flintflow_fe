import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_APPLY_GAP_MS, VERSION_TICK_MS, useDocumentFollow, type UseDocumentFollowOptions } from "./useDocumentFollow";
import * as pipeline from "@/lib/api/pipeline";

vi.mock("@/lib/api/pipeline", () => ({ getProjectVersion: vi.fn() }));

const getVersion = vi.mocked(pipeline.getProjectVersion);
const reply = (spine_version: number, document_revision: string) =>
  getVersion.mockResolvedValue({ data: { spine_version, document_revision }, error: null });

let visibility: DocumentVisibilityState = "visible";
const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
};

const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)));
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe("useDocumentFollow", () => {
  const onApply = vi.fn();
  const onSpineOnly = vi.fn();
  const base: UseDocumentFollowOptions = {
    projectId: "p1",
    enabled: true,
    shownRevision: "r1",
    knownSpineVersion: 5,
    busy: false,
    streaming: false,
    documentReloading: false,
    onApply,
    onSpineOnly,
  };
  const mount = (overrides: Partial<UseDocumentFollowOptions> = {}) =>
    renderHook((props: Partial<UseDocumentFollowOptions>) => useDocumentFollow({ ...base, ...props }), { initialProps: overrides });

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
    getVersion.mockReset();
    onApply.mockReset();
    onSpineOnly.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("tab ẩn ⇒ không hỏi; hiện lại ⇒ hỏi ngay", async () => {
    visibility = "hidden";
    reply(5, "r1");
    mount();
    await advance(VERSION_TICK_MS * 3);
    expect(getVersion).not.toHaveBeenCalled();

    setVisibility("visible");
    await flush();
    expect(getVersion).toHaveBeenCalledTimes(1);
    expect(getVersion).toHaveBeenCalledWith("p1");
  });

  it("tab hiện ⇒ hỏi lúc mở rồi mỗi 20 giây, mỗi lúc chỉ một lượt bay", async () => {
    reply(5, "r1");
    mount();
    await flush();
    expect(getVersion).toHaveBeenCalledTimes(1);
    await advance(VERSION_TICK_MS);
    expect(getVersion).toHaveBeenCalledTimes(2);

    let release: (value: Awaited<ReturnType<typeof pipeline.getProjectVersion>>) => void = () => undefined;
    getVersion.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    await advance(VERSION_TICK_MS);
    expect(getVersion).toHaveBeenCalledTimes(3);
    setVisibility("visible"); // lượt trước chưa xong
    await advance(VERSION_TICK_MS);
    expect(getVersion).toHaveBeenCalledTimes(3);
    release({ data: { spine_version: 5, document_revision: "r1" }, error: null });
    await flush();
    await advance(VERSION_TICK_MS);
    expect(getVersion).toHaveBeenCalledTimes(4);
  });

  it("đang có luồng SSE ở tab này, hoặc bị tắt ⇒ không hỏi", async () => {
    reply(5, "r1");
    mount({ streaming: true });
    mount({ enabled: false });
    await advance(VERSION_TICK_MS * 2);
    expect(getVersion).not.toHaveBeenCalled();
  });

  it("lỗi mạng ⇒ im lặng, nhịp sau hỏi lại", async () => {
    getVersion.mockRejectedValueOnce(new Error("Failed to fetch"));
    const { result } = mount();
    await flush();
    expect(result.current.hasNewer).toBe(false);
    expect(onApply).not.toHaveBeenCalled();
    reply(5, "r1");
    await advance(VERSION_TICK_MS);
    expect(getVersion).toHaveBeenCalledTimes(2);
  });

  it("revision mới + rảnh ⇒ tự áp qua onApply, không đụng onSpineOnly", async () => {
    reply(6, "r2");
    const { result } = mount();
    await flush();
    await advance(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onSpineOnly).not.toHaveBeenCalled();
    expect(result.current.hasNewer).toBe(true);
  });

  it("đang bận ⇒ không áp, hasNewer = true; hết bận ⇒ tự áp", async () => {
    reply(6, "r2");
    const { result, rerender } = mount({ busy: true });
    await flush();
    await advance(100);
    expect(onApply).not.toHaveBeenCalled();
    expect(result.current.hasNewer).toBe(true);
    expect(result.current.behind).toBe(true);

    rerender({ busy: false });
    await advance(1);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("apply() từ dải báo áp ngay dù đang bận", async () => {
    reply(6, "r2");
    const { result } = mount({ busy: true });
    await flush();
    act(() => result.current.apply());
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("chỉ spine_version đổi (cùng revision) ⇒ onSpineOnly, không tải lại tài liệu", async () => {
    reply(7, "r1");
    const { result } = mount();
    await flush();
    await advance(1);
    expect(onSpineOnly).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(result.current.hasNewer).toBe(false);
    expect(result.current.behind).toBe(true);
  });

  it("hai lần tự áp cách nhau ≥ 10 giây", async () => {
    reply(6, "r2");
    const { rerender } = mount();
    await flush();
    await advance(1);
    expect(onApply).toHaveBeenCalledTimes(1);

    // Tài liệu về bản r2, rồi BE sang r3 ngay sau đó
    rerender({ shownRevision: "r2", knownSpineVersion: 6 });
    reply(7, "r3");
    await advance(3_000);
    setVisibility("visible");
    await flush();
    await advance(1);
    expect(onApply).toHaveBeenCalledTimes(1); // còn trong khoảng 10 giây
    await advance(MIN_APPLY_GAP_MS);
    expect(onApply).toHaveBeenCalledTimes(2);
  });

  it("tài liệu đang tải lại ⇒ chưa áp; quan sát cũ sau khi tài liệu đổi không gây tải thừa", async () => {
    reply(6, "r2");
    const { rerender, result } = mount({ documentReloading: true });
    await flush();
    await advance(100);
    expect(onApply).not.toHaveBeenCalled();

    // Tài liệu về đúng r2 (do chính tab gây ra) ⇒ quan sát r2 không còn là "mới hơn"
    rerender({ documentReloading: false, shownRevision: "r2", knownSpineVersion: 6 });
    await advance(100);
    expect(onApply).not.toHaveBeenCalled();
    expect(result.current.hasNewer).toBe(false);
  });

  it("BE cũ không có document_revision ⇒ kết quả /version đầu tiên làm mốc; đổi sau đó mới tính là mới", async () => {
    reply(5, "r1");
    const { result } = mount({ shownRevision: null });
    await flush();
    await advance(100);
    expect(result.current.hasNewer).toBe(false);
    expect(onApply).not.toHaveBeenCalled();

    reply(6, "r2");
    await advance(VERSION_TICK_MS);
    await advance(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(result.current.hasNewer).toBe(true);
  });
});
