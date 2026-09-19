import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import HomePage from "../page";
import CreateProjectDialog from "./CreateProjectDialog";

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/home" }));

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
  router.push.mockClear();
  router.replace.mockClear();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("CreateProjectDialog (UC-13)", () => {
  it("mặc định mode 2 (fpt); template khách hàng hiện 'Sắp có' và không chọn được", async () => {
    const onCreated = vi.fn();
    render(<CreateProjectDialog open onClose={vi.fn()} onCreated={onCreated} />);
    expect(screen.getByLabelText("Soạn SRS mới với AI")).toBeChecked();
    expect(screen.getByLabelText("Theo template của khách hàng")).toBeDisabled();
    expect(screen.getByText("Sắp có")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "App Đặt Xe" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo dự án →" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ name: "App Đặt Xe", mode: "fpt" })));
  });

  it("chọn upload SRS ⇒ tạo project mode import", async () => {
    const onCreated = vi.fn();
    render(<CreateProjectDialog open onClose={vi.fn()} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "Lumen" } });
    fireEvent.click(screen.getByLabelText("Upload SRS có sẵn rồi sửa"));
    fireEvent.click(screen.getByRole("button", { name: "Tạo dự án và tải SRS lên →" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ mode: "import", import_state: null })));
    expect(mode1State.mode1State.created).toHaveLength(1);
  });

  it("bấm thẻ “Theo template của khách hàng” (Sắp có) không đổi lựa chọn", () => {
    render(<CreateProjectDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Upload SRS có sẵn rồi sửa"));
    fireEvent.click(screen.getByText("Theo template của khách hàng"));
    expect(screen.getByLabelText("Theo template của khách hàng")).not.toBeChecked();
    expect(screen.getByLabelText("Upload SRS có sẵn rồi sửa")).toBeChecked();
    expect(screen.getByRole("button", { name: "Tạo dự án và tải SRS lên →" })).toBeInTheDocument();
  });

  it("chưa nhập tên ⇒ nút tạo khoá; BE lỗi ⇒ hiện lỗi, không gọi onCreated", async () => {
    mockServer.use(
      http.post(`${API_BASE_URL}/projects`, () =>
        HttpResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Tên dự án đã tồn tại" } }, { status: 400 })
      )
    );
    const onCreated = vi.fn();
    render(<CreateProjectDialog open onClose={vi.fn()} onCreated={onCreated} />);
    expect(screen.getByRole("button", { name: "Tạo dự án →" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Tạo dự án →" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "Lumen" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo dự án →" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tên dự án đã tồn tại");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("gửi mode trong body: mode 1 ⇒ { name, mode: \"import\" }", async () => {
    const bodies: unknown[] = [];
    mockServer.use(
      http.post(`${API_BASE_URL}/projects`, async ({ request }) => {
        bodies.push(await request.json());
        return undefined;
      })
    );
    render(<CreateProjectDialog open onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "  Lumen  " } });
    fireEvent.click(screen.getByLabelText("Upload SRS có sẵn rồi sửa"));
    fireEvent.click(screen.getByRole("button", { name: "Tạo dự án và tải SRS lên →" }));
    await waitFor(() => expect(bodies).toEqual([{ name: "Lumen", mode: "import" }]));
  });
});

describe("Trang /home — tạo dự án xong thì đi đâu", () => {
  /** Danh sách dự án rỗng + chuông thông báo: đủ để trang home dựng được trên msw. */
  const serveHome = () =>
    mockServer.use(
      http.get(`${API_BASE_URL}/projects`, () => HttpResponse.json({ data: [], error: null })),
      http.get(`${API_BASE_URL}/notifications/unread-count`, () => HttpResponse.json({ data: { count: 0 }, error: null }))
    );

  it("chọn mode 1 (upload SRS) ⇒ vào thẳng /projects/:id/import", async () => {
    serveHome();
    render(<HomePage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Dự án mới" }));
    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "Lumen" } });
    fireEvent.click(screen.getByLabelText("Upload SRS có sẵn rồi sửa"));
    fireEvent.click(screen.getByRole("button", { name: "Tạo dự án và tải SRS lên →" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    const created = mode1State.mode1State.created[0];
    expect(router.push).toHaveBeenCalledWith(`/projects/${created._id}/import`);
  });

  it("chọn mode 2 ⇒ ở lại danh sách (không chuyển trang)", async () => {
    serveHome();
    render(<HomePage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Dự án mới" }));
    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "App Đặt Xe" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo dự án →" }));

    await waitFor(() => expect(mode1State.mode1State.created).toHaveLength(1));
    await waitFor(() => expect(screen.queryByLabelText("Tên dự án")).not.toBeInTheDocument());
    expect(router.push).not.toHaveBeenCalled();
  });
});
