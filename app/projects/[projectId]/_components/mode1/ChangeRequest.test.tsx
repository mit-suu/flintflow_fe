import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { crSteps, importToGapReview, newCr } from "@/mocks/mode1/flows";
import ChangeRequestForm from "./ChangeRequestForm";
import CrWorkspace from "./CrWorkspace";

const P = MODE1_PROJECT_ID;
const S = () => mode1State.mode1State;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ projectId: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(async () => {
  resetMockState();
  resetMode1MockState();
  await importToGapReview();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const click = async (name: string | RegExp) => fireEvent.click(await screen.findByRole("button", { name }));

describe("ChangeRequestForm (UC-48)", () => {
  it("thiếu nguồn hoặc người yêu cầu ⇒ chặn ở FE, không tạo CR", async () => {
    const onCreated = vi.fn();
    render(<ChangeRequestForm projectId={P} prefill={{ title: "Sửa theo gap report", description: "- Thiếu mục 5.3" }} onCreated={onCreated} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo change request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chọn nguồn");

    fireEvent.change(screen.getByLabelText("Nguồn *"), { target: { value: "gap_report" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo change request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("người yêu cầu");
    expect(S().crs.size).toBe(0);

    fireEvent.change(screen.getByLabelText("Người yêu cầu *"), { target: { value: "PM Lan" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo change request" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(S().crs.get("CR-001")?.change_request).toMatchObject({ source: { kind: "gap_report" }, requester: "PM Lan", title: "Sửa theo gap report" });
  });
});

describe("CrWorkspace — luồng 3.1–3.14 trên mock", () => {
  it("làm rõ (hỏi lại) → trả lời → tìm vị trí + khoá → đề xuất → kiểm → nộp → duyệt ⇒ ghi bản 0.1", async () => {
    const { change_request } = await newCr("Đăng xuất mọi thiết bị", "Yêu cầu còn mơ hồ: logging out must sign the user out of all devices.");
    render(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    await click("Bắt đầu làm rõ (AI)");
    const form = await screen.findByRole("form", { name: "Trả lời câu hỏi làm rõ" });
    for (const box of within(form).getAllByRole("textbox")) fireEvent.change(box, { target: { value: "Có, áp cho mọi thiết bị" } });
    fireEvent.click(within(form).getByRole("button", { name: "Gửi câu trả lời" }));

    await click("Tìm vị trí ảnh hưởng & khoá");
    expect(await screen.findByText(/Vị trí ảnh hưởng \(/)).toBeInTheDocument();
    expect(S().blocks.get("0.0")!.some((b) => b.locked_by_cr === "CR-001")).toBe(true);

    await click("AI đề xuất sửa");
    await click("Kiểm đề xuất");
    await click("Nộp để duyệt");
    await click("Duyệt");

    expect(await screen.findByText(/vào bản 0.1/)).toBeInTheDocument();
    expect(S().crs.get("CR-001")!.change_request.status).toBe("written");
    expect(S().blocks.get("0.1")!.every((b) => b.locked_by_cr === null)).toBe(true);
  });

  it("sửa tay vẫn trượt kiểm ⇒ manual_fix; sửa lại đúng thì kiểm đạt", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact", "propose"]);
    render(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    const first = (await screen.findAllByRole("article"))[0];
    fireEvent.click(within(first).getByRole("button", { name: "Sửa tay" }));
    fireEvent.change(within(first).getByLabelText("Nội dung mới"), { target: { value: "FAIL text" } });
    fireEvent.click(within(first).getByRole("button", { name: "Lưu sửa tay" }));
    await click("Kiểm đề xuất");
    expect(await screen.findByText(/AI đã làm lại 2 lần mà vẫn trượt/)).toBeInTheDocument();
    expect(screen.getByText("Kiểm code: trượt")).toBeInTheDocument();

    const again = (await screen.findAllByRole("article"))[0];
    fireEvent.click(within(again).getByRole("button", { name: "Sửa tay" }));
    fireEvent.change(within(again).getByLabelText("Nội dung mới"), { target: { value: "The user is signed out of every device." } });
    fireEvent.click(within(again).getByRole("button", { name: "Lưu sửa tay" }));
    await click("Kiểm lại");
    expect(await screen.findByRole("button", { name: "Nộp để duyệt" })).toBeInTheDocument();
  });

  it("từ chối group cần lý do ≥ 10 ký tự; mọi group bị từ chối ⇒ đóng CR có lý do", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact", "propose", "verify", "submit"]);
    render(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    await click("Từ chối");
    const confirm = screen.getByRole("button", { name: "Xác nhận từ chối" });
    fireEvent.change(screen.getByLabelText(/Lý do từ chối/), { target: { value: "ngắn" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Lý do từ chối/), { target: { value: "Ngoài phạm vi bản 1.0" } });
    fireEvent.click(confirm);

    await click("Đóng CR");
    fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Stakeholder rút yêu cầu" } });
    const closeButtons = screen.getAllByRole("button", { name: "Đóng CR" });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    await waitFor(() => expect(S().crs.get(change_request.cr_id)!.change_request.status).toBe("rejected"));
  });

  it("huỷ CR mở khoá block", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact"]);
    expect(S().blocks.get("0.0")!.some((b) => b.locked_by_cr)).toBe(true);
    render(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    await click("Huỷ CR");
    fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Tạo nhầm change request" } });
    const buttons = screen.getAllByRole("button", { name: "Huỷ CR" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(S().crs.get(change_request.cr_id)!.change_request.status).toBe("cancelled"));
    expect(S().blocks.get("0.0")!.some((b) => b.locked_by_cr)).toBe(false);
  });

  it("CR thứ hai chạm block đang khoá ⇒ báo CR đang giữ (409 BLOCK_LOCKED)", async () => {
    const first = await newCr();
    await crSteps(first.change_request.cr_id, ["clarify", "impact"]);
    const second = await newCr("Đăng xuất mọi thiết bị (lần 2)");
    await crSteps(second.change_request.cr_id, ["clarify"]);
    render(<CrWorkspace projectId={P} crId={second.change_request.cr_id} />);

    await click("Tìm vị trí ảnh hưởng & khoá");
    expect(await screen.findByRole("alert")).toHaveTextContent(/đang bị change request khác giữ: B\d{4} \(CR-001\)/);
  });

  it("hết credit lúc đề xuất ⇒ banner paused, nạp xong tiếp tục", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact"]);
    render(<CrWorkspace projectId={P} crId={change_request.cr_id} />);
    S().credits = 0;
    await click("AI đề xuất sửa");
    expect(await screen.findByText(/Đề xuất sửa đang tạm dừng — hết credit/)).toBeInTheDocument();
    S().credits = 100;
    await click("Tiếp tục");
    expect(await screen.findByRole("button", { name: "Kiểm đề xuất" })).toBeInTheDocument();
  });
});
