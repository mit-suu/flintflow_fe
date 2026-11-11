import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { crSteps, crToReview, importToGapReview, newCr } from "@/mocks/mode1/flows";
import CrWorkspace from "./CrWorkspace";

const P = MODE1_PROJECT_ID;
const S = () => mode1State.mode1State;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
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

/** Nút bước cũ của popup CR — FLF-375: mọi bước làm trong khung chat, popup chỉ xem. */
const STEP_BUTTONS = ["Bắt đầu làm rõ (AI)", "Tìm vị trí ảnh hưởng & khoá", "AI đề xuất sửa", "Kiểm đề xuất", "Kiểm lại", "Xác nhận & ghi vào bản nháp", "Tiếp tục"];

describe("CrWorkspace — popup chỉ xem (FLF-375: CR làm trong khung chat)", () => {
  it.each([
    ["mới tạo", [] as const],
    ["đã làm rõ", ["clarify"] as const],
    ["đã tìm vị trí", ["clarify", "impact"] as const],
    ["đã đề xuất", ["clarify", "impact", "propose"] as const],
    ["đã kiểm", ["clarify", "impact", "propose", "verify"] as const],
  ])("CR %s ⇒ lời nhắc làm trong khung chat + link mở khung chat, không nút bước", async (_label, steps) => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, [...steps]);
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    expect(await screen.findByText(/Mọi việc .* làm trong khung chat/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở trong khung chat" })).toHaveAttribute("href", `/projects/${P}`);
    for (const name of STEP_BUTTONS) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    // không sửa tay trong popup
    expect(screen.queryByRole("button", { name: /Sửa tay|Sửa trực tiếp/ })).not.toBeInTheDocument();
    // Huỷ CR vẫn còn
    expect(screen.getByRole("button", { name: "Huỷ CR" })).toBeInTheDocument();
  });

  it("CR tạm dừng (hết credit) ⇒ cũng chỉ trỏ về khung chat, không nút Tiếp tục", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact"]);
    S().crs.get(change_request.cr_id)!.change_request.paused = { reason: "credits", at: "2026-11-10T00:00:00Z" };
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    expect(await screen.findByRole("link", { name: "Mở trong khung chat" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tiếp tục" })).not.toBeInTheDocument();
  });

  it("CR đã ghi (written) ⇒ báo bản nháp + link Xem tài liệu", async () => {
    const { change_request } = await crToReview();
    expect(change_request.status).toBe("written");
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    expect(await screen.findByText(/Đã ghi vào bản nháp \(bản 0.2\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem tài liệu" })).toHaveAttribute("href", `/projects/${P}`);
    expect(screen.queryByRole("link", { name: "Mở trong khung chat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ CR" })).not.toBeInTheDocument();
  });
});

describe("CrWorkspace — CR cũ in_review và huỷ CR", () => {
  it("CR cũ in_review (nộp trước FLF-330): từ chối group cần lý do ≥ 10 ký tự; mọi group bị từ chối ⇒ đóng CR có lý do", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact", "propose", "verify"]);
    // FLF-330: xác nhận là ghi ngay ⇒ trạng thái in_review chỉ còn ở CR nộp theo luồng cũ
    S().crs.get(change_request.cr_id)!.change_request.status = "in_review";
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

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

  it("in_review mà không có nhóm nào để duyệt ⇒ vẫn có lối ra: Đóng CR / Sửa lại CR", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact", "propose", "verify"]);
    // CR nộp trước khi BE chặn (mọi vị trí "không liên quan"): in_review nhưng 0 nhóm
    S().crs.get(change_request.cr_id)!.change_request.status = "in_review";
    S().crs.get(change_request.cr_id)!.groups = [];
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    expect(await screen.findByText(/Không có nhóm thay đổi nào để duyệt/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duyệt" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sửa lại CR" })).toBeInTheDocument();

    await click("Đóng CR");
    fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Không có gì phải sửa" } });
    const closeButtons = screen.getAllByRole("button", { name: "Đóng CR" });
    fireEvent.click(closeButtons[closeButtons.length - 1]);
    await waitFor(() => expect(S().crs.get(change_request.cr_id)!.change_request.status).toBe("rejected"));
  });

  it("huỷ CR mở khoá phần tử", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact"]);
    expect(S().locks.size).toBeGreaterThan(0);
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    await click("Huỷ CR");
    fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Tạo nhầm change request" } });
    const buttons = screen.getAllByRole("button", { name: "Huỷ CR" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(S().crs.get(change_request.cr_id)!.change_request.status).toBe("cancelled"));
    expect(S().locks.size).toBe(0);
  });
});

describe("CrWorkspace — Viewer (readOnly)", () => {
  it("chỉ xem: không có nút bước tiếp theo, không Huỷ CR — chỉ lời nhắc vai trò", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact"]);
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} readOnly />);

    expect(await screen.findByText(/Bạn đang xem với vai trò Viewer/)).toBeInTheDocument();
    expect(screen.getByText(change_request.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ CR" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "AI đề xuất sửa" })).not.toBeInTheDocument();
  });
});
