"use client";

import { screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DocumentPane from "./DocumentPane";
import * as exportApi from "@/lib/api/export";
import { ApiClientError } from "@/lib/api/client";
import type { RenderedDocument } from "@/types/document";
import type { Flag } from "@/types/flags";

vi.mock("@/lib/api/export", () => ({
  getDocument: vi.fn(),
  assembleDocument: vi.fn(),
}));

const fixture: RenderedDocument = {
  projectId: "p1",
  projectName: "FlintFlow",
  version: "v0.5",
  source: "draft",
  watermark: "DRAFT",
  generatedAt: "2026-09-15T00:00:00.000Z",
  sections: [
    { id: "fixed:1", number: "1", heading: "Product Overview", level: 1, status: "accepted", blocks: [{ type: "paragraph", runs: [{ text: "Vision statement" }] }] },
    {
      id: "fixed:2.1",
      number: "2.1",
      heading: "Actors",
      level: 2,
      status: "accepted",
      blocks: [{ type: "table", header: [[{ text: "ID" }], [{ text: "Name" }]], rows: [[[{ text: "A01" }], [{ text: "Founder" }]]] }],
    },
    {
      id: "fixed:2.2.2",
      number: "2.2.2",
      heading: "Use Case Descriptions",
      level: 2,
      status: "draft",
      blocks: [{ type: "bullet_list", items: [[{ text: "UC01: Create Project" }]] }],
    },
    {
      id: "fixed:3.1.2",
      number: "3.1.2",
      heading: "Screen Descriptions",
      level: 2,
      status: "stale",
      awaiting_reaccept: true,
      blocks: [{ type: "numbered_list", items: [[{ text: "S01: Login" }]] }],
    },
    {
      id: "fixed:5.5",
      number: "5.5",
      heading: "Glossary",
      level: 2,
      status: "derived",
      blocks: [],
    },
  ],
  recordOfChanges: [],
  flagsAppendix: { redOpen: [], staleCount: 0, waived: [] },
};

const redFlag: Flag = {
  id: "FL01",
  level: "red",
  rule_id: "array_empty",
  section_id: "fixed:2.1",
  target_id: null,
  message: "Actors rỗng",
  remediation_step: "S-3.1",
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
};

describe("DocumentPane", () => {
  const getDocument = vi.mocked(exportApi.getDocument);

  beforeEach(() => {
    getDocument.mockReset();
  });

  it("render đủ 5 chương từ fixture RenderedDocument", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" projectName="FlintFlow" />);

    await waitFor(() => {
      expect(screen.getByText(/§1 Product Overview/)).toBeInTheDocument();
    });
    expect(screen.getByText(/§2.1 Actors/)).toBeInTheDocument();
    expect(screen.getByText(/§2.2.2 Use Case Descriptions/)).toBeInTheDocument();
    expect(screen.getByText(/§3.1.2 Screen Descriptions/)).toBeInTheDocument();
    expect(screen.getByText(/§5.5 Glossary/)).toBeInTheDocument();
    expect(screen.getByText("Vision statement")).toBeInTheDocument();
    expect(screen.getByText("Founder")).toBeInTheDocument();
  });

  it("chip stale hiện đúng khi meta.stale = true", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 4, spine_version: 6, stale: true } });

    renderWithIntl(<DocumentPane projectId="p1" />);

    expect(await screen.findByText("stale")).toBeInTheDocument();
  });

  it("chip stale không hiện khi meta.stale = false", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" />);

    await waitFor(() => expect(screen.getByText(/§1 Product Overview/)).toBeInTheDocument());
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
  });

  it("section chờ duyệt lại (awaiting_reaccept) hiện chip riêng", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" />);

    expect(await screen.findByText("Chờ duyệt lại")).toBeInTheDocument();
  });

  it("409 NO_WORKING_DRAFT hiện lý do và nút đi tới S-8.2", async () => {
    getDocument.mockRejectedValueOnce(new ApiClientError(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu."));
    const onSelectStep = vi.fn();

    renderWithIntl(<DocumentPane projectId="p1" onSelectStep={onSelectStep} />);

    expect(await screen.findByText("Chưa có bản ghép tài liệu")).toBeInTheDocument();
    // Câu BE "Chưa ghép tài liệu." được thay bằng bản dịch theo mã NO_WORKING_DRAFT (T25)
    expect(screen.getByText("Chưa ghép tài liệu — chạy S-8.2 (Ghép tài liệu) trước.")).toBeInTheDocument();
    screen.getByRole("button", { name: /Đi tới S-8.2/ }).click();
    expect(onSelectStep).toHaveBeenCalledWith("S-8.2");
  });

  it("chưa ghép + có getBaseVersion: 'Ghép tài liệu ngay' gọi POST /assemble ở version hiện tại rồi tải lại tài liệu", async () => {
    const assembleDocument = vi.mocked(exportApi.assembleDocument);
    assembleDocument.mockResolvedValueOnce({ data: { spine_version: 363, sections: 40, generated_at: "2026-09-17T00:00:00.000Z" }, error: null } as never);
    getDocument
      .mockRejectedValueOnce(new ApiClientError(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu."))
      .mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 363, spine_version: 363, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" onSelectStep={vi.fn()} getBaseVersion={() => 363} />);

    (await screen.findByRole("button", { name: "Ghép tài liệu ngay" })).click();
    await waitFor(() => expect(assembleDocument).toHaveBeenCalledWith("p1", 363));
    expect(await screen.findByText("Vision statement")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đi tới S-8.2/ })).not.toBeInTheDocument();
  });

  it("ghép lỗi SPINE_VERSION_CONFLICT: hiện lý do tiếng Việt", async () => {
    vi.mocked(exportApi.assembleDocument).mockRejectedValueOnce(new ApiClientError(409, "SPINE_VERSION_CONFLICT", "conflict"));
    getDocument.mockRejectedValueOnce(new ApiClientError(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu."));

    renderWithIntl(<DocumentPane projectId="p1" getBaseVersion={() => 1} />);

    (await screen.findByRole("button", { name: "Ghép tài liệu ngay" })).click();
    expect(await screen.findByText(/Tài liệu vừa đổi ở phiên khác/)).toBeInTheDocument();
  });

  it("nút xem tại step hiện theo flag mở khớp section_id", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" flags={[redFlag]} onSelectStep={vi.fn()} />);

    expect(await screen.findByText(/xem tại S-3.1/)).toBeInTheDocument();
  });
});
