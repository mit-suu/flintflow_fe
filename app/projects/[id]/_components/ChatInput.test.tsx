import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const estimateActionCost = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/api/chat", () => ({ estimateActionCost }));

// Cache giá nằm ở cấp module: nạp lại ChatInput mỗi test để các ca không dùng chung cache
const renderInput = async () => {
  const { default: ChatInput } = await import("./ChatInput");
  const mount = () =>
    renderWithIntl(
      <ChatInput
        inputMessage=""
        setInputMessage={() => {}}
        onSendMessage={() => {}}
        sending={false}
        pendingAttachments={[]}
        onSelectAttachment={() => {}}
        onRemoveAttachment={() => {}}
        actionType="chat"
      />
    );
  return mount;
};

describe("ChatInput credit estimate", () => {
  beforeEach(() => {
    vi.resetModules();
    estimateActionCost.mockReset();
  });

  it("ẩn giá khi BE lỗi, lần mount sau thử gọi lại", async () => {
    estimateActionCost
      .mockRejectedValueOnce(new Error("401"))
      .mockResolvedValueOnce({ data: { actionType: "chat", cost: 3 }, error: null });

    const mount = await renderInput();
    const first = mount();
    await waitFor(() => expect(estimateActionCost).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/credit \/ msg/)).not.toBeInTheDocument();
    first.unmount();

    mount();
    expect(await screen.findByText("~3 credit / msg")).toBeInTheDocument();
    expect(estimateActionCost).toHaveBeenCalledTimes(2);
  });

  it("hiện giá từ BE và không gọi lại khi mount lại cùng actionType", async () => {
    estimateActionCost.mockResolvedValue({
      data: { actionType: "chat", cost: 2 },
      error: null,
    });

    const mount = await renderInput();
    const first = mount();
    expect(await screen.findByText("~2 credit / msg")).toBeInTheDocument();
    first.unmount();

    mount();
    expect(await screen.findByText("~2 credit / msg")).toBeInTheDocument();
    expect(estimateActionCost).toHaveBeenCalledTimes(1);
    expect(estimateActionCost).toHaveBeenCalledWith("chat");
  });
});
