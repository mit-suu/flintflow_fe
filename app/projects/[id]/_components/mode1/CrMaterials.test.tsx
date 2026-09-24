import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { importToGapReview, newCr } from "@/mocks/mode1/flows";
import ChangeRequestForm from "./ChangeRequestForm";
import CrWorkspace from "./CrWorkspace";

/**
 * Mode 1 v3 phase 7 — CR thiếu thông tin: đính kèm tài liệu ở 3.1 và khi trả lời 3.3, câu trả lời để trống, dữ kiện
 * còn thiếu, giả định trên đề xuất và khi duyệt.
 */
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
const txt = (name: string, body = "Ngưỡng phản hồi 2 giây") => new File([body], name, { type: "text/plain" });

/** Dán một đoạn văn bản qua khối "Tài liệu bổ sung". */
const paste = async (scope: HTMLElement, name: string, text: string) => {
  fireEvent.click(within(scope).getByRole("button", { name: "+ Dán văn bản" }));
  fireEvent.change(within(scope).getByLabelText("Tên tài liệu"), { target: { value: name } });
  fireEvent.change(within(scope).getByLabelText("Nội dung tài liệu"), { target: { value: text } });
  fireEvent.click(within(scope).getByRole("button", { name: "Thêm văn bản" }));
};

const fillRequired = () => {
  fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Bổ sung yêu cầu hiệu năng" } });
  fireEvent.change(screen.getByLabelText("Mô tả thay đổi"), { target: { value: "Gap report: thiếu mục hiệu năng" } });
  fireEvent.change(screen.getByLabelText("Nguồn *"), { target: { value: "gap_report" } });
  fireEvent.change(screen.getByLabelText("Người yêu cầu *"), { target: { value: "PM Lan" } });
};

