import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mockServer } from "@/mocks/server";
import { renderWithIntl } from "@/test/intl";
import { Harness, item, makeHandlers, queueOf } from "./resolve-queue-harness";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => window.localStorage.clear());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

// FLF-445: chế độ 1 - cờ thành thẻ nhóm cờ, sửa qua change request, không bỏ qua cờ
const RED = item("flag_red:FR1", "flag_red", { flag_ids: ["FR1"] });
const GROUP = item("flag_yellow_group:fixed:2.1", "flag_yellow_group", { flag_ids: ["FY1", "FY2", "FY3"] });

const start = async () => fireEvent.click(await screen.findByRole("button", { name: "Giải quyết lần lượt" }));
const crButton = () => screen.getByRole("button", { name: /Để AI đề xuất cách sửa cả nhóm/ });

describe("ResolveQueueDock - chế độ 1", () => {
  it("dải đếm theo cờ; thẻ nhóm cờ có danh sách cờ, credit ước tính trước, không có lựa chọn bỏ qua", async () => {
    renderWithIntl(<Harness mode1 initial={queueOf(RED, GROUP)} handlers={makeHandlers()} />);
    expect(await screen.findByText("4 cờ nên xem")).toBeInTheDocument();
    await start();
    expect(screen.getByText("Cờ đỏ")).toBeInTheDocument();
    expect(screen.getByText("· còn 2 nhóm")).toBeInTheDocument();
    expect(screen.getByText("Cờ này nên sửa thế nào?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bỏ qua/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sửa trong chat/ })).not.toBeInTheDocument();
    // làm rõ 1 + đề xuất 1 lô × 1 + kiểm nhất quán 1 (giá mock = 1)
    await waitFor(() => expect(screen.getAllByText(/khoảng 3 credit/).length).toBeGreaterThan(0));
    expect(screen.getByText(/Thành 1 change request · Nguồn: Gap report/)).toBeInTheDocument();
    expect(screen.getByText("Người yêu cầu: BA Lan")).toBeInTheDocument();
  });

  it("Để AI đề xuất ⇒ đúng một CR nguồn Gap report, người yêu cầu điền sẵn, các cờ của nhóm; dòng chat kèm mã CR", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness mode1 initial={queueOf(GROUP)} reloads={[queueOf()]} handlers={handlers} />);
    await start();
    expect(screen.getByText("Nhóm # cờ này nên sửa thế nào?".replace("#", "3"))).toBeInTheDocument();
    fireEvent.click(crButton());
    await waitFor(() => expect(handlers.createCrFromFlags).toHaveBeenCalledTimes(1));
    const req = handlers.createCrFromFlags.mock.calls[0][0];
    expect(req).toMatchObject({ source: { kind: "gap_report" }, requester: "BA Lan", flag_ids: ["FY1", "FY2", "FY3"] });
    expect(req.description).toBe("- Actor A mồ côi\n- Actor B mồ côi\n- Actor C mồ côi");
    expect(req.title).toContain("2.1 Actors");
    await waitFor(() => expect(handlers.postChatLine).toHaveBeenCalledWith(expect.stringMatching(/^✓ Nhóm ".*" \(3 cờ\) → CR-001$/)));
  });

  it("bỏ chọn một cờ ⇒ CR chỉ nhận cờ đang chọn; người yêu cầu sửa được trên thẻ", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness mode1 initial={queueOf(GROUP)} handlers={handlers} />);
    await start();
    fireEvent.click(screen.getByRole("checkbox", { name: "Actor C mồ côi" }));
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "PM Hoa" } });
    fireEvent.blur(screen.getByRole("textbox"));
    fireEvent.click(crButton());
    await waitFor(() => expect(handlers.createCrFromFlags).toHaveBeenCalled());
    expect(handlers.createCrFromFlags.mock.calls[0][0]).toMatchObject({ requester: "PM Hoa", flag_ids: ["FY1", "FY2"] });
  });

  it("tách nhóm: cờ bỏ chọn thành việc riêng ngay sau nhóm gốc, nhớ qua localStorage", async () => {
    renderWithIntl(<Harness mode1 initial={queueOf(GROUP)} handlers={makeHandlers()} />);
    await start();
    expect(screen.getByText("· còn 1 nhóm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Actor C mồ côi" }));
    fireEvent.click(screen.getByRole("button", { name: "Tách 1 cờ bỏ chọn thành nhóm riêng" }));
    await waitFor(() => expect(screen.getByText("· còn 2 nhóm")).toBeInTheDocument());
    expect(screen.queryByText("Actor C mồ côi")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("ff:resolve-queue:split:p1") ?? "[]")).toEqual(["FY3"]);
  });

  it("đang có CR chưa xong ⇒ tạo CR khoá kèm lý do; Giữ nguyên vẫn dùng được, giữ từng cờ đang chọn", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness mode1 crLock={{ reason: "running", crId: "CR-007" }} initial={queueOf(GROUP)} reloads={[queueOf()]} handlers={handlers} />);
    await start();
    expect(crButton()).toBeDisabled();
    expect(screen.getByText(/Bạn đang có CR-007 chưa xong/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Giữ nguyên, kèm lý do/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Khách hàng đã xác nhận giữ nguyên các actor này" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(handlers.keepFlag).toHaveBeenCalledTimes(3));
    expect(handlers.createCrFromFlags).not.toHaveBeenCalled();
    await waitFor(() => expect(handlers.postChatLine).toHaveBeenCalledWith(expect.stringMatching(/\(3 cờ\) → Giữ nguyên$/)));
  });

  it("gói đang chờ Lead ⇒ báo lý do, không tạo CR", async () => {
    const handlers = makeHandlers();
    renderWithIntl(<Harness mode1 crLock={{ reason: "package" }} initial={queueOf(GROUP)} handlers={handlers} />);
    await start();
    expect(crButton()).toBeDisabled();
    expect(screen.getByText(/Gói đang chờ Lead duyệt/)).toBeInTheDocument();
  });
});
