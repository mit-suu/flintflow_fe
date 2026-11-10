import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import * as api from "@/lib/api/org-library";
import type { OrgTemplateSummary, TemplateVersionDetail } from "@/types/org-library";
import TemplateLibraryList from "./template-library-list";

vi.mock("@/lib/api/org-library", () => ({
  deleteOrgTemplate: vi.fn(),
  deleteTemplateVersion: vi.fn(),
  getTemplateVersion: vi.fn(),
  publishTemplateVersion: vi.fn(),
  uploadOrgTemplate: vi.fn(),
  uploadTemplateVersion: vi.fn(),
  getSkeletonPending: vi.fn(async () => ({ template_id: "t1", name: "Khung", version: 1, pending_count: 1, headings: [], suggest_credit_cost: 1 })),
  decideSkeletonPending: vi.fn(),
  suggestSkeletonNames: vi.fn(),
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
  versions: [
    { version: 2, status: "draft", source_file_name: "bank-v2.docx", heading_count: 11, custom_count: 1, language: "en", template_family: null, project_count: 0, pending_count: 0, created_at: "2026-11-09T00:00:00.000Z" },
    { version: 1, status: "published", source_file_name: "bank.docx", heading_count: 10, custom_count: 1, language: "en", template_family: null, project_count: 1, pending_count: 0, created_at: "2026-11-01T00:00:00.000Z" },
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

describe("TemplateLibraryList — bản của mẫu, đăng bản mới, xoá", () => {
  it("Lead: rà mapping bản nháp rồi đăng, chỉ gửi heading đã đổi", async () => {
    vi.mocked(api.getTemplateVersion).mockResolvedValue(draft);
    vi.mocked(api.publishTemplateVersion).mockResolvedValue({ ...draft, status: "published" });
    const onChanged = vi.fn(async () => {});
    renderWithIntl(<TemplateLibraryList orgId="o1" role="lead" templates={[summary()]} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Rà mapping và đăng" }));
    expect((await screen.findAllByText("Cần xem")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Actors list"), { target: { value: "fixed:2.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng bản này" }));
    await waitFor(() => expect(api.publishTemplateVersion).toHaveBeenCalledWith("o1", "t1", 2, [{ index: 0, section_id: "fixed:2.1" }]));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("xoá bản hiện số dự án; bị chặn thì hiện lý do của BE", async () => {
    vi.mocked(api.deleteTemplateVersion).mockRejectedValue(new Error("Đang có lần đổi mẫu mở, chưa xoá được."));
    renderWithIntl(<TemplateLibraryList orgId="o1" role="lead" templates={[summary()]} onChanged={async () => {}} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Xoá bản" })[1]);
    expect(screen.getByText(/Đang có 1 dự án theo bản này/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận xoá" }));
    await waitFor(() => expect(screen.getByText("Đang có lần đổi mẫu mở, chưa xoá được.")).toBeInTheDocument());
  });

  it("Analyst: xem bản, không có nút đăng / xoá / tải", () => {
    renderWithIntl(<TemplateLibraryList orgId="o1" role="analyst" templates={[summary({ versions: [summary().versions[1]] })]} onChanged={async () => {}} />);
    expect(screen.getByText("Bản 1")).toBeInTheDocument();
    for (const name of ["Đăng bản mới", "Xoá mẫu", "Xoá bản", "Tải mẫu mới", "Rà mapping và đăng"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("hiện người đăng của từng bản và mở duyệt mục chờ qua dự án nguồn của khung", async () => {
    const base = summary();
    const tpl = summary({ skeleton: true, pending_count: 1, skeleton_source_project_id: "p9", versions: [{ ...base.versions[1], published_by: { id: "u1", name: "Lan" } }] });
    renderWithIntl(<TemplateLibraryList orgId="o1" role="analyst" templates={[tpl]} onChanged={async () => {}} />);
    expect(screen.getByText(/đăng bởi Lan/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Duyệt mục chờ" }));
    await waitFor(() => expect(api.getSkeletonPending).toHaveBeenCalledWith("p9"));
  });
});
