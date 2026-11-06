"use client";

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentPane, { FRESH_HOLD_MS, followsHeading } from "./DocumentPane";
import { blockRegionKey, sectionRegionKey } from "./document-diff";
import type { DocumentUpdate, UseDocumentResult } from "../hooks/useDocument";
import * as exportApi from "@/lib/api/export";
import * as documentImages from "@/lib/api/document-images";
import { ApiClientError } from "@/lib/api/client";
import type { RenderedDocument } from "@/types/document";
import type { Flag } from "@/types/flags";

vi.mock("@/lib/api/export", () => ({
  getDocument: vi.fn(),
}));

vi.mock("@/lib/api/document-images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/document-images")>()),
  fetchDocumentImage: vi.fn(),
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

  it("nút Làm mới chỉ tải lại — không còn trạng thái đã cũ nào để người dùng tự xử lý", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" />);

    await waitFor(() => expect(screen.getByText(/1. Product Overview/)).toBeInTheDocument());
    const refresh = screen.getByRole("button", { name: "Tải lại tài liệu" });
    expect(refresh).toHaveAttribute("title", "Tải lại tài liệu");
    fireEvent.click(refresh);
    await waitFor(() => expect(getDocument).toHaveBeenCalledTimes(2));
  });

  /**
   * Lượt tải lại trước đây gỡ cả danh sách mục xuống rồi dựng lại, nên người đang đọc giữa tài liệu bị
   * ném về đầu trang sau mỗi lệnh sửa.
   */
  it("tải lại không gỡ các mục đang hiển thị xuống", async () => {
    let releaseSecondRead = () => {};
    getDocument
      .mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          releaseSecondRead = () => resolve({ data: fixture, error: null, meta: { assembled_at_version: 6, spine_version: 6, stale: false } });
        }) as never
      );

    const { rerender } = renderWithIntl(<DocumentPane projectId="p1" refreshToken={0} />);
    await waitFor(() => expect(screen.getByText(/1. Product Overview/)).toBeInTheDocument());

    rerender(<DocumentPane projectId="p1" refreshToken={1} />);
    await waitFor(() => expect(getDocument).toHaveBeenCalledTimes(2));
    // Lượt đọc thứ hai còn treo: mục cũ vẫn trên màn, không có skeleton "Đang tải tài liệu…"
    expect(screen.getByText(/1. Product Overview/)).toBeInTheDocument();
    expect(screen.queryByText("Đang tải tài liệu…")).toBeNull();

    releaseSecondRead();
    await waitFor(() => expect(screen.getByText(/1. Product Overview/)).toBeInTheDocument());
  });

  it("section chờ duyệt lại (awaiting_reaccept) hiện chip riêng", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });

    renderWithIntl(<DocumentPane projectId="p1" />);

    expect(await screen.findByText("Chờ duyệt lại")).toBeInTheDocument();
  });

  it("dự án chưa có nội dung: nói tài liệu sẽ tự hiện, không mời bấm gì", async () => {
    getDocument.mockResolvedValueOnce({ data: null, error: null, meta: { state: "not_assembled" } } as never);

    renderWithIntl(<DocumentPane projectId="p1" onSelectStep={vi.fn()} />);

    expect(await screen.findByText(/Tài liệu sẽ hiện ở đây/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ghép/ })).not.toBeInTheDocument();
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

  it("Góp ý ghim vào đúng mục đang đọc, kèm nhãn mục (UC-49)", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onCommentSection = vi.fn();

    renderWithIntl(<DocumentPane projectId="p1" onCommentSection={onCommentSection} />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Góp ý" }))[0]);
    expect(onCommentSection).toHaveBeenCalledWith({ sectionId: "fixed:1", label: "§1 Product Overview" });
  });

  it("mục có góp ý đang mở ⇒ chấm số mở panel góp ý", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onOpenSectionComments = vi.fn();

    renderWithIntl(
      <DocumentPane
        projectId="p1"
        commentCountOf={(id) => (id === "fixed:2.1" ? 2 : 0)}
        onOpenSectionComments={onOpenSectionComments}
      />
    );

    const dot = await screen.findByTitle("Xem góp ý của mục này");
    expect(dot).toHaveTextContent("2");
    fireEvent.click(dot);
    expect(onOpenSectionComments).toHaveBeenCalledWith("fixed:2.1");
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
    const hints: Record<string, { stepId: string }> = {
      "fixed:5.1": { stepId: "S-7.1" },
      "fixed:4.2.4": { stepId: "S-6.5" },
    };
    renderWithIntl(<DocumentPane projectId="p1" onSelectStep={onSelectStep} emptyHintOf={(id) => hints[id]} />);

    expect(await screen.findByText("2. Yêu cầu người dùng")).toBeInTheDocument();
    expect(document.querySelector("[data-section-id=\"group:2\"]")?.textContent).not.toContain("Chưa hoàn thiện");
    const rules = document.querySelector("[data-section-id=\"fixed:5.1\"]") as HTMLElement;
    // FLF-312: mẫu FPT không bắt buộc — mục trống không mang nhãn "Thiếu"
    expect(rules).not.toHaveTextContent("Thiếu");
    expect(rules).toHaveTextContent("Chưa có nội dung — chạy step S-7.1");
    expect(document.querySelector("[data-section-id=\"fixed:4.2.4\"]")).toHaveTextContent("Chưa có nội dung — chạy step S-6.5");
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

describe("DocumentPane — khung sơ đồ vẽ lỗi", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  // BE giữ chỗ hình vẽ lỗi bằng `diagram-error:<id>` thay vì bỏ hình khỏi mục
  const withFailed: RenderedDocument = {
    ...fixture,
    sections: [
      {
        id: "fixed:2.2.1",
        number: "2.2.1",
        heading: "Use Case Diagram",
        level: 3,
        status: "accepted",
        blocks: [{ type: "image", png: "diagram-error:D02-3", caption: "Use Cases — Authentication — diagram could not be drawn yet" }],
      },
    ],
  };

  beforeEach(() => {
    getDocument.mockReset();
    getDocument.mockResolvedValue({ data: withFailed, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
  });

  it("hiện khung lỗi thay cho ảnh, kèm chú thích; Thử lại gọi vẽ lại đúng id sơ đồ", async () => {
    const onRedrawDiagram = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(<DocumentPane projectId="p1" onRedrawDiagram={onRedrawDiagram} />);
    const box = await screen.findByRole("group", { name: "Sơ đồ chưa vẽ được" });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/diagram could not be drawn yet/)).toBeInTheDocument();
    fireEvent.click(within(box).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(onRedrawDiagram).toHaveBeenCalledWith("D02-3"));
  });

  it("vẽ lại vẫn lỗi ⇒ báo ngay trong khung", async () => {
    const onRedrawDiagram = vi.fn().mockRejectedValue(new Error("Không vẽ lại được sơ đồ"));
    renderWithIntl(<DocumentPane projectId="p1" onRedrawDiagram={onRedrawDiagram} />);
    const box = await screen.findByRole("group", { name: "Sơ đồ chưa vẽ được" });
    fireEvent.click(within(box).getByRole("button", { name: "Thử lại" }));
    expect(await within(box).findByText("Không vẽ lại được sơ đồ")).toBeInTheDocument();
  });

  it("không truyền onRedrawDiagram (mode 1, Viewer) ⇒ khung chỉ báo lỗi, không có nút", async () => {
    renderWithIntl(<DocumentPane projectId="p1" />);
    const box = await screen.findByRole("group", { name: "Sơ đồ chưa vẽ được" });
    expect(within(box).queryByRole("button")).toBeNull();
  });
});

describe("DocumentPane — ngôn ngữ tài liệu (FLF-265)", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  const draftMeta = { assembled_at_version: 5, spine_version: 5, stale: false };
  const chip = () => screen.getByTitle(/^Ngôn ngữ tài liệu/);

  beforeEach(() => {
    getDocument.mockReset();
  });

  it("tài liệu ở ngôn ngữ gốc (không có meta.translation) ⇒ chip theo ngôn ngữ dự án, đứng trước nút Làm mới; không cảnh báo", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: draftMeta });

    renderWithIntl(<DocumentPane projectId="p1" documentLanguage="en" onTranslate={vi.fn()} />);

    await screen.findByText(/1\. Product Overview/);
    expect(chip()).toHaveTextContent("EN");
    expect(chip()).toHaveAttribute("title", "Ngôn ngữ tài liệu: English");
    expect(chip().querySelector("[lang]")).toHaveAttribute("lang", "en");
    expect(chip().compareDocumentPosition(screen.getByRole("button", { name: "Tải lại tài liệu" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/mục chưa dịch/)).toBeNull();
  });

  it("còn mục chưa dịch ⇒ chip theo meta.translation + “N mục chưa dịch · Dịch tài liệu”; bấm mở hộp dịch", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { ...draftMeta, translation: { locale: "vi", source_locale: "en", missing: 12 } } });
    const onTranslate = vi.fn();

    renderWithIntl(<DocumentPane projectId="p1" documentLanguage="vi" onTranslate={onTranslate} />);

    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent("12 mục chưa dịch");
    expect(chip()).toHaveTextContent("VI");
    fireEvent.click(within(warning).getByRole("button", { name: "Dịch tài liệu" }));
    expect(onTranslate).toHaveBeenCalledTimes(1);
  });

  it("Viewer (không truyền onTranslate) ⇒ vẫn thấy số mục chưa dịch nhưng không có nút dịch", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { ...draftMeta, translation: { locale: "vi", source_locale: "en", missing: 3 } } });

    renderWithIntl(<DocumentPane projectId="p1" documentLanguage="vi" />);

    expect(await screen.findByRole("status")).toHaveTextContent("3 mục chưa dịch");
    expect(screen.queryByRole("button", { name: "Dịch tài liệu" })).toBeNull();
  });

  it("đã dịch đủ (missing 0) ⇒ chỉ còn chip, không cảnh báo", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { ...draftMeta, translation: { locale: "vi", source_locale: "en", missing: 0 } } });

    renderWithIntl(<DocumentPane projectId="p1" documentLanguage="vi" onTranslate={vi.fn()} />);

    await screen.findByText(/1\. Product Overview/);
    expect(chip()).toHaveTextContent("VI");
    expect(screen.queryByText(/mục chưa dịch/)).toBeNull();
  });

  it("mode 1: chưa biết ngôn ngữ file ⇒ không chip; có truyền nhầm onTranslate cũng không có nút dịch (D3)", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: draftMeta });

    const { unmount } = renderWithIntl(<DocumentPane projectId="p1" mode1 documentLanguage={null} onTranslate={vi.fn()} />);
    await screen.findByText(/1\. Product Overview/);
    expect(screen.queryByTitle("Ngôn ngữ tài liệu")).toBeNull();
    unmount();

    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { ...draftMeta, translation: { locale: "vi", source_locale: "en", missing: 2 } } });
    renderWithIntl(<DocumentPane projectId="p1" mode1 documentLanguage={null} onTranslate={vi.fn()} />);
    expect(await screen.findByRole("status")).toHaveTextContent("2 mục chưa dịch");
    expect(screen.queryByRole("button", { name: "Dịch tài liệu" })).toBeNull();
  });

  it("ngôn ngữ dự án đổi ⇒ tải lại tài liệu theo ngôn ngữ mới", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: draftMeta });

    const { rerender } = renderWithIntl(<DocumentPane projectId="p1" documentLanguage="en" />);
    await screen.findByText(/1\. Product Overview/);
    expect(getDocument).toHaveBeenCalledTimes(1);

    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { ...draftMeta, translation: { locale: "vi", source_locale: "en", missing: 4 } } });
    rerender(<DocumentPane projectId="p1" documentLanguage="vi" />);

    expect(await screen.findByRole("status")).toHaveTextContent("4 mục chưa dịch");
    expect(getDocument).toHaveBeenCalledTimes(2);
    expect(chip()).toHaveTextContent("VI");
  });
});

