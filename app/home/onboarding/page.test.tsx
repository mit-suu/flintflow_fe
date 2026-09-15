"use client";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProject } from "@/lib/api/projects";
import { applyChanges, getSpine } from "@/lib/api/spine";
import OnboardingPage from "./page";
import { patchMe } from "./api";

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }));
vi.mock("@/lib/api/projects", () => ({ createProject: vi.fn() }));
vi.mock("@/lib/api/spine", () => ({ getSpine: vi.fn(), applyChanges: vi.fn() }));
vi.mock("./api", () => ({ patchMe: vi.fn() }));

const push = vi.fn();

const fillStep1AndGoTo2 = () => {
  fireEvent.change(screen.getByPlaceholderText("Ví dụ: Hiệp"), { target: { value: "Hiệp" } });
  fireEvent.change(screen.getByPlaceholderText(/Viết SRS/), { target: { value: "Viết SRS cho đồ án" } });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục →" }));
};

const goToStep3 = () => {
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục →" }));
};

describe("OnboardingPage (UC 1.12)", () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    push.mockReset();
    vi.mocked(createProject).mockReset();
    vi.mocked(getSpine).mockReset();
    vi.mocked(applyChanges).mockReset();
    vi.mocked(patchMe).mockReset();
  });

  it("bước 1 khoá 'Tiếp tục' khi chưa nhập tên", () => {
    render(<OnboardingPage />);
    expect(screen.getByRole("button", { name: "Tiếp tục →" })).toBeDisabled();
  });

  it("đi trọn 3 bước: tạo dự án, ghi working_mode + vision (project.vision từ 'mục tiêu'), patchMe(name), patchMe(onboardedAt), rồi push", async () => {
    vi.mocked(createProject).mockResolvedValue({ data: { _id: "proj1" } as never, error: null });
    vi.mocked(getSpine).mockResolvedValue({ data: { spine_version: 7 } as never, error: null });
    vi.mocked(applyChanges).mockResolvedValue({ data: { spine_version: 8 } as never, error: null });
    vi.mocked(patchMe).mockResolvedValue({ data: null, error: null });

    render(<OnboardingPage />);
    fillStep1AndGoTo2();
    goToStep3();

    fireEvent.change(screen.getByPlaceholderText("Ví dụ: App Đặt Xe Online"), { target: { value: "Dự án của Hiệp" } });
    fireEvent.click(screen.getByRole("button", { name: /Tạo dự án/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/proj1"));

    expect(createProject).toHaveBeenCalledWith("Dự án của Hiệp");
    expect(getSpine).toHaveBeenCalledWith("proj1");
    expect(applyChanges).toHaveBeenCalledWith("proj1", {
      base_version: 7,
      ops: [
        { op: "set", path: "project.working_mode", value: "fast", reason: "Onboarding" },
        { op: "set", path: "project.vision", value: "Viết SRS cho đồ án", reason: "Onboarding — mục tiêu ban đầu" },
      ],
    });
    expect(patchMe).toHaveBeenCalledWith({ name: "Hiệp" });
    expect(patchMe).toHaveBeenCalledWith({ onboardedAt: expect.any(String) });
  });

  it("patchMe(onboardedAt) lỗi ⇒ hiện lỗi, không push; bấm lại không tạo project lần 2", async () => {
    vi.mocked(createProject).mockResolvedValue({ data: { _id: "proj1" } as never, error: null });
    vi.mocked(getSpine).mockResolvedValue({ data: { spine_version: 1 } as never, error: null });
    vi.mocked(applyChanges).mockResolvedValue({ data: { spine_version: 2 } as never, error: null });
    vi.mocked(patchMe).mockImplementation((body) =>
      body.onboardedAt !== undefined
        ? Promise.reject(new Error("Lỗi mạng khi đánh dấu onboarded"))
        : Promise.resolve({ data: null, error: null })
    );

    render(<OnboardingPage />);
    fillStep1AndGoTo2();
    goToStep3();
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: App Đặt Xe Online"), { target: { value: "Dự án của Hiệp" } });
    fireEvent.click(screen.getByRole("button", { name: /Tạo dự án/ }));

    expect(await screen.findByText("Lỗi mạng khi đánh dấu onboarded")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(createProject).toHaveBeenCalledTimes(1);

    // Bấm lại: không tạo project lần 2 (giữ `createdProjectId` trong state), chỉ retry phần còn thiếu.
    vi.mocked(patchMe).mockResolvedValue({ data: null, error: null });
    fireEvent.click(screen.getByRole("button", { name: /Tạo dự án/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/proj1"));
    expect(createProject).toHaveBeenCalledTimes(1);
  });

  it("lỗi GET /spine (working_mode/vision) hiện lỗi, không push", async () => {
    vi.mocked(createProject).mockResolvedValue({ data: { _id: "proj1" } as never, error: null });
    vi.mocked(getSpine).mockRejectedValue(new Error("Không đọc được Spine"));

    render(<OnboardingPage />);
    fillStep1AndGoTo2();
    goToStep3();
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: App Đặt Xe Online"), { target: { value: "Dự án của Hiệp" } });
    fireEvent.click(screen.getByRole("button", { name: /Tạo dự án/ }));

    expect(await screen.findByText("Không đọc được Spine")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(applyChanges).not.toHaveBeenCalled();
  });
});