describe("3.1 — đính kèm tài liệu khi tạo CR", () => {
  it("đoạn dán đi cùng lệnh tạo, file upload ngay sau ⇒ CR có đủ tài liệu", async () => {
    const onCreated = vi.fn();
    renderWithIntl(<ChangeRequestForm projectId={P} onCreated={onCreated} onCancel={vi.fn()} />);
    fillRequired();
    const box = screen.getByRole("region", { name: "Tài liệu bổ sung" });
    await paste(box, "Email PM", "Khách muốn nhanh hơn");
    fireEvent.change(within(box).getByLabelText("Chọn file tài liệu bổ sung"), { target: { files: [txt("biên-bản.txt")] } });
    expect(within(box).getByText("Email PM")).toBeInTheDocument();
    expect(within(box).getByText("biên-bản.txt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tạo change request" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const created = onCreated.mock.calls[0][0];
    // (mock: File của jsdom mất tên khi qua fetch ⇒ chỉ kiểm loại + thứ tự)
    expect(created.change_request.materials.map((m: { kind: string; round: number }) => [m.kind, m.round])).toEqual([
      ["text", 0],
      ["file", 0],
    ]);
    expect(created.change_request.materials[0].name).toBe("Email PM");
  });

  it("file upload lỗi ⇒ CR vẫn tạo, báo file nào lỗi, nút mở CR", async () => {
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/change-requests/:crId/materials`, () =>
        HttpResponse.json({ data: null, error: { code: "CR_MATERIAL_EMPTY", message: "không có nội dung chữ nào" } }, { status: 422 })
      )
    );
    const onCreated = vi.fn();
    renderWithIntl(<ChangeRequestForm projectId={P} onCreated={onCreated} onCancel={vi.fn()} />);
    fillRequired();
    fireEvent.change(screen.getByLabelText("Chọn file tài liệu bổ sung"), { target: { files: [txt("trống.txt", " ")] } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo change request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Đã tạo CR-001 nhưng chưa đính kèm được: trống\.txt/);
    expect(onCreated).not.toHaveBeenCalled();
    await click("Mở CR-001");
    expect(onCreated.mock.calls[0][0].change_request.cr_id).toBe("CR-001");
  });
});

describe("CrWorkspace — tài liệu, câu trả lời trống, giả định", () => {
  it("draft: dán thêm rồi xoá tài liệu", async () => {
    const { change_request } = await newCr();
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);
    const section = await screen.findByRole("region", { name: "Tài liệu bổ sung của CR" });
    await paste(section, "Biên bản họp 3", "Chốt 500 người dùng đồng thời");
    expect(await within(section).findByText("Biên bản họp 3")).toBeInTheDocument();
    expect(S().crs.get("CR-001")!.change_request.materials).toHaveLength(1);

    fireEvent.click(within(section).getByRole("button", { name: "Xoá tài liệu Biên bản họp 3" }));
    await waitFor(() => expect(S().crs.get("CR-001")!.change_request.materials).toHaveLength(0));
  });

  it("3.3 để trống + đính kèm file ⇒ đi tiếp kèm dữ kiện thiếu ⇒ đề xuất và nhóm duyệt hiện giả định", async () => {
    const { change_request } = await newCr("Đăng xuất mọi thiết bị", "Yêu cầu còn mơ hồ: logging out must sign the user out of all devices.");
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    await click("Bắt đầu làm rõ (AI)");
    const form = await screen.findByRole("region", { name: "Trả lời câu hỏi làm rõ" });
    fireEvent.change(within(form).getByLabelText("Chọn file tài liệu bổ sung"), { target: { files: [txt("email-pm.txt", "Áp cho cả mobile")] } });
    await waitFor(() => expect(S().crs.get("CR-001")!.change_request.materials).toHaveLength(1));
    expect(await screen.findByText("khi trả lời vòng 1")).toBeInTheDocument();

    // không trả lời câu nào: bỏ qua câu 1, câu cuối vẫn gửi được ⇒ AI sẽ giả định
    const answering = await screen.findByRole("region", { name: "Trả lời câu hỏi làm rõ" });
    fireEvent.click(within(answering).getByRole("button", { name: "Bỏ qua" }));
    fireEvent.click(within(answering).getByRole("button", { name: "Gửi câu trả lời" }));
    const missing = await screen.findByLabelText("Dữ kiện còn thiếu");
    expect(missing).toHaveTextContent("Thay đổi áp cho cả ứng dụng mobile không?");
    expect(screen.getAllByText("↳ Chưa biết — AI sẽ giả định")).toHaveLength(2);

    await click("Tìm vị trí ảnh hưởng & khoá");
    await click("AI đề xuất sửa");
    expect((await screen.findAllByLabelText("Giả định cần xác nhận"))[0]).toHaveTextContent("Giả định: Thay đổi áp cho cả ứng dụng mobile không?");

    await click("Kiểm đề xuất");
    await click("Nộp để duyệt");
    expect(await screen.findByText(/Nhóm này có 2 giả định AI tự đặt/)).toBeInTheDocument();
  });

  it("câu hỏi như mode tạo SRS: từng câu, gợi ý AI + tự nhập thêm, câu chưa biết bỏ qua ⇒ gửi theo đúng từng câu", async () => {
    const { change_request } = await newCr("Đăng xuất mọi thiết bị", "Yêu cầu còn mơ hồ: logging out must sign the user out of all devices.");
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);
    await click("Bắt đầu làm rõ (AI)");

    const box = await screen.findByRole("region", { name: "Trả lời câu hỏi làm rõ" });
    expect(within(box).getByRole("group", { name: "Câu hỏi 1 trên 2" })).toHaveTextContent("Thay đổi áp cho cả ứng dụng mobile không?");
    // chọn gợi ý ⇒ tự sang câu 2; quay lại câu 1 vẫn thấy đã chọn, gõ thêm ở dòng tự trả lời
    fireEvent.click(within(box).getByRole("radio", { name: "Chỉ áp cho web" }));
    expect(within(box).getByRole("group", { name: "Câu hỏi 2 trên 2" })).toBeInTheDocument();
    fireEvent.click(within(box).getByRole("button", { name: "Câu trước" }));
    expect(within(box).getByRole("radio", { name: "Chỉ áp cho web" })).toHaveAttribute("aria-checked", "true");
    fireEvent.change(within(box).getByLabelText("Câu trả lời khác"), { target: { value: "trừ app cũ" } });
    fireEvent.click(within(box).getByRole("button", { name: "Tiếp" }));
    // câu 2 chưa biết ⇒ gửi luôn (câu đó để trống)
    fireEvent.click(within(box).getByRole("button", { name: "Gửi câu trả lời" }));
    await waitFor(() => expect(S().crs.get("CR-001")!.change_request.clarifications[0].answers).toEqual(["Chỉ áp cho web (Bổ sung: trừ app cũ)", ""]));
  });
});
