import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { OrgRole } from "@/types/organization";
import type { Flag } from "@/types/spine";
import type { MigrationSummary } from "@/types/template-migration";
import TemplateChangeEntry from "./TemplateChangeEntry";
import { useTemplateChangeAvailability } from "./useTemplateChangeAvailability";

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

/** Gọi hook điều kiện thật (như page) rồi đưa kết quả cho thẻ; hiện thêm lý do chặn để kiểm phần dùng cho menu ⋯ của header. */
function Harness({ flags, role, sectionName }: { flags: Flag[]; role: OrgRole | null; sectionName: (id: string) => string }) {
  const availability = useTemplateChangeAvailability("p1", role);
  return (
    <>
      <output data-testid="reason">{availability.reason ?? ""}</output>
      <output data-testid="open">{availability.migration.open ? "open" : ""}</output>
      <TemplateChangeEntry projectId="p1" availability={availability} flags={flags} sectionName={sectionName} />
    </>
  );
}

const render = (flags: Flag[] = [], role: OrgRole | null = "lead") =>
  renderWithIntl(<Harness flags={flags} role={role} sectionName={(id) => (id === "custom:new" ? "Phạm vi" : id)} />);

beforeEach(() => vi.clearAllMocks());

describe("useTemplateChangeAvailability - lý do chặn mục Đổi mẫu", () => {
  it("đủ điều kiện ⇒ không có lý do; không có việc ⇒ không có thẻ trong panel", async () => {
    setup();
    render();
    await waitFor(() => expect(api.listTemplateMigrations).toHaveBeenCalled());
    await waitFor(() => expect(api.listBaselines).toHaveBeenCalled());
    expect(screen.getByTestId("reason")).toBeEmptyDOMElement();
    expect(screen.queryByRole("region", { name: "Đổi mẫu tài liệu" })).not.toBeInTheDocument();
  });

  it("chặn kèm lý do: chưa baseline, bản nháp chờ Lead, đang áp dụng", async () => {
    setup({ baselines: [] });
    const { unmount } = render();
    await waitFor(() => expect(screen.getByTestId("reason")).toHaveTextContent(/Chưa có baseline/));
    unmount();

    setup({ pending: true });
    const second = render();
    await waitFor(() => expect(screen.getByTestId("reason")).toHaveTextContent(/chờ Lead duyệt/));
    second.unmount();

    setup({ migrations: [summary({ state: "applying" })] });
    render();
    await waitFor(() => expect(screen.getByTestId("reason")).toHaveTextContent(/đang được áp dụng/));
  });

  it("đang có lần đổi mẫu mở ⇒ báo open (menu ghi Tiếp tục đổi mẫu)", async () => {
    setup({ migrations: [summary({ state: "decisions" })] });
    render();
    await waitFor(() => expect(screen.getByTestId("open")).toHaveTextContent("open"));
  });
});

describe("TemplateChangeEntry - thẻ trạng thái", () => {
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

  it("Viewer không thấy thẻ và không gọi BE", async () => {
    setup();
    render([], "viewer");
    expect(screen.queryByRole("region", { name: "Đổi mẫu tài liệu" })).not.toBeInTheDocument();
    expect(api.listBaselines).not.toHaveBeenCalled();
    expect(api.listTemplateMigrations).not.toHaveBeenCalled();
  });

  it("tên mục thiếu lấy theo câu cờ (mẫu có nhiều heading cùng section_id)", async () => {
    setup({ migrations: [summary()] });
    const flag: Flag = { ...redMissing, section_id: "fixed:5.4", message: 'Mục "User Documentation" có trong mẫu mới nhưng tài liệu cũ không có' };
    renderWithIntl(<Harness flags={[flag]} role="lead" sectionName={() => "Other Requirements"} />);
    expect(await screen.findByText("User Documentation")).toBeInTheDocument();
    expect(screen.queryByText("Other Requirements")).not.toBeInTheDocument();
  });
});
