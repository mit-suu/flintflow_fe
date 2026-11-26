import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api/client";
import { renderWithIntl } from "@/test/intl";
import type { Flag } from "@/types/spine";
import type { Migration } from "@/types/template-migration";
import { migrationFixture } from "./migration-fixture.test-helper";
import TemplateMigrationScreen from "./TemplateMigrationScreen";

const api = vi.hoisted(() => ({
  patchMigrationMapping: vi.fn(),
  restoreTemplateMigration: vi.fn(),
  listTemplateMigrations: vi.fn(),
  getTemplateMigration: vi.fn(),
  startTemplateMigration: vi.fn(),
  patchMigrationPairs: vi.fn(),
  confirmMigrationMapping: vi.fn(),
  patchMigrationDecisions: vi.fn(),
  markMigrationReady: vi.fn(),
  cancelTemplateMigration: vi.fn(),
  applyTemplateMigration: vi.fn(),
  revertTemplateMigration: vi.fn(),
}));
vi.mock("@/lib/api/template-migration", () => api);
vi.mock("@/lib/api/token-store", async (importOriginal) => ({ ...(await importOriginal<object>()), getActiveOrgId: () => "o1" }));
vi.mock("@/lib/api/org-library", () => ({ listOrgTemplates: vi.fn(async () => []) }));

const summaryOf = (m: Migration) => ({ id: m.id, state: m.state, direction: m.direction, revertable: m.revertable, revert_blocked_reason: m.revert_blocked_reason, previous_template: m.previous_template, previous_standard: m.previous_standard, to: { template_id: m.to.template_id, standard: m.to.standard, version: m.to.version, name: m.to.name }, created_at: m.created_at, applied_at: m.applied_at });

/** Một lần đổi mẫu đang mở; BE là nguồn sự thật nên mỗi thao tác trả lại bản đầy đủ. */
const open = (m: Migration) => {
  api.listTemplateMigrations.mockResolvedValue([summaryOf(m)]);
  api.getTemplateMigration.mockResolvedValue(m);
};

const flags: Flag[] = [
  { id: "F1", level: "red", rule_id: "template_section_migration_missing", section_id: "custom:new", message: "Mục thiếu", remediation_step: "", opened_at_version: 1, resolved_at: null, waived_by_user: false, waive_reason: null, waived_at_version: null },
];

beforeEach(() => vi.clearAllMocks());

