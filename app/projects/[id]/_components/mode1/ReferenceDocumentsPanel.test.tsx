import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { mockServer } from "@/mocks/server";
import { mode1Handlers, resetMode1Extraction, MODE1_DOC_ID } from "@/mocks/mode1/handlers";
import { resetMode1MockState, MODE1_PROJECT_ID } from "@/mocks/mode1/state";
import ReferenceDocumentsPanel from "./ReferenceDocumentsPanel";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  resetMode1MockState();
  resetMode1Extraction();
  mockServer.use(...mode1Handlers);
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("ReferenceDocumentsPanel (FLF-338 — tài liệu tham khảo ⇒ rút yêu cầu)", () => {
  it("liệt kê tài liệu; Rút yêu cầu ⇒ hỏi credit trước (cổng cứng §3.6); Chạy ⇒ danh sách rút hiện ra; duyệt ⇒ onCrsCreated", async () => {
    const onCrsCreated = vi.fn();
    renderWithIntl(<ReferenceDocumentsPanel projectId={MODE1_PROJECT_ID} onCrsCreated={onCrsCreated} />);
    expect(await screen.findByText("minutes.txt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rút yêu cầu" }));
    const dialog = await screen.findByRole("dialog", { name: "Xác nhận credit trước khi rút yêu cầu" });
    expect(dialog).toHaveTextContent(/tốn ~1 credit/);
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));

    expect(await screen.findByRole("heading", { name: /minutes.txt — 3 yêu cầu/ })).toBeInTheDocument();
    expect(screen.getByText("3 yêu cầu chờ duyệt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rút lại" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Ai đưa ra yêu cầu/), { target: { value: "PM Lan" } });
    fireEvent.click(screen.getByRole("button", { name: "Under 2 seconds" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo 2 change request" }));
    await waitFor(() => expect(onCrsCreated).toHaveBeenCalledTimes(1));
    expect(screen.getByText("đã duyệt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CR-001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rút lại" })).toBeNull();
  });

  it("Huỷ ở thẻ credit ⇒ không gọi AI; Xoá tài liệu ⇒ biến mất; không có tài liệu ⇒ không hiện gì", async () => {
    renderWithIntl(<ReferenceDocumentsPanel projectId={MODE1_PROJECT_ID} onCrsCreated={vi.fn()} />);
    await screen.findByText("minutes.txt");
    fireEvent.click(screen.getByRole("button", { name: "Rút yêu cầu" }));
    fireEvent.click(await screen.findByRole("button", { name: "Huỷ" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/yêu cầu chờ duyệt/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    await waitFor(() => expect(screen.queryByText("minutes.txt")).toBeNull());
    expect(MODE1_DOC_ID).toBeTruthy();
  });
});
