import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteProject, renameProject } from "@/lib/api/projects";
import type { Project } from "@/types/project";
import ProjectActionDialogs from "./ProjectActionDialogs";

vi.mock("@/lib/api/projects", () => ({ renameProject: vi.fn(), deleteProject: vi.fn() }));

const project: Project = {
  _id: "p1",
  name: "Lumen",
  status: "active",
  sourceMode: "edit_srs",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

describe("ProjectActionDialogs", () => {
  beforeEach(() => {
    vi.mocked(renameProject).mockReset().mockResolvedValue({ data: null, error: null } as never);
    vi.mocked(deleteProject).mockReset().mockResolvedValue({ data: null, error: null } as never);
  });

  it("không có target ⇒ không render", () => {
    const { container } = render(<ProjectActionDialogs target={null} onClose={() => {}} onDone={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("đổi tên: điền sẵn tên cũ, gửi tên mới đã trim, tải lại rồi đóng", async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    render(<ProjectActionDialogs target={{ action: "rename", project }} onClose={onClose} onDone={onDone} />);

    const input = screen.getByLabelText("Tên dự án mới");
    expect(input).toHaveValue("Lumen");
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled(); // chưa đổi gì

    fireEvent.change(input, { target: { value: " Lumen 2 " } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(renameProject).toHaveBeenCalledWith("p1", "Lumen 2");
    expect(onDone).toHaveBeenCalled();
  });

  it.each([
    ["archive", "Lưu trữ", { hard: false }],
    ["delete", "Xoá vĩnh viễn", { hard: true }],
  ] as const)("%s: xác nhận ⇒ DELETE đúng kiểu", async (action, cta, opts) => {
    const onClose = vi.fn();
    render(<ProjectActionDialogs target={{ action, project }} onClose={onClose} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: cta }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleteProject).toHaveBeenCalledWith("p1", opts);
  });

  it("lỗi BE hiện trong dialog, không đóng", async () => {
    vi.mocked(deleteProject).mockRejectedValue(new Error("Không có quyền"));
    const onClose = vi.fn();
    render(<ProjectActionDialogs target={{ action: "delete", project }} onClose={onClose} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Xoá vĩnh viễn" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không có quyền");
    expect(onClose).not.toHaveBeenCalled();
  });
});
