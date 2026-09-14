import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { estimateActionCost } from "../../../../lib/api/chat";
import ChatInput from "./ChatInput";

vi.mock("../../../../lib/api/chat", () => ({
  estimateActionCost: vi.fn(),
}));

const renderInput = (actionType: "chat" | "chat_discovery") =>
  render(
    <ChatInput
      inputMessage=""
      setInputMessage={() => {}}
      onSendMessage={() => {}}
      sending={false}
      pendingAttachments={[]}
      onSelectAttachment={() => {}}
      onRemoveAttachment={() => {}}
      actionType={actionType}
    />
  );

describe("ChatInput credit estimate", () => {
  beforeEach(() => {
    vi.mocked(estimateActionCost).mockReset();
  });

  it("ẩn giá khi BE lỗi, lần mount sau thử gọi lại", async () => {
    vi.mocked(estimateActionCost)
      .mockRejectedValueOnce(new Error("401"))
      .mockResolvedValueOnce({ data: { actionType: "chat_discovery", cost: 3 }, error: null });

    const first = renderInput("chat_discovery");
    await waitFor(() => expect(estimateActionCost).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/credit \/ msg/)).not.toBeInTheDocument();
    first.unmount();

    renderInput("chat_discovery");
    expect(await screen.findByText("~3 credit / msg")).toBeInTheDocument();
    expect(estimateActionCost).toHaveBeenCalledTimes(2);
  });

  it("hiện giá từ BE và không gọi lại khi mount lại cùng actionType", async () => {
    vi.mocked(estimateActionCost).mockResolvedValue({
      data: { actionType: "chat", cost: 2 },
      error: null,
    });

    const first = renderInput("chat");
    expect(await screen.findByText("~2 credit / msg")).toBeInTheDocument();
    first.unmount();

    renderInput("chat");
    expect(await screen.findByText("~2 credit / msg")).toBeInTheDocument();
    expect(estimateActionCost).toHaveBeenCalledTimes(1);
    expect(estimateActionCost).toHaveBeenCalledWith("chat");
  });
});
