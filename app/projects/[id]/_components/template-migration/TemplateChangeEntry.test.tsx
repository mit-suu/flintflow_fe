import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { Flag } from "@/types/spine";
import type { MigrationSummary } from "@/types/template-migration";
import TemplateChangeEntry from "./TemplateChangeEntry";

const api = vi.hoisted(() => ({
  listTemplateMigrations: vi.fn(),
  listBaselines: vi.fn(),
  getReviewPackage: vi.fn(),
  revertTemplateMigration: vi.fn(),
}));
vi.mock("@/lib/api/template-migration", () => ({
  listTemplateMigrations: api.listTemplateMigrations,
  getTemplateMigration: vi.fn(),
  revertTemplateMigration: api.revertTemplateMigration,
}));
vi.mock("@/lib/api/export", () => ({ listBaselines: api.listBaselines }));
vi.mock("@/lib/api/versions", () => ({ getReviewPackage: api.getReviewPackage }));

const summary = (over: Partial<MigrationSummary> = {}): MigrationSummary => ({
  id: "m1",
  state: "applied",
  direction: "forward",
  revertable: true,
  revert_blocked_reason: null,
  previous_template: null,
  to: { template_id: "t1", version: 2, name: "Mẫu ngân hàng" },
  created_at: "2026-11-11T00:00:00.000Z",
  applied_at: "2026-11-11T01:00:00.000Z",
  ...over,
});

const redMissing: Flag = {
  id: "F1",
  level: "red",
  rule_id: "template_section_migration_missing",
  section_id: "custom:new",
  message: "Mục Phạm vi có trong mẫu mới",
  remediation_step: "",
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
};

const setup = (over: { baselines?: unknown[]; pending?: boolean; migrations?: MigrationSummary[] } = {}) => {
  api.listBaselines.mockResolvedValue({ data: over.baselines ?? [{ id: "b1" }] });
  api.getReviewPackage.mockResolvedValue({ data: { status: over.pending ? "pending" : "drafting" } });
  api.listTemplateMigrations.mockResolvedValue(over.migrations ?? []);
};

const render = (flags: Flag[] = [], role: "lead" | "analyst" | "viewer" | null = "lead") =>
  renderWithIntl(<TemplateChangeEntry projectId="p1" orgRole={role} flags={flags} sectionName={(id) => (id === "custom:new" ? "Phạm vi" : id)} />);

beforeEach(() => vi.clearAllMocks());

describe("TemplateChangeEntry", () => {
  it("mở màn đổi mẫu khi đủ điều kiện", async () => {
    setup();
    render();
    const link = await screen.findByRole("link", { name: "Đổi mẫu" });
    expect(link.getAttribute("href")).toBe("/projects/p1?panel=template");
  });

  it("disable kèm lý do: chưa baseline, bản nháp chờ Lead, đang áp dụng", async () => {
    setup({ baselines: [] });
    const { unmount } = render();
    expect(await screen.findByText(/Chưa có baseline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đổi mẫu" })).toBeDisabled();
    unmount();

    setup({ pending: true });
    const second = render();
    expect(await screen.findByText(/chờ Lead duyệt/)).toBeInTheDocument();
    second.unmount();

    setup({ migrations: [summary({ state: "applying" })] });
    render();
    expect(await screen.findByText(/đang được áp dụng/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục đổi mẫu" })).toBeDisabled();
  });

  it("đang có lần đổi mẫu mở ⇒ Tiếp tục đổi mẫu", async () => {
    setup({ migrations: [summary({ state: "decisions" })] });
    render();
    expect(await screen.findByRole("link", { name: "Tiếp tục đổi mẫu" })).toBeInTheDocument();
  });

  it("sau áp dụng: nút hoàn tác và thẻ mục thiếu từ cờ đỏ", async () => {
    setup({ migrations: [summary()] });
    render([redMissing]);
    expect(await screen.findByRole("button", { name: "Hoàn tác lần đổi mẫu" })).toBeInTheDocument();
    expect(screen.getByText("1 mục của mẫu mới chưa có nội dung")).toBeInTheDocument();
    expect(screen.getByText("Phạm vi")).toBeInTheDocument();
  });

  it("BE báo không hoàn tác được ⇒ lời giải thích thay cho nút", async () => {
    setup({ migrations: [summary({ revertable: false, revert_blocked_reason: "has_later_changes" })] });
    render();
    expect(await screen.findByText(/Dùng Đổi mẫu để quay về mẫu trước/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hoàn tác lần đổi mẫu" })).not.toBeInTheDocument();
  });

  it("áp dụng kẹt (apply_failed) ⇒ nút Khôi phục", async () => {
    setup({ migrations: [summary({ state: "apply_failed", revertable: null })] });
    render();
    expect(await screen.findByRole("button", { name: "Khôi phục" })).toBeInTheDocument();
  });

  it("Viewer không thấy lối đổi mẫu", async () => {
    setup();
    const { container } = render([], "viewer");
    expect(container).toBeEmptyDOMElement();
    // Vai trò không đổi mẫu được ⇒ không gọi BE
    expect(api.listBaselines).not.toHaveBeenCalled();
    expect(api.listTemplateMigrations).not.toHaveBeenCalled();
  });

  it("ghi mẫu đang theo; tên mục thiếu lấy theo câu cờ (mẫu có nhiều heading cùng section_id)", async () => {
    setup({ migrations: [summary()] });
    const flag: Flag = { ...redMissing, section_id: "fixed:5.4", message: 'Mục "User Documentation" có trong mẫu mới nhưng tài liệu cũ không có — chưa chốt bản được tới khi viết nội dung' };
    renderWithIntl(
      <TemplateChangeEntry projectId="p1" orgRole="lead" flags={[flag]} sectionName={() => "Other Requirements"} current={{ template_id: "t1", version: 2, name: "Mẫu IEEE", kind: "org" }} />
    );
    expect(await screen.findByText("Đang theo: Mẫu IEEE · bản 2")).toBeInTheDocument();
    expect(screen.getByText("User Documentation")).toBeInTheDocument();
    expect(screen.queryByText("Other Requirements")).not.toBeInTheDocument();
  });

  it("dự án theo file mẫu của chính nó ⇒ ghi rõ, không để trống", async () => {
    setup();
    renderWithIntl(<TemplateChangeEntry projectId="p1" orgRole="lead" flags={[]} sectionName={(id) => id} current={null} />);
    expect(await screen.findByText("Đang theo file mẫu của chính dự án (chưa gắn mẫu tổ chức).")).toBeInTheDocument();
  });
});
