"use client";

import { render, screen, waitFor } from "@testing-library/react";
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

    render(<DocumentPane projectId="p1" projectName="FlintFlow" />);

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

    render(<DocumentPane projectId="p1" />);

    expect(await screen.findByText("stale")).toBeInTheDocument();
  });

  it("chip stale không hiện khi meta.stale = false", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    render(<DocumentPane projectId="p1" />);

    await waitFor(() => expect(screen.getByText(/§1 Product Overview/)).toBeInTheDocument());
    expect(screen.queryByText("stale")).not.toBeInTheDocument();
  });

  it("section chờ duyệt lại (awaiting_reaccept) hiện chip riêng", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    render(<DocumentPane projectId="p1" />);

    expect(await screen.findByText("Chờ duyệt lại")).toBeInTheDocument();
  });

  it("409 NO_WORKING_DRAFT hiện lý do và nút đi tới S-8.2", async () => {
    getDocument.mockRejectedValueOnce(new ApiClientError(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu."));
    const onSelectStep = vi.fn();

    render(<DocumentPane projectId="p1" onSelectStep={onSelectStep} />);

    expect(await screen.findByText("Chưa có bản ghép tài liệu")).toBeInTheDocument();
    expect(screen.getByText("Chưa ghép tài liệu.")).toBeInTheDocument();
    screen.getByRole("button", { name: /Đi tới S-8.2/ }).click();
    expect(onSelectStep).toHaveBeenCalledWith("S-8.2");
  });

  it("chưa ghép + có getBaseVersion: 'Ghép tài liệu ngay' gọi POST /assemble ở version hiện tại rồi tải lại tài liệu", async () => {
    const assembleDocument = vi.mocked(exportApi.assembleDocument);
    assembleDocument.mockResolvedValueOnce({ data: { spine_version: 363, sections: 40, generated_at: "2026-09-17T00:00:00.000Z" }, error: null } as never);
    getDocument
      .mockRejectedValueOnce(new ApiClientError(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu."))
      .mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 363, spine_version: 363, stale: false } });

    render(<DocumentPane projectId="p1" onSelectStep={vi.fn()} getBaseVersion={() => 363} />);

    (await screen.findByRole("button", { name: "Ghép tài liệu ngay" })).click();
    await waitFor(() => expect(assembleDocument).toHaveBeenCalledWith("p1", 363));
    expect(await screen.findByText("Vision statement")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đi tới S-8.2/ })).not.toBeInTheDocument();
  });

  it("ghép lỗi SPINE_VERSION_CONFLICT: hiện lý do tiếng Việt", async () => {
    vi.mocked(exportApi.assembleDocument).mockRejectedValueOnce(new ApiClientError(409, "SPINE_VERSION_CONFLICT", "conflict"));
    getDocument.mockRejectedValueOnce(new ApiClientError(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu."));

    render(<DocumentPane projectId="p1" getBaseVersion={() => 1} />);

    (await screen.findByRole("button", { name: "Ghép tài liệu ngay" })).click();
    expect(await screen.findByText(/Tài liệu vừa đổi ở phiên khác/)).toBeInTheDocument();
  });

  it("nút xem tại step hiện theo flag mở khớp section_id", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    render(<DocumentPane projectId="p1" flags={[redFlag]} onSelectStep={vi.fn()} />);

    expect(await screen.findByText(/xem tại S-3.1/)).toBeInTheDocument();
  });
<<<<<<< HEAD:app/projects/[projectId]/_components/DocumentPane.test.tsx
=======

  it("mode 1 v2 (FLF-185): heading nhóm chỉ tiêu đề; mục riêng có nhãn; số hiệu rỗng không in §; section rỗng gợi ý step sở hữu", async () => {
    const onSelectStep = vi.fn();
    getDocument.mockResolvedValueOnce({
      data: {
        ...fixture,
        sections: [
          { id: "group:2", number: "2", heading: "Yêu cầu người dùng", level: 1, blocks: [] },
          { id: "fixed:5.1", number: "2.1", heading: "Quy tắc nghiệp vụ", level: 2, status: "draft", blocks: [] },
          { id: "fixed:4.2.4", number: "2.2", heading: "Bảo mật", level: 2, status: "draft", blocks: [] },
          { id: "custom:CS02", number: "", heading: "Phụ lục A Biên bản họp", level: 1, blocks: [{ type: "paragraph", runs: [{ text: "Họp 12/09" }] }] },
        ],
      },
      error: null,
      meta: { assembled_at_version: 5, spine_version: 5, stale: false },
    });
    const hints: Record<string, { stepId: string; missing: boolean }> = {
      "fixed:5.1": { stepId: "S-7.1", missing: true },
      "fixed:4.2.4": { stepId: "S-6.5", missing: false },
    };
    render(<DocumentPane projectId="p1" onSelectStep={onSelectStep} emptyHintOf={(id) => hints[id]} />);

    expect(await screen.findByText("§2 Yêu cầu người dùng")).toBeInTheDocument();
    expect(document.querySelector("[data-section-id=\"group:2\"]")?.textContent).not.toContain("Chưa hoàn thiện");
    const rules = document.querySelector("[data-section-id=\"fixed:5.1\"]") as HTMLElement;
    expect(rules).toHaveTextContent("Thiếu");
    expect(rules).toHaveTextContent("Chưa có nội dung — chạy step S-7.1");
    expect(document.querySelector("[data-section-id=\"fixed:4.2.4\"]")).not.toHaveTextContent("Thiếu");
    const appendix = document.querySelector("[data-section-id=\"custom:CS02\"]") as HTMLElement;
    expect(appendix).toHaveTextContent("Mục riêng");
    expect(appendix.querySelector("h5")?.textContent).toBe("Phụ lục A Biên bản họp");
    screen.getAllByRole("button", { name: "Mở step" })[0].click();
    expect(onSelectStep).toHaveBeenCalledWith("S-7.1");
  });
>>>>>>> 64c5c9d6d2ef9995dd4ae90e2421caaeb2a87099:app/projects/[id]/_components/DocumentPane.test.tsx
});
