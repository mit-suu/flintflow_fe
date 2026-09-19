import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockServer } from "@/mocks/server";
import { resetMockState } from "@/mocks/state";
import { resetMode1MockState } from "@/mocks/mode1/state";
import * as mode1State from "@/mocks/mode1/state";
import CreateProjectDialog from "./CreateProjectDialog";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMockState();
  resetMode1MockState();
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
});
