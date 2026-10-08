import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { adjustAdminOrgCredits, type AdminOrg } from "@/lib/api/admin";
import AdjustCreditsDialog from "./AdjustCreditsDialog";

vi.mock("@/lib/api/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/admin")>()),
  adjustAdminOrgCredits: vi.fn(),
}));

const ORG: AdminOrg = {
  id: "o1",
  name: "Alpha Studio",
  owner: null,
  plan: "free",
  planLabel: "Free",
  wallet: { balance: 100, reserved: 80, available: 20 },
  membersCount: 1,
  projectsCount: 0,
  createdAt: "2026-09-01T00:00:00.000Z",
};

const renderDialog = () => {
  const onAdjusted = vi.fn();
  const onClose = vi.fn();
  renderWithIntl(<AdjustCreditsDialog org={ORG} onClose={onClose} onAdjusted={onAdjusted} />);
  return { onAdjusted, onClose };
};

const fill = (amount: string, reason: string) => {
  fireEvent.change(screen.getByLabelText("Số credit"), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText("Lý do (bắt buộc)"), { target: { value: reason } });
};

describe("AdjustCreditsDialog — UC-68", () => {
  beforeEach(() => {
    vi.mocked(adjustAdminOrgCredits).mockReset();
  });

  it("bắt buộc số nguyên dương và lý do tối thiểu 3 ký tự", () => {
    renderDialog();
    const confirm = screen.getByRole("button", { name: "Xác nhận cộng" });
    expect(confirm).toBeDisabled();

    fill("1.5", "Bù sự cố");
    expect(screen.getByText("Nhập số nguyên dương.")).toBeInTheDocument();
    expect(confirm).toBeDisabled();

    fill("10", "ab");
    expect(confirm).toBeDisabled();

    fill("10", "abc");
    expect(confirm).toBeEnabled();
  });

  it("trừ: gửi số âm, không cho trừ quá phần khả dụng (số dư − đang giữ)", async () => {
    vi.mocked(adjustAdminOrgCredits).mockResolvedValue({
      organizationId: "o1",
      organizationName: "Alpha Studio",
      amount: -15,
      balance: 85,
      reserved: 80,
      reason: "Thu hồi khuyến mãi",
    });
    const { onAdjusted, onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Trừ credit" }));
    fill("30", "Thu hồi khuyến mãi");
    expect(screen.getByText("Chỉ trừ được tối đa 20 credit (phần khả dụng).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận trừ" })).toBeDisabled();

    fill("15", "  Thu hồi khuyến mãi ");
    expect(screen.getByText("85")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận trừ" }));

    await waitFor(() => expect(onAdjusted).toHaveBeenCalled());
    expect(adjustAdminOrgCredits).toHaveBeenCalledWith("o1", { amount: -15, reason: "Thu hồi khuyến mãi" });
    expect(onClose).toHaveBeenCalled();
  });

  it("BE từ chối vì số dư không đủ ⇒ báo lỗi dành cho admin, giữ hộp thoại mở", async () => {
    vi.mocked(adjustAdminOrgCredits).mockRejectedValue(
      new ApiClientError(409, "INSUFFICIENT_CREDIT", "Số dư khả dụng của tổ chức không đủ để trừ")
    );
    const { onAdjusted, onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Trừ credit" }));
    fill("10", "Thu hồi");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận trừ" }));

    expect(await screen.findByText(/Số dư khả dụng của tổ chức không đủ để trừ/)).toBeInTheDocument();
    expect(onAdjusted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