describe("TemplateMigrationScreen", () => {
  it("xem lại thay đổi → áp dụng (chốt ready rồi áp dụng) → báo mục thiếu + hoàn tác", async () => {
    const decisions = migrationFixture();
    const decided = migrationFixture({ decisions: [{ id: "e:o1", choice: "keep_custom" }], undecided: [] });
    const ready = migrationFixture({ state: "ready", decisions: decided.decisions, undecided: [] });
    const applied = migrationFixture({ state: "applied", applied_at: "2026-11-11T02:00:00.000Z", decisions: decided.decisions, undecided: [] });
    open(decisions);
    api.patchMigrationDecisions.mockResolvedValue(decided);
    api.markMigrationReady.mockResolvedValue(ready);
    api.applyTemplateMigration.mockResolvedValue(applied);
    const onChanged = vi.fn();

    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={flags} sectionName={(id) => id} orgRole="lead" onChanged={onChanged} />);
    fireEvent.change(await screen.findByLabelText(/Ghi chú triển khai/), { target: { value: "keep_custom" } });
    await waitFor(() => expect(api.patchMigrationDecisions).toHaveBeenCalledWith("p1", "m1", { decisions: [{ id: "e:o1", choice: "keep_custom" }] }));
    fireEvent.click(await screen.findByRole("button", { name: "Tiếp tục" }));
    fireEvent.click(await screen.findByRole("button", { name: "Áp dụng mẫu mới" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(api.markMigrationReady).toHaveBeenCalledWith("p1", "m1");
    expect(api.applyTemplateMigration).toHaveBeenCalledWith("p1", "m1");
    expect(await screen.findByText(/Đã chuyển tài liệu sang mẫu Mẫu ngân hàng/)).toBeInTheDocument();
    expect(screen.getByText("1 mục của mẫu mới chưa có nội dung")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hoàn tác lần đổi mẫu" })).toBeInTheDocument();
  });

  it("sau khi áp dụng báo mục chưa dịch được; BE cũ không trả thì không hiện", async () => {
    const applied = migrationFixture({ state: "applied", applied_at: "2026-11-11T02:00:00.000Z", undecided: [], translation_summary: { translated: 40, untranslated: 2, sections: [{ section_id: "s1", title: "Phạm vi" }] } });
    open(applied);
    const { unmount } = renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={flags} sectionName={(id) => id} orgRole="lead" />);
    expect(await screen.findByText(/2 đoạn chưa dịch được.*Phạm vi/)).toBeInTheDocument();
    unmount();
    open(migrationFixture({ state: "applied", applied_at: "2026-11-11T02:00:00.000Z", undecided: [] }));
    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={flags} sectionName={(id) => id} orgRole="lead" />);
    expect(await screen.findByRole("button", { name: "Hoàn tác lần đổi mẫu" })).toBeInTheDocument();
    expect(screen.queryByText(/chưa dịch được/)).not.toBeInTheDocument();
  });

  it("thẻ mục thiếu sau khi áp dụng hiện tên heading của mẫu mới, không phải mã mục thô", async () => {
    const applied = migrationFixture({ state: "applied", applied_at: "2026-11-11T02:00:00.000Z", undecided: [] });
    open(applied);
    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={flags} sectionName={(id) => id} orgRole="lead" />);
    expect(await screen.findByText("Phạm vi")).toBeInTheDocument();
    expect(screen.queryByText("custom:new")).not.toBeInTheDocument();
    const href = screen.getByRole("link", { name: "Viết" }).getAttribute("href") ?? "";
    expect(new URL(href, "http://localhost").searchParams.get("ref")).toBe("custom:new");
  });

  it("mục thiếu lấy từ cờ đỏ còn mở: đã viết xong (hết cờ) thì không hiện", async () => {
    const applied = migrationFixture({ state: "applied", applied_at: "2026-11-11T02:00:00.000Z", undecided: [] });
    open(applied);
    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={[]} sectionName={(id) => id} orgRole="lead" />);
    expect(await screen.findByText(/Đã chuyển tài liệu sang mẫu/)).toBeInTheDocument();
    expect(screen.queryByText(/chưa có nội dung/)).not.toBeInTheDocument();
  });

  it("có đích điền sẵn từ thông báo ⇒ vào bước chọn mẫu dù đã có lần áp dụng trước", async () => {
    open(migrationFixture({ state: "applied", applied_at: "2026-11-11T02:00:00.000Z", undecided: [] }));
    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={[]} sectionName={(id) => id} orgRole="lead" preselect={{ templateId: "t1", version: 3 }} />);
    expect(await screen.findByLabelText("File mẫu (.docx)")).toBeInTheDocument();
    expect(screen.queryByText(/Đã chuyển tài liệu sang mẫu/)).not.toBeInTheDocument();
  });

  it("409 INVALID_STATE (người khác đã đổi bước) ⇒ đọc lại lần đổi mẫu", async () => {
    const ready = migrationFixture({ state: "ready", undecided: [] });
    open(ready);
    api.applyTemplateMigration.mockRejectedValue(new ApiClientError(409, "TEMPLATE_MIGRATION_INVALID_STATE", "x"));
    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={[]} sectionName={(id) => id} orgRole="lead" />);
    fireEvent.click(await screen.findByRole("button", { name: "Áp dụng mẫu mới" }));
    await waitFor(() => expect(api.listTemplateMigrations.mock.calls.length).toBeGreaterThan(1));
  });

  it("409 dữ liệu đổi giữa chừng ⇒ quay về bước xem lại kèm thông báo", async () => {
    const ready = migrationFixture({ state: "ready", undecided: [], decisions: [{ id: "e:o1", choice: "delete" }] });
    const back = migrationFixture({ state: "decisions", undecided: [], decisions: [{ id: "e:o1", choice: "delete" }] });
    open(ready);
    api.applyTemplateMigration.mockRejectedValue(new ApiClientError(409, "TEMPLATE_MIGRATION_STALE", "stale"));
    api.getTemplateMigration.mockResolvedValueOnce(ready).mockResolvedValue(back);
    api.listTemplateMigrations.mockResolvedValueOnce([summaryOf(ready)]).mockResolvedValue([summaryOf(back)]);

    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={flags} sectionName={(id) => id} orgRole="analyst" />);
    fireEvent.click(await screen.findByRole("button", { name: "Áp dụng mẫu mới" }));
    expect(await screen.findByText(/Dữ liệu tài liệu vừa thay đổi/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Tiếp tục" })).toBeInTheDocument();
  });

  it("liên kết gãy (đổi ngược) hiện danh sách ngay ở bước áp dụng", async () => {
    open(migrationFixture({ state: "ready", direction: "reverse", undecided: [] }));
    api.applyTemplateMigration.mockRejectedValue(new ApiClientError(409, "TEMPLATE_MIGRATION_LINKS_BROKEN", "broken", { violations: ["UC-03 trỏ tới mục đã bị bỏ"] }));

    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={flags} sectionName={(id) => id} orgRole="lead" />);
    fireEvent.click(await screen.findByRole("button", { name: "Áp dụng mẫu mới" }));
    expect(await screen.findByText("UC-03 trỏ tới mục đã bị bỏ")).toBeInTheDocument();
  });

  it("chưa có lần đổi mẫu mở ⇒ chọn mẫu đích và bắt đầu từ file", async () => {
    api.listTemplateMigrations.mockResolvedValue([]);
    api.startTemplateMigration.mockResolvedValue(migrationFixture({ state: "mapping_review" }));
    const file = new File(["x"], "mau.docx");

    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={flags} sectionName={(id) => id} orgRole="analyst" />);
    fireEvent.change(await screen.findByLabelText("File mẫu (.docx)"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Dùng file này" }));
    await waitFor(() => expect(api.startTemplateMigration).toHaveBeenCalledWith("p1", { kind: "file", file }));
    expect(await screen.findByRole("button", { name: "Tiếp tục" })).toBeInTheDocument();
    expect(screen.getByText(/2. Xem lại thay đổi/)).toHaveAttribute("aria-current", "step");
  });

  it("nhóm Thừa không còn lựa chọn Xoá dù BE cũ vẫn gửi; Quay về mẫu trước (previous_standard) bắt đầu bằng mẫu chuẩn", async () => {
    const base = migrationFixture();
    const legacy = { ...base, groups: { ...base.groups, extra: base.groups.extra.map((e) => ({ ...e, choices: ["keep_custom", "drop_from_print", "delete", "move_to:n1"] })) } };
    open(legacy);
    const { unmount } = renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={flags} sectionName={(id) => id} orgRole="lead" />);
    const select = await screen.findByLabelText(/Ghi chú triển khai/);
    const values = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(["keep_custom", "drop_from_print"]));
    expect(values).not.toContain("delete");
    unmount();

    const applied = migrationFixture({ state: "applied", applied_at: "2026-11-11T02:00:00.000Z", previous_standard: true, to: { ...base.to, template_id: null, standard: true, name: "Mẫu chuẩn FlintFlow" } });
    api.listTemplateMigrations.mockResolvedValue([summaryOf(applied)]);
    api.getTemplateMigration.mockResolvedValue(applied);
    api.startTemplateMigration.mockResolvedValue(migrationFixture());
    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={[]} sectionName={(id) => id} orgRole="lead" />);
    fireEvent.click(await screen.findByRole("button", { name: "Đổi sang mẫu khác" }));
    fireEvent.click(await screen.findByRole("button", { name: "Quay về mẫu trước" }));
    await waitFor(() => expect(api.startTemplateMigration).toHaveBeenCalledWith("p1", { kind: "standard" }));
  });

  it("apply_failed ⇒ Khôi phục rồi quay lại chọn mẫu", async () => {
    const failed = migrationFixture({ state: "apply_failed" });
    open(failed);
    api.restoreTemplateMigration.mockResolvedValue({ ...failed, state: "failed" });
    const onChanged = vi.fn();
    renderWithIntl(<TemplateMigrationScreen projectId="p1" orgId="o1" flags={flags} sectionName={(id) => id} orgRole="lead" onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Khôi phục" }));
    await waitFor(() => expect(api.restoreTemplateMigration).toHaveBeenCalledWith("p1", "m1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(await screen.findByLabelText("File mẫu (.docx)")).toBeInTheDocument();
  });
});
