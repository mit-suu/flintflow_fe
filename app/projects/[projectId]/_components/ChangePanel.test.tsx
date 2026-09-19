"use client";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl, vietnameseLeftovers } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyChanges, getSpine } from "@/lib/api/spine";
import { mockTiming, resetMockChangeFlowState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import ChangePanel from "./ChangePanel";
import type { ApplyResult } from "@/types/pipeline";

const P = MOCK_PROJECT_ID;

beforeAll(() => {
  mockTiming.stepDelayMs = 0;
  mockServer.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  resetMockState();
  resetMockChangeFlowState();
});
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const version = async () => (await getSpine(P)).data!.spine_version;

/** Seed một actor bằng ops thuần để lệnh tự nhiên có đối tượng để sửa (mock T17 chỉ đổi actor đầu). */
const seedActor = async () => {
  const base_version = await version();
  await applyChanges(P, {
    base_version,
    ops: [{ op: "add", path: "actors[]", value: { id: "A01", name: "Founder", kind: "human", description: "Ban đầu" } }],
  });
  return version();
};

describe("ChangePanel — trọn luồng trên mock T16 (UC 6.8–6.11)", () => {
  it("nhập lệnh → preview (msw) → DiffPreviewModal → xác nhận → onApplied; sau đó undo và xem lịch sử", async () => {
    let currentVersion = await seedActor();
    const getBaseVersion = () => currentVersion;
    const onApplied = vi.fn((result: ApplyResult) => {
      currentVersion = result.spine_version;
    });
    const onClose = vi.fn();

    renderWithIntl(<ChangePanel projectId={P} getBaseVersion={getBaseVersion} getLatestSeq={() => null} onApplied={onApplied} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("Lệnh sửa"), { target: { value: "làm rõ vai trò" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước thay đổi" }));

    expect(await screen.findByRole("heading", { name: "Xem trước thay đổi" })).toBeInTheDocument();
    expect(screen.getByText(/actors\[id=A01\]/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Xem trước thay đổi" })).not.toBeInTheDocument();

    // Undo op cuối — lô vừa áp bị đảo, `onApplied` được gọi lần hai với kết quả đã revert.
    fireEvent.click(screen.getByRole("button", { name: "Undo op cuối" }));
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(2));

    // Lịch sử — 20 dòng gần nhất qua `GET /changes`.
    fireEvent.click(screen.getByRole("button", { name: /Xem lịch sử thay đổi/ }));
    expect(await screen.findByText(/actors\[id=A01\]/)).toBeInTheDocument();
  });

  it("lệnh không tìm được đối tượng (chưa có actor) ⇒ hiện câu hỏi làm rõ, không mở DiffPreviewModal", async () => {
    const base_version = await version();
    renderWithIntl(
      <ChangePanel projectId={P} getBaseVersion={() => base_version} getLatestSeq={() => null} onApplied={vi.fn()} onClose={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText("Lệnh sửa"), { target: { value: "đổi gì đó" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước thay đổi" }));

    expect(await screen.findByText("Cần làm rõ")).toBeInTheDocument();
    expect(screen.getByText(/Chưa rõ đối tượng cần sửa/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Xem trước thay đổi" })).not.toBeInTheDocument();
  });

  it("mở lại panel với seed cũ (nonce không đổi) không tự chạy lại lệnh lần hai", async () => {
    const base_version = await seedActor();
    const onApplied = vi.fn();
    const seed = { text: "làm rõ vai trò", nonce: 1 };

    const { rerender } = renderWithIntl(
      <ChangePanel
        projectId={P}
        getBaseVersion={() => base_version}
        getLatestSeq={() => null}
        onApplied={onApplied}
        onClose={vi.fn()}
        seed={seed}
      />
    );

    expect(await screen.findByRole("heading", { name: "Xem trước thay đổi" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(screen.queryByRole("heading", { name: "Xem trước thay đổi" })).not.toBeInTheDocument();

    // Cùng object `seed` (cùng nonce) re-render lại — không được tự mở preview lần nữa.
    rerender(
      <ChangePanel
        projectId={P}
        getBaseVersion={() => base_version}
        getLatestSeq={() => null}
        onApplied={onApplied}
        onClose={vi.fn()}
        seed={{ ...seed }}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("heading", { name: "Xem trước thay đổi" })).not.toBeInTheDocument();
  });
});

describe("ChangePanel — bản en (T25)", () => {
  it("khung panel, lịch sử và traceability không còn tiếng Việt", async () => {
    renderWithIntl(<ChangePanel projectId={P} getBaseVersion={() => 1} getLatestSeq={() => null} onApplied={vi.fn()} onClose={vi.fn()} />, "en");
    expect(screen.getByRole("heading", { name: "Edit by command" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show change history (20 rows)" }));
    fireEvent.click(screen.getByRole("button", { name: "Look up traceability" }));
    expect(await screen.findByText("No history from the Change panel yet.")).toBeInTheDocument();
    expect(vietnameseLeftovers(document.body)).toEqual([]);
  });
});
