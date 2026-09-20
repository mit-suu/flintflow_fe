import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { MODE1_PROJECT_ID, resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import { importToGapReview } from "@/mocks/mode1/flows";
import ChangeRequestForm from "./ChangeRequestForm";
import { CR_SOURCE_KINDS, CR_SOURCE_LABELS } from "./labels";

const P = MODE1_PROJECT_ID;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: MODE1_PROJECT_ID }),
}));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const field = (label: string) => screen.getByLabelText(label);
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Tạo change request" }));

/** Ghi lại body gửi lên; không gọi mock thật (không cần baseline). */
const captureCreate = () => {
  const bodies: unknown[] = [];
  mockServer.use(
    http.post(`${API_BASE_URL}/projects/:projectId/change-requests`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({ data: { change_request: { cr_id: "CR-009" }, locations: [], groups: [], pending_questions: [] }, error: null }, { status: 201 });
    })
  );
  return bodies;
};

describe("ChangeRequestForm — tạo change request (UC-48)", () => {
  it("không prefill ⇒ trống; nguồn gồm đủ 6 loại + dòng chọn rỗng", () => {
    renderWithIntl(<ChangeRequestForm projectId={P} onCreated={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("form", { name: "Tạo change request" })).toBeInTheDocument();
    expect(field("Tiêu đề")).toHaveValue("");
    expect(field("Mô tả thay đổi")).toHaveValue("");
    expect(field("Nguồn *")).toHaveValue("");
    const options = within(field("Nguồn *")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["— Chọn nguồn —", ...CR_SOURCE_KINDS.map((k) => CR_SOURCE_LABELS[k])]);
    // `chat` (FLF-182) chỉ do hệ thống gán khi CR tạo từ chat — không chọn tay
    expect(options).not.toContain(CR_SOURCE_LABELS.chat);
  });

  it("prefill (từ gap report / re-upload / chat) điền sẵn tiêu đề, mô tả, nguồn, tham chiếu; người yêu cầu vẫn phải nhập", async () => {
    const bodies = captureCreate();
    const onCreated = vi.fn();
    renderWithIntl(
      <ChangeRequestForm
        projectId={P}
        prefill={{ title: "Cập nhật theo file SRS_sua.docx", description: "- Sửa B0010", source: "reupload", ref: "66f00000000000000000r001" }}
        onCreated={onCreated}
        onCancel={vi.fn()}
      />
    );
    expect(field("Tiêu đề")).toHaveValue("Cập nhật theo file SRS_sua.docx");
    expect(field("Mô tả thay đổi")).toHaveValue("- Sửa B0010");
    expect(field("Nguồn *")).toHaveValue("reupload");
    expect(field("Tham chiếu nguồn")).toHaveValue("66f00000000000000000r001");
    expect(field("Người yêu cầu *")).toHaveValue("");

    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Nhập người yêu cầu thay đổi.");
    expect(bodies).toHaveLength(0);

    type("Người yêu cầu *", "  PM Lan  ");
    submit();
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([
      {
        title: "Cập nhật theo file SRS_sua.docx",
        description: "- Sửa B0010",
        source: { kind: "reupload", ref: "66f00000000000000000r001", note: null },
        requester: "PM Lan",
      },
    ]);
    expect(onCreated.mock.calls[0][0]).toMatchObject({ change_request: { cr_id: "CR-009" } });
  });

  it("thiếu tiêu đề/mô tả ⇒ chặn trước cả nguồn; chỉ khoảng trắng cũng tính là thiếu", async () => {
    const bodies = captureCreate();
    renderWithIntl(<ChangeRequestForm projectId={P} onCreated={vi.fn()} onCancel={vi.fn()} />);
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Cần tiêu đề và mô tả thay đổi.");

    type("Tiêu đề", "Đăng xuất mọi thiết bị");
    type("Mô tả thay đổi", "   ");
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Cần tiêu đề và mô tả thay đổi.");

    type("Mô tả thay đổi", "Logout signs out all devices.");
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Chọn nguồn của yêu cầu thay đổi.");

    type("Nguồn *", "meeting_minutes");
    type("Người yêu cầu *", "   ");
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Nhập người yêu cầu thay đổi.");
    expect(bodies).toHaveLength(0);
  });

  it("gửi đủ trường: cắt khoảng trắng, tham chiếu/ghi chú rỗng ⇒ null; ghi chú có thì gửi", async () => {
    const bodies = captureCreate();
    renderWithIntl(<ChangeRequestForm projectId={P} onCreated={vi.fn()} onCancel={vi.fn()} />);
    type("Tiêu đề", "  Đăng xuất mọi thiết bị ");
    type("Mô tả thay đổi", " Logout signs out all devices. ");
    type("Nguồn *", "verbal");
    type("Người yêu cầu *", "BA Minh");
    type("Tham chiếu nguồn", "   ");
    type("Ghi chú", " họp 18/09 ");
    submit();

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      title: "Đăng xuất mọi thiết bị",
      description: "Logout signs out all devices.",
      source: { kind: "verbal", ref: null, note: "họp 18/09" },
      requester: "BA Minh",
    });
  });

  it("BE từ chối (chưa có baseline) ⇒ hiện lỗi thân thiện, không gọi onCreated", async () => {
    const onCreated = vi.fn();
    renderWithIntl(<ChangeRequestForm projectId={P} prefill={{ title: "T", description: "D", source: "verbal" }} onCreated={onCreated} onCancel={vi.fn()} />);
    type("Người yêu cầu *", "PM Lan");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Cần hoàn tất import (baseline 0.0) trước khi tạo change request.");
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tạo change request" })).toBeEnabled();
  });

  it("400 CR_SOURCE_REQUIRED từ BE ⇒ hiện thông điệp BE", async () => {
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/change-requests`, () =>
        HttpResponse.json({ data: null, error: { code: "CR_SOURCE_REQUIRED", message: "Thiếu nguồn hoặc người yêu cầu" } }, { status: 400 })
      )
    );
    renderWithIntl(<ChangeRequestForm projectId={P} prefill={{ title: "T", description: "D", source: "verbal" }} onCreated={vi.fn()} onCancel={vi.fn()} />);
    type("Người yêu cầu *", "PM Lan");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Thiếu nguồn hoặc người yêu cầu");
  });

  it("tạo trên mock thật sau baseline ⇒ CR-001 lưu nguồn + người yêu cầu; Huỷ gọi onCancel", async () => {
    await importToGapReview();
    const onCreated = vi.fn();
    const onCancel = vi.fn();
    renderWithIntl(<ChangeRequestForm projectId={P} prefill={{ title: "Sửa theo gap report", description: "- Thiếu mục 5.3", source: "gap_report", ref: "gap-report 0.0" }} onCreated={onCreated} onCancel={onCancel} />);
    type("Người yêu cầu *", "PM Lan");
    submit();
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(mode1State.mode1State.crs.get("CR-001")?.change_request).toMatchObject({
      source: { kind: "gap_report", ref: "gap-report 0.0" },
      requester: "PM Lan",
    });

    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
