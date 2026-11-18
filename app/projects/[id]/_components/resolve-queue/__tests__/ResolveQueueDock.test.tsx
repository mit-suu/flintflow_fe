import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { renderWithIntl } from "@/test/intl";
import type { ResolveQueueController } from "../useResolveQueue";
import { Harness, item, makeHandlers, queueOf } from "./resolve-queue-harness";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => window.localStorage.clear());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const A1 = item("assumption:AS01", "assumption", { assumption_id: "AS01" });
const A2 = item("assumption:AS02", "assumption", { assumption_id: "AS02" });
const NOTE = item("brief_note:AD01", "brief_note", { addendum_id: "AD01" });
const SCREEN = item("screen:S01", "screen", { screen_id: "S01" });
const RED = item("flag_red:FR1", "flag_red", { flag_ids: ["FR1"] });
const GROUP = item("flag_yellow_group:fixed:2.1", "flag_yellow_group", { flag_ids: ["FY1", "FY2", "FY3"] });

const start = async () => fireEvent.click(await screen.findByRole("button", { name: "Giải quyết lần lượt" }));
const click = (el: HTMLElement) => fireEvent.click(el);
const typeInto = (value: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value } });
const pressKey = (key: string) => fireEvent.keyDown(document.body, { key });

describe("ResolveQueueDock", () => {
  it("hiện dải đếm việc, bấm mở thẻ việc đầu tiên với số việc còn lại và câu trích từ Spine", async () => {
    renderWithIntl(<Harness initial={queueOf(A1, A2)} handlers={makeHandlers()} />);
    expect(await screen.findByText("2 việc chờ bạn quyết")).toBeInTheDocument();
    await start();
    expect(screen.getByText("Giả định này có đúng không?")).toBeInTheDocument();
    expect(screen.getByText("Người dùng là sinh viên")).toBeInTheDocument();
    expect(screen.getByText("· còn 2 việc")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mục 2\.1 Actors/ })).toBeInTheDocument();
  });

  it("chọn Đúng ghi op xác nhận, thêm một dòng chat rồi sang việc kế sau khi tải lại hàng", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(A1, A2)} reloads={[queueOf(A2)]} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Đúng/ }));
    await waitFor(() => expect(screen.getByText("Peak load is 500 users")).toBeInTheDocument());
    expect(handlers.submitOps).toHaveBeenCalledTimes(1);
    const ops = handlers.submitOps.mock.calls[0][0] as { path: string; value: unknown }[];
    expect(ops[0]).toMatchObject({ path: "assumptions[id=AS01].status", value: "confirmed" });
    expect(handlers.postChatLine).toHaveBeenCalledWith('✓ Giả định "Người dùng là sinh viên" → xác nhận đúng');
  });

  it("phím số chọn theo thứ tự lựa chọn (2 = Không đúng)", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(A1)} reloads={[queueOf()]} handlers={handlers} />);
    await start();
    pressKey("2");
    await waitFor(() => expect(handlers.submitOps).toHaveBeenCalled());
    expect((handlers.submitOps.mock.calls[0][0] as { value: unknown }[])[0].value).toBe("rejected");
  });

  it("ghi lỗi ⇒ ở lại đúng việc, báo lỗi, không có dòng chat", async () => {
    const handlers = makeHandlers();
    handlers.submitOps.mockResolvedValue(false);
    renderWithIntl(<Harness initial={queueOf(A1, A2)} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Đúng/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa lưu được");
    expect(screen.getByText("Người dùng là sinh viên")).toBeInTheDocument();
    expect(handlers.postChatLine).not.toHaveBeenCalled();
  });

  it("Muốn khác ở giả định: ô nhập trong thẻ, báo credit ước tính, gọi sửa giả định", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(A1)} reloads={[queueOf()]} handlers={handlers} />);
    await start();
    expect(await screen.findByText(/khoảng 1 credit/)).toBeInTheDocument();
    click(screen.getByRole("button", { name: /Muốn khác/ }));
    typeInto("Người dùng là giảng viên");
    click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(handlers.decideAssumption).toHaveBeenCalledWith({ kind: "edit", id: "AS01", statement: "Người dùng là giảng viên" }));
  });

  it("ghi chú: Bỏ phải qua bước xác nhận rồi mới ghi op remove; Giữ chỉ đánh dấu đã xem, không ghi", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(NOTE)} reloads={[queueOf(NOTE)]} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Bỏ/ }));
    expect(handlers.submitOps).not.toHaveBeenCalled();
    click(screen.getByRole("button", { name: "Bỏ ghi chú" }));
    await waitFor(() => expect(handlers.submitOps).toHaveBeenCalledWith([expect.objectContaining({ op: "remove", path: "addendum[id=AD01]" })]));
  });

  it("ghi chú: Giữ lưu 'đã xem' vào localStorage dù hàng BE vẫn còn nó, và việc không quay lại", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(NOTE, A1)} reloads={[queueOf(NOTE, A1)]} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Giữ/ }));
    await waitFor(() => expect(screen.getByText("Người dùng là sinh viên")).toBeInTheDocument());
    expect(handlers.submitOps).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem("ff:resolve-queue:seen:p1") ?? "[]")).toEqual(["brief_note:AD01"]);
    expect(screen.queryByText("Cần đăng nhập bằng email trường")).not.toBeInTheDocument();
  });

  it("key đã xem không còn trong hàng ⇒ tự dọn khỏi localStorage", async () => {
    window.localStorage.setItem("ff:resolve-queue:seen:p1", JSON.stringify(["brief_note:GONE"]));
    renderWithIntl(<Harness initial={queueOf(A1)} handlers={makeHandlers()} />);
    await screen.findByText("1 việc chờ bạn quyết");
    await waitFor(() => expect(window.localStorage.getItem("ff:resolve-queue:seen:p1")).toBeNull());
  });

  it("localStorage hỏng ⇒ vẫn chạy bình thường", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(SCREEN)} reloads={[queueOf(SCREEN)]} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Đặc tả chi tiết vòng này/ }));
    await waitFor(() => expect(handlers.postChatLine).toHaveBeenCalled());
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("màn: Để lại gọi markPlaceholder, không tốn credit (không hiện số credit)", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(SCREEN)} reloads={[queueOf()]} handlers={handlers} />);
    await start();
    expect(screen.queryByText(/credit/)).not.toBeInTheDocument();
    click(screen.getByRole("button", { name: /Để lại/ }));
    await waitFor(() => expect(handlers.markPlaceholder).toHaveBeenCalledWith("S01"));
  });

  it("cờ đỏ: Giữ nguyên cần lý do >= 20 ký tự mới bấm được", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(RED)} reloads={[queueOf()]} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Giữ nguyên, kèm lý do/ }));
    const apply = screen.getByRole("button", { name: "Áp dụng" });
    typeInto("ngắn quá");
    expect(apply).toBeDisabled();
        typeInto("Lý do đủ dài để giữ nguyên cờ");
    expect(apply).toBeEnabled();
    click(apply);
    await waitFor(() => expect(handlers.keepFlag).toHaveBeenCalledWith("FR1", "Lý do đủ dài để giữ nguyên cờ"));
  });

  it("cờ đỏ: Sửa trong chat điền sẵn ô chat kèm số credit, thu thẻ về dải và việc nằm lại hàng (để sau)", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(RED)} handlers={handlers} />);
    await start();
    expect(await screen.findByText(/khoảng 1 credit/)).toBeInTheDocument();
    click(screen.getByRole("button", { name: /Sửa trong chat/ }));
    expect(handlers.startEditing).toHaveBeenCalledWith(expect.stringContaining("Mục 2.1 Actors còn trống"));
    expect(await screen.findByText("1 việc đã để sau")).toBeInTheDocument();
  });

  it("nhóm cờ vàng: bỏ qua tuần tự, lỗi giữa chừng ⇒ báo x/N, ở lại thẻ", async () => {
    const handlers = makeHandlers();
    handlers.waiveFlag.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Không bỏ qua được"));
    renderWithIntl(<Harness initial={queueOf(GROUP)} reloads={[queueOf(GROUP)]} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Bỏ qua cả nhóm/ }));
    typeInto("Chấp nhận rủi ro vì phạm vi MVP");
    click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mới bỏ qua 1/3");
    expect(handlers.waiveFlag).toHaveBeenCalledTimes(2);
    expect(handlers.postChatLine).toHaveBeenCalledWith("1/3 lưu ý đã bỏ qua");
  });

  it("nhóm cờ vàng: bỏ qua cả nhóm thành công ghi một dòng chat N/N", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(GROUP)} reloads={[queueOf()]} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Bỏ qua cả nhóm/ }));
    typeInto("Chấp nhận rủi ro vì phạm vi MVP");
    click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(handlers.postChatLine).toHaveBeenCalledWith(expect.stringContaining("bỏ qua cả nhóm (3/3)")));
    expect(handlers.waiveFlag.mock.calls.map((c) => c[0])).toEqual(["FY1", "FY2", "FY3"]);
  });

  it("sửa cả nhóm trong chat xong mà nhóm còn sót ⇒ thẻ ghi 'còn N lưu ý', không mời AI sửa lại", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(GROUP)} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Sửa cả nhóm trong chat/ }));
    click(await screen.findByRole("button", { name: "Xem lại" }));
    expect(screen.getByText("Còn 3 lưu ý chưa xử lý xong")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sửa cả nhóm trong chat/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bỏ qua cả nhóm/ })).toBeInTheDocument();
  });

  it("AI đang chạy ⇒ thẻ thu một dòng, phím số không gọi handler nào", async () => {
    const handlers = makeHandlers();
    const view = renderWithIntl(<Harness initial={queueOf(A1)} handlers={handlers} />);
    await start();
    view.rerender(<Harness initial={queueOf(A1)} handlers={handlers} locked />);
    expect(await screen.findByText("AI đang làm việc, xong sẽ mở lại")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đúng/ })).not.toBeInTheDocument();
    pressKey("1");
    expect(handlers.submitOps).not.toHaveBeenCalled();
  });

  it("choose() của hook tự chặn khi khoá, kể cả gọi thẳng không qua UI", async () => {
    const handlers = makeHandlers();
    let controller: ResolveQueueController | undefined;
    const props = { initial: queueOf(A1), handlers, onController: (c: ResolveQueueController) => (controller = c) };
    const view = renderWithIntl(<Harness {...props} />);
    await start();
    view.rerender(<Harness {...props} locked />);
    await act(async () => controller?.choose("right"));
    expect(handlers.submitOps).not.toHaveBeenCalled();
  });

  it("AI hỏi / thẻ duyệt mở ⇒ thẻ ẩn, hết thì quay lại đúng việc đang dở", async () => {
    const handlers = makeHandlers();
    const view = renderWithIntl(<Harness initial={queueOf(A1, A2)} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Để sau/ }));
    expect(screen.getByText("Peak load is 500 users")).toBeInTheDocument();
    view.rerender(<Harness initial={queueOf(A1, A2)} handlers={handlers} yielded />);
    expect(screen.queryByText("Peak load is 500 users")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Giải quyết lần lượt" })).not.toBeInTheDocument();
    view.rerender(<Harness initial={queueOf(A1, A2)} handlers={handlers} />);
    expect(screen.getByText("Peak load is 500 users")).toBeInTheDocument();
  });

  it("Để sau hết cả hàng ⇒ dải ghi 'đã để sau', Xem lại mở từ đầu", async () => {
    renderWithIntl(<Harness initial={queueOf(A1)} handlers={makeHandlers()} />);
    await start();
    click(screen.getByRole("button", { name: /Để sau/ }));
    expect(await screen.findByText("1 việc đã để sau")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Xem lại" }));
    expect(screen.getByText("Giả định này có đúng không?")).toBeInTheDocument();
  });

  it("chế độ 1 / không đủ quyền (enabled = false) ⇒ không hiện gì", async () => {
    const view = renderWithIntl(<Harness initial={queueOf(A1)} handlers={makeHandlers()} enabled={false} />);
    await act(async () => undefined);
    expect(within(view.container).queryByText(/việc chờ bạn quyết/)).not.toBeInTheDocument();
  });

  it("quyết một việc kéo theo việc khác biến mất ⇒ báo 'cũng xong luôn N việc' và xem được danh sách", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(A1, A2, SCREEN)} reloads={[queueOf(SCREEN)]} handlers={handlers} />);
    await start();
    click(screen.getByRole("button", { name: /Đúng/ }));
    expect(await screen.findByText(/Câu này cũng xong luôn 1 việc/)).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Xem" }));
    expect(screen.getByText("Peak load is 500 users")).toBeInTheDocument();
  });

  it("mở một việc lẻ (openItem): xong thì hỏi tiếp lần lượt hay để sau", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness initial={queueOf(A1, NOTE)} reloads={[queueOf(A1)]} handlers={handlers} />);
    click(await screen.findByRole("button", { name: "open-note" }));
    expect(screen.getByText("Cần đăng nhập bằng email trường")).toBeInTheDocument();
    click(screen.getByRole("button", { name: /Bỏ/ }));
    click(screen.getByRole("button", { name: "Bỏ ghi chú" }));
    expect(await screen.findByText("Còn 1 việc chờ bạn quyết")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Tiếp lần lượt" }));
    expect(screen.getByText("Người dùng là sinh viên")).toBeInTheDocument();
  });
});
