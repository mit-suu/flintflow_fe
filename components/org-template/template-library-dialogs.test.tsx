import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import * as api from "@/lib/api/org-library";
import type { OrgTemplateSummary, TemplateVersionDetail } from "@/types/org-library";
import { MappingReviewDialog, TemplateVersionsDialog } from "./template-library-dialogs";

vi.mock("@/lib/api/org-library", () => ({
  deleteTemplateVersion: vi.fn(),
  getTemplateVersion: vi.fn(),
  publishTemplateVersion: vi.fn(),
  uploadOrgTemplate: vi.fn(),
}));

const summary = (over: Partial<OrgTemplateSummary> = {}): OrgTemplateSummary => ({
  id: "t1",
  name: "Mẫu ngân hàng",
  source_file_name: "bank.docx",
  heading_count: 10,
  custom_count: 1,
  template_family: null,
  uses: 0,
  created_at: "2026-11-01T00:00:00.000Z",
  latest_version: 1,
  project_count: 1,
  pending_count: 0,
  skeleton: false,
  skeleton_source_project_id: null,
  versions: [
    { version: 2, status: "draft", source_file_name: "bank-v2.docx", heading_count: 11, custom_count: 1, language: "en", template_family: null, project_count: 0, pending_count: 0, created_at: "2026-11-09T00:00:00.000Z" },
    {
      version: 1,
      status: "published",
      source_file_name: "bank.docx",
      heading_count: 10,
      custom_count: 1,
      language: "en",
      template_family: null,
      project_count: 1,
      pending_count: 0,
      created_at: "2026-11-01T00:00:00.000Z",
      published_by: { id: "u1", name: "Lan" },
    },
  ],
  ...over,
});

const draft: TemplateVersionDetail = {
  template_id: "t1",
  name: "Mẫu ngân hàng",
  version: 2,
  status: "draft",
  source_file_name: "bank-v2.docx",
  heading_count: 1,
  custom_count: 0,
  language: "en",
  template_family: null,
  project_count: 0,
  pending_count: 0,
  created_at: "2026-11-09T00:00:00.000Z",
  headings: [{ index: 0, heading_text: "Actors list", section_id: "unmapped", auto_confirmed: true }],
};

beforeEach(() => vi.clearAllMocks());

describe("Hộp thoại thư viện mẫu (FLF-395)", () => {
  it("Lead: bản nháp có nút rà mapping, trả chi tiết bản cho trang", async () => {
    vi.mocked(api.getTemplateVersion).mockResolvedValue(draft);
    const onReview = vi.fn();
    renderWithIntl(<TemplateVersionsDialog orgId="o1" template={summary()} isLead onClose={vi.fn()} onReview={onReview} onChanged={vi.fn()} />);
    expect(screen.getByText(/đăng bởi Lan/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rà mapping và đăng" }));
    await waitFor(() => expect(onReview).toHaveBeenCalledWith(draft));
    expect(api.getTemplateVersion).toHaveBeenCalledWith("o1", "t1", 2);
  });

  it("xoá bản hiện số dự án; bị chặn thì hiện lý do của BE", async () => {
    vi.mocked(api.deleteTemplateVersion).mockRejectedValue(new Error("Đang có lần đổi mẫu mở, chưa xoá được."));
    renderWithIntl(<TemplateVersionsDialog orgId="o1" template={summary()} isLead onClose={vi.fn()} onReview={vi.fn()} onChanged={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Xoá bản" })[1]);
    expect(screen.getByText(/Đang có 1 dự án theo bản này/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xoá" }));
    await waitFor(() => expect(screen.getByText("Đang có lần đổi mẫu mở, chưa xoá được.")).toBeInTheDocument());
    expect(api.deleteTemplateVersion).toHaveBeenCalledWith("o1", "t1", 1);
  });

  it("không phải Lead: chỉ xem các bản", () => {
    renderWithIntl(<TemplateVersionsDialog orgId="o1" template={summary()} isLead={false} onClose={vi.fn()} onReview={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByText("Bản 1")).toBeInTheDocument();
    for (const name of ["Xoá bản", "Rà mapping và đăng"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("rà mapping rồi đăng, chỉ gửi heading đã đổi", async () => {
    vi.mocked(api.publishTemplateVersion).mockResolvedValue({ ...draft, status: "published" });
    const onPublished = vi.fn();
    renderWithIntl(<MappingReviewDialog orgId="o1" detail={draft} onClose={vi.fn()} onPublished={onPublished} />);
    expect((await screen.findAllByText("Cần xem")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Actors list"), { target: { value: "fixed:2.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng bản này" }));
    await waitFor(() => expect(api.publishTemplateVersion).toHaveBeenCalledWith("o1", "t1", 2, [{ index: 0, section_id: "fixed:2.1" }]));
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
  });
});