describe("DocumentPane — nút làm mới chỉ icon", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  const meta = { assembled_at_version: 5, spine_version: 5, stale: false };
  const button = (name: string) => screen.getByRole("button", { name });

  beforeEach(() => getDocument.mockReset());

  it("không còn chữ 'Làm mới' / 'Đang làm mới…'; bình thường: bấm được, không busy", async () => {
    getDocument.mockResolvedValue({ data: fixture, error: null, meta });
    renderWithIntl(<DocumentPane projectId="p1" />);
    await screen.findByText(/1\. Product Overview/);

    const refresh = button("Tải lại tài liệu");
    expect(refresh).toBeEnabled();
    expect(refresh).toHaveAttribute("aria-busy", "false");
    expect(refresh).toHaveAttribute("title", "Tải lại tài liệu");
    expect(refresh).toHaveTextContent("");
    expect(refresh.querySelector("svg")).not.toHaveClass("animate-spin");
  });

  it("đang làm mới (bấm tay): icon xoay + khoá + aria-busy + nhãn 'Đang làm mới tài liệu'; xong thì trở lại", async () => {
    let release: () => void = () => {};
    getDocument
      .mockResolvedValueOnce({ data: fixture, error: null, meta })
      .mockReturnValueOnce(new Promise((resolve) => (release = () => resolve({ data: fixture, error: null, meta }))) as never);
    renderWithIntl(<DocumentPane projectId="p1" />);
    await screen.findByText(/1\. Product Overview/);

    fireEvent.click(button("Tải lại tài liệu"));

    const busy = await screen.findByRole("button", { name: "Đang làm mới tài liệu" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy).toHaveAttribute("title", "Đang làm mới tài liệu");
    expect(busy.querySelector("svg")).toHaveClass("animate-spin");
    // Tài liệu đang đọc vẫn nguyên trong lúc tải
    expect(screen.getByText(/1\. Product Overview/)).toBeInTheDocument();

    release();
    await waitFor(() => expect(button("Tải lại tài liệu")).toBeEnabled());
    expect(button("Tải lại tài liệu").querySelector("svg")).not.toHaveClass("animate-spin");
  });

  it("tự tải (refreshToken tăng) cũng xoay + khoá — một nguồn trạng thái cho mọi lượt làm mới", async () => {
    let release: () => void = () => {};
    getDocument
      .mockResolvedValueOnce({ data: fixture, error: null, meta })
      .mockReturnValueOnce(new Promise((resolve) => (release = () => resolve({ data: fixture, error: null, meta }))) as never);
    const { rerender } = renderWithIntl(<DocumentPane projectId="p1" refreshToken={0} />);
    await screen.findByText(/1\. Product Overview/);

    rerender(<DocumentPane projectId="p1" refreshToken={1} />);

    expect(await screen.findByRole("button", { name: "Đang làm mới tài liệu" })).toBeDisabled();
    release();
    await waitFor(() => expect(button("Tải lại tài liệu")).toBeEnabled());
  });

  it("làm mới lỗi: giữ nguyên tài liệu, báo lỗi nhỏ, icon đứng yên và bấm lại được", async () => {
    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta }).mockRejectedValueOnce(new Error("mất mạng"));
    renderWithIntl(<DocumentPane projectId="p1" />);
    await screen.findByText(/1\. Product Overview/);

    fireEvent.click(button("Tải lại tài liệu"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa làm mới được tài liệu");
    expect(screen.getByText(/1\. Product Overview/)).toBeInTheDocument();
    expect(screen.queryByText(/Không tải được tài liệu:/)).toBeNull();
    const retry = button("Tải lại tài liệu");
    expect(retry).toBeEnabled();
    expect(retry.querySelector("svg")).not.toHaveClass("animate-spin");

    getDocument.mockResolvedValueOnce({ data: fixture, error: null, meta });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(getDocument).toHaveBeenCalledTimes(3);
  });
});

