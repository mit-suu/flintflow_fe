"use client";

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DocumentPane, { followsHeading } from "./DocumentPane";
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
      expect(screen.getByText(/1\. Product Overview/)).toBeInTheDocument();
    });
    expect(screen.getByText(/2\.1\. Actors/)).toBeInTheDocument();
    expect(screen.getByText(/2\.2\.2\. Use Case Descriptions/)).toBeInTheDocument();
    expect(screen.getByText(/3\.1\.2\. Screen Descriptions/)).toBeInTheDocument();
    expect(screen.getByText(/5\.5\. Glossary/)).toBeInTheDocument();
    expect(screen.getByText("Vision statement")).toBeInTheDocument();
    expect(screen.getByText("Founder")).toBeInTheDocument();
  });

  it("FLF-248: mục feature (tiêu đề nhóm, không có thân) không hiện 'Chưa hoàn thiện'; mục cố định rỗng vẫn hiện", async () => {
    const doc: RenderedDocument = {
      ...fixture,
      sections: [
        { id: "feature:F1", number: "3.2", heading: "Authentication", level: 2, status: "accepted", blocks: [] },
        { id: "fixed:5.2", number: "5.2", heading: "Common Requirements", level: 2, status: "accepted", blocks: [] },
      ],
    };
    getDocument.mockResolvedValueOnce({ data: doc, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" projectName="FlintFlow" />);

    await waitFor(() => expect(screen.getByText(/3\.2\. Authentication/)).toBeInTheDocument());
    expect(screen.getAllByText(/Chưa hoàn thiện/)).toHaveLength(1);
  });

  it("tài liệu cũ hơn Spine (meta.stale): nút Làm mới ghép lại ở version hiện tại, không lộ chữ 'stale'", async () => {
    const assembleDocument = vi.mocked(exportApi.assembleDocument);
    assembleDocument.mockResolvedValueOnce({ data: { spine_version: 6, sections: 40, generated_at: "2026-09-23T00:00:00.000Z" }, error: null } as never);
    getDocument
      .mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 4, spine_version: 6, stale: true } })
      .mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 6, spine_version: 6, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" getBaseVersion={() => 6} />);

    const refresh = await screen.findByRole("button", { name: "Làm mới" });
    expect(refresh).toHaveAttribute("title", expect.stringMatching(/ghép lại/));
    expect(screen.queryByText("stale")).toBeNull();
    fireEvent.click(refresh);
    await waitFor(() => expect(assembleDocument).toHaveBeenCalledWith("p1", 6));
  });

  it("tài liệu khớp Spine: nút Làm mới chỉ tải lại", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" getBaseVersion={() => 5} />);

    await waitFor(() => expect(screen.getByText(/1\. Product Overview/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Làm mới" })).toHaveAttribute("title", "Tải lại tài liệu");
  });

  it("section chờ duyệt lại (awaiting_reaccept) hiện chip riêng", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" />);

    expect(await screen.findByText("Chờ duyệt lại")).toBeInTheDocument();
  });

  it("409 NO_WORKING_DRAFT hiện lý do và nút đi tới bước Ghép tài liệu", async () => {
    getDocument.mockRejectedValueOnce(new ApiClientError(409, "NO_WORKING_DRAFT", "Chưa ghép tài liệu."));
    const onSelectStep = vi.fn();

    renderWithIntl(<DocumentPane projectId="p1" onSelectStep={onSelectStep} />);

    expect(await screen.findByText("Chưa có bản ghép tài liệu")).toBeInTheDocument();
    // `ApiClientError` dịch message theo mã, nên hiện câu của `messages/vi.json → errors.NO_WORKING_DRAFT`.
    expect(screen.getByText("Tài liệu chưa được ghép. Hãy chạy bước Ghép tài liệu trước.")).toBeInTheDocument();
    screen.getByRole("button", { name: /Đi tới bước Ghép tài liệu/ }).click();
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

  it("mục có vấn đề mở: chấm số theo section_id, bấm mở panel kiểm tra lọc theo mục", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onOpenSectionIssues = vi.fn();

    renderWithIntl(<DocumentPane projectId="p1" flags={[redFlag]} onOpenSectionIssues={onOpenSectionIssues} />);

    const dot = await screen.findByTitle("Xem vấn đề của mục này");
    expect(dot).toHaveTextContent("1");
    fireEvent.click(dot);
    expect(onOpenSectionIssues).toHaveBeenCalledWith("fixed:2.1");
  });

  it("chip trạng thái trên header: số vấn đề thật, bấm mở panel", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onOpenIssues = vi.fn();

    renderWithIntl(<DocumentPane projectId="p1" issues={{ blocking: 2, suggestions: 3 }} onOpenIssues={onOpenIssues} />);

    fireEvent.click(await screen.findByRole("button", { name: /2 vấn đề cần xử lý/ }));
    expect(onOpenIssues).toHaveBeenCalledTimes(1);
  });

  it("Sửa mục này gửi nhãn mục đọc được (§số tên) để điền sẵn lệnh sửa trong chat", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onEditSection = vi.fn();

    renderWithIntl(<DocumentPane projectId="p1" onEditSection={onEditSection} />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Sửa mục này" }))[0]);
    expect(onEditSection).toHaveBeenCalledWith(expect.stringMatching(/^§1 Product Overview$/));
  });

  it("mode 1 v2 (FLF-185): heading nhóm chỉ tiêu đề; mục riêng có nhãn; số hiệu rỗng không in số; section rỗng gợi ý step sở hữu", async () => {
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
    renderWithIntl(<DocumentPane projectId="p1" onSelectStep={onSelectStep} emptyHintOf={(id) => hints[id]} />);

    expect(await screen.findByText("2. Yêu cầu người dùng")).toBeInTheDocument();
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
});

describe("DocumentPane — nút Vẽ lại sơ đồ theo mục", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  // Đúng dạng BE trả: `GET /document` đã thay `diagram-ref:<id>` bằng PNG base64 — ảnh KHÔNG mang id sơ đồ
  const withErd: RenderedDocument = {
    ...fixture,
    sections: [
      { id: "fixed:3.1.5", number: "3.1.5", heading: "Entity Relationship Diagram", level: 2, status: "accepted", blocks: [{ type: "image", png: "iVBORw0KGgo=", caption: "ERD" }] },
      { id: "fixed:2.1", number: "2.1", heading: "Actors", level: 2, status: "accepted", blocks: [{ type: "paragraph", runs: [{ text: "No diagram here" }] }] },
    ],
  };

  beforeEach(() => {
    getDocument.mockReset();
    getDocument.mockResolvedValue({ data: withErd, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
  });

  it("mục có sơ đồ (ảnh base64 thật) ⇒ có nút; bấm gọi vẽ lại đúng mục", async () => {
    const onRedrawSection = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(<DocumentPane projectId="p1" onRedrawSection={onRedrawSection} hasDiagrams={(id) => id === "fixed:3.1.5"} />);

    fireEvent.click(await screen.findByRole("button", { name: "Vẽ lại sơ đồ" }));
    await waitFor(() => expect(onRedrawSection).toHaveBeenCalledWith("fixed:3.1.5"));
    expect(screen.getAllByRole("button", { name: "Vẽ lại sơ đồ" })).toHaveLength(1);
  });

  it("vẽ lại lỗi ⇒ báo ngay dưới sơ đồ", async () => {
    const onRedrawSection = vi.fn().mockRejectedValue(new Error("Không tìm thấy sơ đồ này — tải lại trang rồi thử lại."));
    renderWithIntl(<DocumentPane projectId="p1" onRedrawSection={onRedrawSection} hasDiagrams={() => true} />);
    fireEvent.click(await screen.findByRole("button", { name: "Vẽ lại sơ đồ" }));
    expect(await screen.findByText(/Không tìm thấy sơ đồ này/)).toBeInTheDocument();
  });

  it("không truyền onRedrawSection (mode 1, trang read-only) hoặc Spine không có sơ đồ của mục ⇒ không có nút", async () => {
    const { unmount } = renderWithIntl(<DocumentPane projectId="p1" hasDiagrams={() => true} />);
    await screen.findByAltText("ERD");
    expect(screen.queryByRole("button", { name: "Vẽ lại sơ đồ" })).toBeNull();
    unmount();

    renderWithIntl(<DocumentPane projectId="p1" onRedrawSection={vi.fn()} hasDiagrams={() => false} />);
    await screen.findByAltText("ERD");
    expect(screen.queryByRole("button", { name: "Vẽ lại sơ đồ" })).toBeNull();
  });
});

describe("followsHeading", () => {
  it("bảng đầu section hoặc ngay sau heading con thì cách tiêu đề; sau đoạn văn thì không", () => {
    const blocks = [
      { type: "table" as const, header: [], rows: [] },
      { type: "heading" as const, level: 3, text: "Sub" },
      { type: "table" as const, header: [], rows: [] },
      { type: "paragraph" as const, runs: [{ text: "p" }] },
      { type: "table" as const, header: [], rows: [] },
    ];
    expect(blocks.map((_, i) => followsHeading(blocks, i))).toEqual([true, false, true, false, false]);
  });
});
