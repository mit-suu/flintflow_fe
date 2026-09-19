import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "@/lib/api/projects";
import CreateProjectForm, { DEFAULT_PROJECT_NAME } from "./CreateProjectForm";

vi.mock("@/lib/api/projects", () => ({ createProject: vi.fn() }));

const submit = () => screen.getByRole("button", { name: /Bắt đầu|Đang tạo/ });

describe("CreateProjectForm (UC-13/14)", () => {
  beforeEach(() => {
    vi.mocked(createProject).mockReset();
  });

  it("điền sẵn tên; khoá nút khi chưa chọn mode hoặc tên rỗng", () => {
    render(<CreateProjectForm variant="inline" onCreated={() => {}} />);
    const name = screen.getByLabelText("Tên dự án");

    expect(name).toHaveValue(DEFAULT_PROJECT_NAME);
    expect(submit()).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Chưa có template/ }));
    expect(submit()).toBeEnabled();

    fireEvent.change(name, { target: { value: "   " } });
    expect(submit()).toBeDisabled();
  });

  it("gửi {name đã trim, sourceMode} rồi gọi onCreated với dự án BE trả", async () => {
    const created = { _id: "p9", name: "Lumen", sourceMode: "fpt_template" };
    vi.mocked(createProject).mockResolvedValue({ data: created, error: null } as never);
    const onCreated = vi.fn();
    render(<CreateProjectForm variant="dialog" onCreated={onCreated} />);

    fireEvent.click(screen.getByRole("radio", { name: /Chưa có template/ }));
    fireEvent.change(screen.getByLabelText("Tên dự án"), { target: { value: "  Lumen " } });
    fireEvent.click(submit());

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(createProject).toHaveBeenCalledWith("Lumen", "fpt_template");
  });

  it("lỗi hiện dưới form, giữ nguyên mode và tên để thử lại", async () => {
    vi.mocked(createProject).mockRejectedValue(new Error("Hết hạn phiên"));
    const onCreated = vi.fn();
    render(<CreateProjectForm variant="inline" onCreated={onCreated} />);

    fireEvent.click(screen.getByRole("radio", { name: /Chưa có template/ }));
    fireEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent("Hết hạn phiên");
    expect(screen.getByRole("radio", { name: /Chưa có template/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Tên dự án")).toHaveValue(DEFAULT_PROJECT_NAME);
    expect(submit()).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("dialog có nút Huỷ gọi onCancel, không tạo gì", () => {
    const onCancel = vi.fn();
    render(<CreateProjectForm variant="dialog" onCreated={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(createProject).not.toHaveBeenCalled();
  });
});
