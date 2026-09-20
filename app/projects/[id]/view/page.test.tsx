"use client";

import { screen } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyChanges, getSpine } from "@/lib/api/spine";
import { assembleDocument } from "@/lib/api/export";
import { mockTiming, resetMockChangeFlowState } from "@/mocks/handlers";
import { mockServer } from "@/mocks/server";
import { MOCK_PROJECT_ID, resetMockState } from "@/mocks/state";
import ReadOnlyDocumentPage from "./page";

const P = MOCK_PROJECT_ID;

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: P }),
}));

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

describe("view/page.tsx — read-only projection (UC 1.14)", () => {
  it("có heading section, ẩn hoàn toàn flags/readiness/stale/by/reason của change", async () => {
    const base_version = await version();
    await applyChanges(P, {
      base_version,
      ops: [{ op: "add", path: "actors[]", value: { id: "A01", name: "Founder", kind: "human", description: "Chủ dự án" } }],
    });
    await assembleDocument(P, await version());

    renderWithIntl(<ReadOnlyDocumentPage />);

    expect(await screen.findByText(/§1 Product Overview/)).toBeInTheDocument();
    expect(await screen.findByText(/§2.1 Actors/)).toBeInTheDocument();
    // "Chỉ đọc" (badge title) chứa chữ "đọc" nhưng KHÔNG phải nội dung nội bộ dưới đây:
    expect(screen.queryByText(/cờ đỏ/)).not.toBeInTheDocument();
    expect(screen.queryByText(/accepted ·/)).not.toBeInTheDocument();
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
    expect(screen.queryByText(/chờ duyệt lại/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Danh sách cờ")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tóm tắt độ sẵn sàng")).not.toBeInTheDocument();
  });

  it("section bắt buộc chưa accepted (Use Case Descriptions, chưa có use_cases) hiện 'chưa hoàn thiện'", async () => {
    await assembleDocument(P, await version());

    renderWithIntl(<ReadOnlyDocumentPage />);

    expect(await screen.findByText(/§2.2.2 Use Case Descriptions/)).toBeInTheDocument();
    const section = screen.getByText(/§2.2.2 Use Case Descriptions/).closest("article");
    expect(section).not.toBeNull();
    expect(section!.textContent).toContain("chưa hoàn thiện");
  });

  it("section đã accepted (Product Overview) không hiện 'chưa hoàn thiện'", async () => {
    await assembleDocument(P, await version());

    renderWithIntl(<ReadOnlyDocumentPage />);

    const section = (await screen.findByText(/§1 Product Overview/)).closest("article");
    expect(section).not.toBeNull();
    expect(section!.textContent).not.toContain("chưa hoàn thiện");
  });

  it("chưa ghép tài liệu thì hiện lỗi, không crash trang trắng", async () => {
    renderWithIntl(<ReadOnlyDocumentPage />);

    expect(await screen.findByText(/Không tải được tài liệu/)).toBeInTheDocument();
  });
});
