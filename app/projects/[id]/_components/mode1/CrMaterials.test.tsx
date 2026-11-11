import { screen, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { crSteps, importToGapReview, newCr } from "@/mocks/mode1/flows";
import CrWorkspace from "./CrWorkspace";

/**
 * Mode 1 v3 phase 7 — CR thiếu thông tin: tài liệu bổ sung, dữ kiện còn thiếu, giả định trên đề xuất.
 * FLF-375: CR tạo và làm trong khung chat ⇒ popup CR chỉ hiện lại các thứ này (không thêm / xoá tài liệu, không trả lời ở đây).
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

describe("CrWorkspace — tài liệu, dữ kiện thiếu, giả định (chỉ xem)", () => {
  it("tài liệu bổ sung của CR hiện ở popup, không có nút dán / chọn file / xoá", async () => {
    const { change_request } = await newCr();
    S().crs.get(change_request.cr_id)!.change_request.materials = [
      { material_id: "m1", kind: "text", name: "Email PM", text: "Khách muốn nhanh hơn", truncated: false, round: 0, added_at: "2026-11-10T00:00:00Z" },
      { material_id: "m2", kind: "file", name: "biên-bản.txt", text: "Chốt 500 người dùng", truncated: false, round: 1, added_at: "2026-11-10T00:00:00Z" },
    ];
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    const section = await screen.findByRole("region", { name: "Tài liệu bổ sung của CR" });
    expect(within(section).getByText("Tài liệu bổ sung (2)")).toBeInTheDocument();
    expect(within(section).getByText("Email PM")).toBeInTheDocument();
    expect(within(section).getByText("biên-bản.txt")).toBeInTheDocument();
    expect(within(section).getByText("lúc tạo CR")).toBeInTheDocument();
    expect(within(section).getByText("khi trả lời vòng 1")).toBeInTheDocument();
    expect(within(section).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Chọn file tài liệu bổ sung")).not.toBeInTheDocument();
  });

  it("dữ kiện còn thiếu + giả định trên đề xuất hiện để người xem đối chiếu", async () => {
    const { change_request } = await newCr();
    await crSteps(change_request.cr_id, ["clarify", "impact", "propose"]);
    const stored = S().crs.get(change_request.cr_id)!;
    stored.change_request.missing_info = ["Thay đổi áp cho cả ứng dụng mobile không?"];
    const edited = stored.locations.find((l) => l.conclusion === "edit" && l.proposal)!;
    edited.proposal!.assumptions = ["Thay đổi áp cho cả ứng dụng mobile không?"];
    renderWithIntl(<CrWorkspace projectId={P} crId={change_request.cr_id} />);

    expect(await screen.findByLabelText("Dữ kiện còn thiếu")).toHaveTextContent("Thay đổi áp cho cả ứng dụng mobile không?");
    expect(screen.getAllByLabelText("Giả định cần xác nhận")[0]).toHaveTextContent("Giả định cần xác nhận");
    expect(screen.getAllByLabelText("Giả định cần xác nhận")[0]).toHaveTextContent("Thay đổi áp cho cả ứng dụng mobile không?");
    // trả lời câu hỏi làm rõ làm trong khung chat
    expect(screen.queryByRole("button", { name: "Gửi câu trả lời" })).not.toBeInTheDocument();
  });
});
