import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { getImport, reuploadDocument } from "@/lib/api/import";
import SrsAttachmentChip from "./srs-attachment-chip";
import StructureChangeNotice from "./structure-change-notice";
import ReuploadDiffView from "./ReuploadDiffView";
import { setPendingReupload, takePendingReupload } from "./pending-reupload";

vi.mock("@/lib/api/import", () => ({ getImport: vi.fn(), reuploadDocument: vi.fn() }));

const file = new File(["PK"], "SRS v2.docx");

describe("SrsAttachmentChip - file đính kèm trông như SRS (business-flow §3.6)", () => {
  it("có dấu version của dự án ⇒ chọn sẵn Cập nhật phiên bản mới", () => {
    const onUpdate = vi.fn();
    renderWithIntl(<SrsAttachmentChip suggestion={{ key: "k", file, fromThisProject: true }} onUpdateVersion={onUpdate} onKeepAsReference={() => {}} />);
    expect(screen.getByText(/Đây là phiên bản mới của tài liệu\?/)).toBeInTheDocument();
    expect(screen.getByText(/tải về từ chính dự án/)).toBeInTheDocument();
    const update = screen.getByRole("button", { name: "Cập nhật phiên bản mới" });
    expect(update.className).toMatch(/bg-primary/);
    fireEvent.click(update);
    expect(onUpdate).toHaveBeenCalled();
  });

  it("không có dấu version ⇒ chọn sẵn Dùng làm tham khảo", () => {
    const onKeep = vi.fn();
    renderWithIntl(<SrsAttachmentChip suggestion={{ key: "k", file, fromThisProject: false }} onUpdateVersion={() => {}} onKeepAsReference={onKeep} />);
    const keep = screen.getByRole("button", { name: "Dùng làm tham khảo" });
    expect(keep.className).toMatch(/bg-primary/);
    fireEvent.click(keep);
    expect(onKeep).toHaveBeenCalled();
  });
});

describe("Chuyển file sang báo cáo khác biệt - không bắt chọn lại", () => {
  it("lấy một lần; ReuploadDiffView so luôn file vừa chuyển", async () => {
    vi.mocked(reuploadDocument).mockResolvedValue({ data: { id: "r1", original_name: "SRS v2.docx", against_version: "0.1", created_at: "2026-11-08T00:00:00.000Z", summary: { added: 1, removed: 0, modified: 0, moved: 0 }, blocks: [] }, error: null } as never);
    setPendingReupload(file);
    renderWithIntl(<ReuploadDiffView projectId="p1" />);
    await vi.waitFor(() => expect(reuploadDocument).toHaveBeenCalledWith("p1", file));
    expect(takePendingReupload()).toBeNull();
  });
});

describe("StructureChangeNotice - kết quả đọc cuối lệch màn đọc khung", () => {
  beforeEach(() => localStorage.clear());

  it("báo một lần, đóng thì nhớ theo dự án", async () => {
    vi.mocked(getImport).mockResolvedValue({
      data: { import: { structure_changes: [{ section_id: "fixed:3.4", title: "3.4 Security", from: "present", to: "missing" }] } },
      error: null,
    } as never);
    const { unmount } = renderWithIntl(<StructureChangeNotice projectId="p1" />);
    expect(await screen.findByText(/mục 3\.4 Security thực ra còn trống/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(screen.queryByText(/3\.4 Security/)).not.toBeInTheDocument();
    unmount();
    vi.mocked(getImport).mockClear();
    renderWithIntl(<StructureChangeNotice projectId="p1" />);
    expect(getImport).not.toHaveBeenCalled();
  });

  it("khớp (rỗng) hoặc không đọc được ⇒ không hiện gì", async () => {
    vi.mocked(getImport).mockRejectedValue(new Error("409"));
    const { container } = renderWithIntl(<StructureChangeNotice projectId="p2" />);
    await vi.waitFor(() => expect(getImport).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
