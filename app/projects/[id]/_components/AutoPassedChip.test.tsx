import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { mockServer } from "@/mocks/server";
import { setMockAutoPassed } from "@/mocks/handlers";
import AutoPassedChip from "./AutoPassedChip";

const P = "650000000000000000000001";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("AutoPassedChip (FLF-337 — thay đổi tự qua chưa xem)", () => {
  beforeEach(() =>
    setMockAutoPassed([
      { id: "ap1", step_id: "S-2.1", label_vi: "Actor", reason_vi: "Bước không có gì cần bạn quyết", at: "2026-10-27T01:00:00.000Z", seen: false },
      { id: "ap2", step_id: "S-2.2", label_vi: "Use case", reason_vi: "Bước không có gì cần bạn quyết", at: "2026-10-27T01:01:00.000Z", seen: false },
      { id: "ap3", step_id: "S-2.3", label_vi: "Sơ đồ", reason_vi: "Đã chốt ở bước trước", at: "2026-10-27T01:02:00.000Z", seen: true },
    ])
  );

  it("hiện số chưa xem; mở danh sách; Đã xem từng cái giảm số; Đánh dấu tất cả ⇒ chip biến mất khi đóng", async () => {
    renderWithIntl(<AutoPassedChip projectId={P} />);
    const chip = await screen.findByRole("button", { name: "2 thay đổi tự qua chưa xem" });
    fireEvent.click(chip);
    expect(screen.getByText(/không bắt buộc xem hết/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Đã xem" })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Đã xem" })[0]);
    await waitFor(() => expect(screen.getByRole("button", { name: "1 thay đổi tự qua chưa xem" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã xem tất cả" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Đã xem" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "0 thay đổi tự qua chưa xem" }));
    expect(screen.queryByRole("button", { name: /tự qua chưa xem/ })).toBeNull();
  });

  it("không có gì chưa xem ⇒ không hiện", async () => {
    setMockAutoPassed([{ id: "ap3", step_id: "S-2.3", label_vi: "Sơ đồ", reason_vi: "x", at: "2026-10-27T01:02:00.000Z", seen: true }]);
    const { container } = renderWithIntl(<AutoPassedChip projectId={P} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
