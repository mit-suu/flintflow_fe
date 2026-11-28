import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { ApiClientError } from "@/lib/api/client";
import { fetchMe, updateExplanationStyle } from "@/lib/api/users";
import type { User } from "@/types/user";
import ExplanationStyleChip from "./ExplanationStyleChip";

vi.mock("@/lib/api/users", () => ({ fetchMe: vi.fn(), updateExplanationStyle: vi.fn() }));

const USER: User = { id: "u1", email: "ba@example.com" };

describe("ExplanationStyleChip (UC-90, ô chat workspace)", () => {
  beforeEach(() => {
    vi.mocked(fetchMe).mockReset();
    vi.mocked(updateExplanationStyle).mockReset();
  });

  it("tài khoản chưa có field ⇒ công tắc Giải thích bật; bấm ⇒ lưu Ngắn gọn, công tắc tắt", async () => {
    vi.mocked(fetchMe).mockResolvedValue(USER);
    vi.mocked(updateExplanationStyle).mockResolvedValue({ ...USER, explanationStyle: "concise" });
    renderWithIntl(<ExplanationStyleChip />);

    const toggle = await screen.findByRole("switch", { name: "Giải thích" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(updateExplanationStyle).toHaveBeenCalledWith("concise");
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("lưu lỗi ⇒ công tắc trả về trạng thái cũ", async () => {
    vi.mocked(fetchMe).mockResolvedValue({ ...USER, explanationStyle: "concise" });
    vi.mocked(updateExplanationStyle).mockRejectedValue(new ApiClientError(500, "INTERNAL", "Máy chủ đang gặp sự cố."));
    renderWithIntl(<ExplanationStyleChip />);

    const toggle = await screen.findByRole("switch", { name: "Giải thích" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(updateExplanationStyle).toHaveBeenCalledWith("explained");
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("không đọc được tài khoản ⇒ không hiện nút", async () => {
    vi.mocked(fetchMe).mockRejectedValue(new Error("network"));
    renderWithIntl(<ExplanationStyleChip />);
    await waitFor(() => expect(fetchMe).toHaveBeenCalled());
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
