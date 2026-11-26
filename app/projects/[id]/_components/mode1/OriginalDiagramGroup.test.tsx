/** Khối "Hình gốc sẽ đổi": mỗi hình có ảnh gốc + sơ đồ sau CR để so, nút Thay / Giữ từng chỗ và cả khối. */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { CrLocation } from "@/types/change-request";
import type { CrChat } from "../../hooks/mode1/useCrChat";
import OriginalDiagramGroup from "./OriginalDiagramGroup";

const fetchImage = vi.fn();
vi.mock("@/lib/api/change-requests", () => ({ fetchCrDiagramImage: (...args: unknown[]) => fetchImage(...args) }));

const image = { kind: "image", text: "Figure 2 - Use case", rows: null, image_ref: "word/media/image2.png", diagram: { kind: "usecase" } };
const loc = (id: string): CrLocation =>
  ({
    location_id: id,
    found_by: ["diagram"],
    conclusion: "edit",
    current_text: JSON.stringify({ blocks: [image] }),
    proposal: { old_text: JSON.stringify({ blocks: [image] }), new_text: JSON.stringify({ blocks: [{ ...image, image_ref: null }] }), spine_ops: [] },
  }) as unknown as CrLocation;

const chat = (over: Partial<CrChat> = {}) =>
  ({
    detail: { change_request: { cr_id: "CR-004" } },
    busy: null,
    isAccepted: () => false,
    accept: vi.fn(),
    acceptMany: vi.fn(),
    reject: vi.fn(),
    rejectMany: vi.fn(),
    ...over,
  }) as unknown as CrChat;

beforeEach(() => {
  fetchImage.mockReset();
  fetchImage.mockImplementation(async (_p: string, _c: string, _l: string, q: { variant: string; part: number }) => ({
    url: `blob:${q.variant}-${q.part}`,
    parts: q.variant === "after" ? 2 : 1,
  }));
});

describe("OriginalDiagramGroup", () => {
  it("mỗi hình: ảnh gốc + đủ các phần của sơ đồ sau CR", async () => {
    renderWithIntl(<OriginalDiagramGroup projectId="p1" locations={[loc("L1")]} chat={chat()} />);
    expect(screen.getByText("Hình gốc sẽ đổi (1)")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByAltText("Ảnh gốc: Sơ đồ use case")).toHaveAttribute("src", "blob:original-0"));
    expect(screen.getByAltText("Sơ đồ use case sau change request (1/2)")).toHaveAttribute("src", "blob:after-0");
    expect(screen.getByAltText("Sơ đồ use case sau change request (2/2)")).toHaveAttribute("src", "blob:after-1");
    expect(fetchImage).toHaveBeenCalledWith("p1", "CR-004", "L1", expect.objectContaining({ kind: "usecase", owner: null, variant: "original" }));
  });

  it("không tải được hình ⇒ báo, vẫn quyết được", async () => {
    fetchImage.mockRejectedValue(new Error("422"));
    const c = chat();
    renderWithIntl(<OriginalDiagramGroup projectId="p1" locations={[loc("L1")]} chat={c} />);
    expect(await screen.findAllByText(/Chưa hiện được hình/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Giữ hình gốc" }));
    expect(c.reject).toHaveBeenCalledTimes(1);
  });

  it("nhiều hình chưa quyết ⇒ Thay tất cả / Giữ tất cả cho cả khối", async () => {
    const c = chat();
    renderWithIntl(<OriginalDiagramGroup projectId="p1" locations={[loc("L1"), loc("L2")]} chat={c} />);
    fireEvent.click(screen.getByRole("button", { name: "Thay tất cả (2)" }));
    expect((c.acceptMany as ReturnType<typeof vi.fn>).mock.calls[0][0].map((l: CrLocation) => l.location_id)).toEqual(["L1", "L2"]);
    fireEvent.click(screen.getByRole("button", { name: "Giữ tất cả hình gốc" }));
    expect(c.rejectMany).toHaveBeenCalledTimes(1);
  });

  it("đã đồng ý thay ⇒ nhãn đã quyết thay cho nút", () => {
    renderWithIntl(<OriginalDiagramGroup projectId="p1" locations={[loc("L1")]} chat={chat({ isAccepted: () => true } as Partial<CrChat>)} />);
    const block = screen.getByLabelText("Hình gốc sẽ đổi");
    expect(within(block).getByText("Sẽ thay hình")).toBeInTheDocument();
    expect(within(block).queryByRole("button", { name: "Thay hình" })).not.toBeInTheDocument();
  });
});