describe("DocumentPane — mục đang / vừa cập nhật", () => {
  const meta = { assembled_at_version: 5, spine_version: 5, stale: false };
  const makeDoc = (over: Partial<UseDocumentResult> = {}): UseDocumentResult => ({
    document: fixture,
    meta,
    translation: null,
    loading: false,
    refreshing: false,
    empty: false,
    error: null,
    refreshError: null,
    lastDiff: null,
    pendingSectionIds: new Set(),
    markPending: vi.fn(),
    clearPending: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    ...over,
  });
  const diffOf = (regions: string[], extra: Partial<DocumentUpdate> = {}): DocumentUpdate => ({
    seq: 1,
    sections: new Map([["fixed:2.1", "changed"]]),
    blocks: new Map(),
    broad: false,
    regions,
    ...extra,
  });
  const article = (id: string) => document.querySelector(`article[data-section-id="${id}"]`) as HTMLElement;

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("mục đang chờ bản mới: data-update=pending + aria-busy; mục khác không", () => {
    renderWithIntl(<DocumentPane projectId="p1" doc={makeDoc({ pendingSectionIds: new Set(["fixed:2.1"]) })} />);

    expect(article("fixed:2.1")).toHaveAttribute("data-update", "pending");
    expect(article("fixed:2.1")).toHaveAttribute("aria-busy", "true");
    expect(article("fixed:1")).not.toHaveAttribute("data-update");
    expect(article("fixed:1")).not.toHaveAttribute("aria-busy");
    // Chữ giữ nguyên, không bị che
    expect(screen.getByText("Founder")).toBeInTheDocument();
  });

  it("đang chờ nhiều mục ⇒ nhãn nổi 'Đang cập nhật N mục'", () => {
    renderWithIntl(<DocumentPane projectId="p1" doc={makeDoc({ pendingSectionIds: new Set(["fixed:2.1", "fixed:1"]) })} />);
    expect(screen.getByText("Đang cập nhật 2 mục")).toBeInTheDocument();
  });

  it("bản mới về: mục fresh + lời đọc 'Đã cập nhật mục §2.1 Actors'; đủ 2s trong khung nhìn thì nhạt dần (settled)", async () => {
    vi.useFakeTimers();
    renderWithIntl(<DocumentPane projectId="p1" doc={makeDoc({ lastDiff: diffOf([sectionRegionKey("fixed:2.1")]) })} />);

    expect(article("fixed:2.1")).toHaveAttribute("data-update", "fresh");
    expect(article("fixed:1")).not.toHaveAttribute("data-update");
    expect(screen.getByText("Đã cập nhật mục §2.1 Actors")).toBeInTheDocument();

    // jsdom không có IntersectionObserver ⇒ coi là đang thấy ngay, đếm 2s
    await act(async () => {
      await Promise.resolve();
    });
    expect(article("fixed:2.1")).toHaveAttribute("data-update", "fresh");
    act(() => void vi.advanceTimersByTime(FRESH_HOLD_MS));
    expect(article("fixed:2.1")).toHaveAttribute("data-update", "settled");
  });

  it("chỉ một đoạn đổi ⇒ chỉ block đó fresh, mục không", () => {
    const lastDiff = diffOf([blockRegionKey("fixed:2.1", 0)], { blocks: new Map([["fixed:2.1", new Set([0])]]) });
    renderWithIntl(<DocumentPane projectId="p1" doc={makeDoc({ lastDiff })} />);

    expect(article("fixed:2.1")).not.toHaveAttribute("data-update");
    expect(article("fixed:2.1").querySelector('[data-update-region="block:fixed:2.1#0"]')).toHaveAttribute("data-update", "fresh");
  });

  describe("vùng ngoài màn hình", () => {
    class FakeObserver {
      static instances: FakeObserver[] = [];
      targets: Element[] = [];
      constructor(private callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
        FakeObserver.instances.push(this);
      }
      observe(el: Element) {
        this.targets.push(el);
      }
      disconnect() {}
      unobserve() {}
      report(visible: boolean) {
        this.callback(this.targets.map((target) => ({ target, isIntersecting: visible })));
      }
    }

    beforeEach(() => {
      FakeObserver.instances = [];
      vi.stubGlobal("IntersectionObserver", FakeObserver);
    });

    it("vùng đổi chưa vào khung nhìn ⇒ nhãn 'N mục vừa cập nhật', bấm cuộn tới; thấy rồi thì nhãn ẩn", async () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      renderWithIntl(<DocumentPane projectId="p1" doc={makeDoc({ lastDiff: diffOf([sectionRegionKey("fixed:2.1")]) })} />);
      const observer = FakeObserver.instances.at(-1)!;
      expect(observer.targets).toHaveLength(1);
      // Chưa biết vùng nào ngoài màn hình thì chưa dựng nhãn (tránh nháy)
      expect(screen.queryByText(/vừa cập nhật/)).toBeNull();

      act(() => observer.report(false));
      fireEvent.click(await screen.findByRole("button", { name: /1 mục vừa cập nhật/ }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);

      act(() => observer.report(true));
      expect(screen.queryByText(/vừa cập nhật/)).toBeNull();
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    });
  });

  it("đổi diện rộng: không tô từng mục, chỉ nhãn chung 'Tài liệu đã cập nhật' (bấm để ẩn)", () => {
    renderWithIntl(<DocumentPane projectId="p1" doc={makeDoc({ lastDiff: diffOf([], { broad: true }) })} />);

    expect(document.querySelector("[data-update]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tài liệu đã cập nhật" }));
    expect(screen.queryByRole("button", { name: "Tài liệu đã cập nhật" })).toBeNull();
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

describe("DocumentPane — Nhờ AI soạn mục riêng của mẫu bắt buộc (FLF-278)", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  const withCustom: RenderedDocument = {
    ...fixture,
    sections: [
      ...fixture.sections,
      { id: "custom:CS07", number: "1.2", heading: "Document Conventions", level: 2, status: null, blocks: [] },
      { id: "custom:CS08", number: "1.6", heading: "References", level: 2, status: null, blocks: [{ type: "paragraph", runs: [{ text: "IEEE 830" }] }] },
    ],
  } as RenderedDocument;

  it("chỉ mục riêng còn trống có nút; bấm gửi nhãn mục để điền sẵn lệnh soạn nháp; không truyền ⇒ không có", async () => {
    getDocument.mockResolvedValueOnce({ data: withCustom, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onDraftSection = vi.fn();
    const { unmount } = renderWithIntl(<DocumentPane projectId="p1" onDraftSection={onDraftSection} />);
    const buttons = await screen.findAllByRole("button", { name: "Nhờ AI soạn" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onDraftSection).toHaveBeenCalledWith("§1.2 Document Conventions");
    unmount();
    getDocument.mockResolvedValueOnce({ data: withCustom, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    renderWithIntl(<DocumentPane projectId="p1" />);
    await screen.findByText("References", { exact: false });
    expect(screen.queryByRole("button", { name: "Nhờ AI soạn" })).not.toBeInTheDocument();
  });

  it("mẫu cố định (requiredTemplate): mục riêng là 'Mục của mẫu'; mục mẫu trống map vào mục FlintFlow cũng có Nhờ AI soạn", async () => {
    const mapped = {
      ...withCustom,
      sections: [
        ...withCustom.sections,
        { id: "fixed:4.1", number: "3.1.2", heading: "Software Interfaces", level: 3, status: null, blocks: [] },
      ],
    } as RenderedDocument;
    getDocument.mockResolvedValueOnce({ data: mapped, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onDraftSection = vi.fn();
    renderWithIntl(<DocumentPane projectId="p1" onDraftSection={onDraftSection} requiredTemplate />);
    const buttons = await screen.findAllByRole("button", { name: "Nhờ AI soạn" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onDraftSection).toHaveBeenLastCalledWith("§3.1.2 Software Interfaces");
    expect(screen.getAllByText("Mục của mẫu").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mục riêng")).not.toBeInTheDocument();
  });

  it("mục riêng chỉ có chữ hướng dẫn của mẫu vẫn là mục trống: có Nhờ AI soạn, không có Lưu vào thư viện", async () => {
    const guidanceOnly = {
      ...withCustom,
      sections: [
        ...fixture.sections,
        { id: "custom:CS09", number: "1.3", heading: "Intended Audience", level: 2, status: null, blocks: [{ type: "paragraph", runs: [{ text: "[Describe the different types of reader]" }] }] },
      ],
    } as RenderedDocument;
    getDocument.mockResolvedValueOnce({ data: guidanceOnly, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onDraftSection = vi.fn();
    renderWithIntl(<DocumentPane projectId="p1" onDraftSection={onDraftSection} onSaveToLibrary={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Nhờ AI soạn" }));
    expect(onDraftSection).toHaveBeenCalledWith("§1.3 Intended Audience");
    expect(screen.queryByRole("button", { name: "Lưu vào thư viện" })).not.toBeInTheDocument();
  });

  it("heading bao của mẫu (mục riêng trống chỉ chứa mục con) không có Nhờ AI soạn", async () => {
    const withWrapper = {
      ...withCustom,
      sections: [
        ...fixture.sections,
        { id: "custom:CS10", number: "2", heading: "Overall Description", level: 1, status: null, blocks: [] },
        { id: "custom:CS11", number: "2.1", heading: "Product Perspective", level: 2, status: null, blocks: [] },
      ],
    } as RenderedDocument;
    getDocument.mockResolvedValueOnce({ data: withWrapper, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onDraftSection = vi.fn();
    renderWithIntl(<DocumentPane projectId="p1" onDraftSection={onDraftSection} />);
    const buttons = await screen.findAllByRole("button", { name: "Nhờ AI soạn" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onDraftSection).toHaveBeenCalledWith("§2.1 Product Perspective");
  });
});

describe("DocumentPane — thư viện nội dung của tổ chức (FLF-278)", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  const withCustom: RenderedDocument = {
    ...fixture,
    sections: [
      ...fixture.sections,
      { id: "custom:CS07", number: "1.2", heading: "Document Conventions", level: 2, status: null, blocks: [] },
      { id: "custom:CS08", number: "1.6", heading: "References", level: 2, status: null, blocks: [{ type: "paragraph", runs: [{ text: "IEEE 830" }] }] },
    ],
  } as RenderedDocument;

  it("mục trống có gợi ý ⇒ nút dùng nội dung; mục đã viết ⇒ lưu vào thư viện; dải áp tất cả", async () => {
    getDocument.mockResolvedValueOnce({ data: withCustom, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
    const onUseLibrary = vi.fn();
    const onSaveToLibrary = vi.fn();
    const onUseLibraryAll = vi.fn();
    renderWithIntl(
      <DocumentPane
        projectId="p1"
        libraryMatchOf={(id) => (id === "custom:CS07" ? { empty: true } : undefined)}
        onUseLibrary={onUseLibrary}
        onSaveToLibrary={onSaveToLibrary}
        libraryEmptyCount={1}
        onUseLibraryAll={onUseLibraryAll}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Dùng nội dung của tổ chức" }));
    expect(onUseLibrary).toHaveBeenCalledWith("custom:CS07");
    const save = screen.getAllByRole("button", { name: "Lưu vào thư viện" });
    expect(save).toHaveLength(1);
    fireEvent.click(save[0]);
    expect(onSaveToLibrary).toHaveBeenCalledWith("custom:CS08");
    expect(screen.getByText(/có sẵn nội dung cho 1 mục còn trống/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem trước và dùng" }));
    expect(onUseLibraryAll).toHaveBeenCalledTimes(1);
  });
});

describe("DocumentPane — ảnh theo tham chiếu image-ref", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  const fetchImage = vi.mocked(documentImages.fetchDocumentImage);
  const TOKEN = "image-ref:diagram:D1@0123456789abcdef";
  const withImage = (png: string): RenderedDocument => ({
    ...fixture,
    sections: [{ id: "fixed:3.1.5", number: "3.1.5", heading: "Entity Relationship Diagram", level: 2, status: "accepted", blocks: [{ type: "image", png, caption: "ERD" }] }],
  });
  const meta = { assembled_at_version: 5, spine_version: 5, stale: false };
  let created: string[];
  let revoked: string[];

  beforeEach(() => {
    getDocument.mockReset();
    fetchImage.mockReset();
    created = [];
    revoked = [];
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:mock-${created.length}`;
      created.push(url);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
  });

  it("base64 thật ⇒ hiện thẳng, không gọi tải ảnh", async () => {
    getDocument.mockResolvedValue({ data: withImage("iVBORw0KGgo="), error: null, meta });
    renderWithIntl(<DocumentPane projectId="p1" />);
    const img = await screen.findByAltText("ERD");
    expect(img).toHaveAttribute("src", "data:image/png;base64,iVBORw0KGgo=");
    expect(fetchImage).not.toHaveBeenCalled();
  });

  it("image-ref ⇒ tải Blob đúng token, hiện bằng object URL, thu hồi URL khi gỡ", async () => {
    getDocument.mockResolvedValue({ data: withImage(TOKEN), error: null, meta });
    fetchImage.mockResolvedValue(new Blob([new Uint8Array([1])], { type: "image/png" }));
    const { unmount } = renderWithIntl(<DocumentPane projectId="p1" />);
    expect(await screen.findByAltText("ERD")).toHaveAttribute("src", "blob:mock-0");
    expect(fetchImage).toHaveBeenCalledTimes(1);
    expect(fetchImage).toHaveBeenCalledWith("p1", TOKEN);
    expect(revoked).toEqual([]);
    unmount();
    expect(revoked).toEqual(["blob:mock-0"]);
  });

  it("mount lại cùng token ⇒ mỗi lần một object URL riêng (cache là Blob, không phải URL)", async () => {
    getDocument.mockResolvedValue({ data: withImage(TOKEN), error: null, meta });
    const blob = new Blob([new Uint8Array([1])], { type: "image/png" });
    fetchImage.mockResolvedValue(blob);
    const first = renderWithIntl(<DocumentPane projectId="p1" />);
    await screen.findByAltText("ERD");
    first.unmount();
    renderWithIntl(<DocumentPane projectId="p1" />);
    expect(await screen.findByAltText("ERD")).toHaveAttribute("src", "blob:mock-1");
    expect(created).toEqual(["blob:mock-0", "blob:mock-1"]);
    expect(revoked).toEqual(["blob:mock-0"]);
  });

  it("đang tải ⇒ khung giữ chỗ, chưa có <img>", async () => {
    getDocument.mockResolvedValue({ data: withImage(TOKEN), error: null, meta });
    fetchImage.mockReturnValue(new Promise(() => undefined));
    renderWithIntl(<DocumentPane projectId="p1" />);
    expect(await screen.findByText("Đang tải ảnh…")).toBeInTheDocument();
    expect(screen.queryByAltText("ERD")).toBeNull();
  });

  it("409 IMAGE_CHANGED ⇒ tải lại tài liệu một lượt, không báo lỗi", async () => {
    getDocument.mockResolvedValue({ data: withImage(TOKEN), error: null, meta });
    fetchImage.mockRejectedValue(new ApiClientError(409, "IMAGE_CHANGED", "đã vẽ lại"));
    renderWithIntl(<DocumentPane projectId="p1" />);
    await waitFor(() => expect(getDocument).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/đã vẽ lại/)).toBeNull();
    await waitFor(() => expect(fetchImage).toHaveBeenCalled());
    // BE vẫn lệch sau lượt tải lại: không lặp lại
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(getDocument).toHaveBeenCalledTimes(2);
  });

  it("lỗi khác (404) ⇒ báo lỗi nhỏ tại chỗ ảnh, không tải lại tài liệu", async () => {
    getDocument.mockResolvedValue({ data: withImage(TOKEN), error: null, meta });
    fetchImage.mockRejectedValue(new ApiClientError(404, "IMAGE_NOT_FOUND", "Không tìm thấy ảnh"));
    renderWithIntl(<DocumentPane projectId="p1" />);
    expect(await screen.findByText(/Không tìm thấy ảnh|Không tải được hình sơ đồ/)).toBeInTheDocument();
    expect(getDocument).toHaveBeenCalledTimes(1);
  });
});

describe("DocumentPane — dải Có bản mới", () => {
  const getDocument = vi.mocked(exportApi.getDocument);
  beforeEach(() => {
    getDocument.mockReset();
    getDocument.mockResolvedValue({ data: fixture, error: null, meta: { assembled_at_version: 5, spine_version: 5, stale: false } });
  });

  it("có newerVersion ⇒ dải 'Có bản mới · Cập nhật'; bấm Cập nhật gọi onApply", async () => {
    const onApply = vi.fn();
    renderWithIntl(<DocumentPane projectId="p1" newerVersion={{ onApply }} />);
    await screen.findByText("Vision statement");
    expect(screen.getByText("Có bản mới")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật" }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("không có newerVersion ⇒ không có dải", async () => {
    renderWithIntl(<DocumentPane projectId="p1" />);
    await screen.findByText("Vision statement");
    expect(screen.queryByText("Có bản mới")).toBeNull();
  });
});
