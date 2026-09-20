import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "@/lib/api/client";
import { mockServer } from "@/mocks/server";
import type { StepPlanEntry } from "@/types/import";
import type { StepSummary } from "@/types/pipeline";
import type { Flag } from "@/types/spine";
import Mode1PlanPanel from "./Mode1PlanPanel";

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const P = "p1";

const step = (id: string, status: StepSummary["status"]): StepSummary => ({
  id,
  phase: id.split(".")[0],
  label_vi: id,
  label_en: id,
  kind: "fixed",
  status,
  deterministic: false,
  calls_used: 0,
  calls_limit: 8,
  regenerate_used: 0,
  regenerate_limit: 3,
  accepted_at: null,
  running: false,
});

const PLAN: StepPlanEntry[] = [
  { step_id: "S-2.1", state: "applied", missing: false, section_ids: ["fixed:1"], reason: "Có trong file, đã có nội dung" },
  { step_id: "S-7.1", state: "applied", missing: true, section_ids: ["fixed:5.1"], reason: "Đầu mục mẫu FPT — file không có" },
  { step_id: "S-4.2", state: "applied", missing: true, section_ids: ["fixed:3.1.1"], reason: "Đầu mục mẫu FPT — file không có" },
  { step_id: "B-0.1", state: "hidden", missing: false, section_ids: [], reason: "Không sinh đầu mục" },
  { step_id: "S-1.1", state: "enabled", missing: false, section_ids: [], reason: "Người dùng bật thêm" },
];
const STEPS = [step("S-2.1", "accepted"), step("S-4.2", "accepted"), step("S-7.1", "pending"), step("S-1.1", "pending")];

const redFlag = (id: string, rule_id = "section_empty"): Flag => ({
  id,
  level: "red",
  rule_id,
  section_id: "fixed:5.1",
  target_id: null,
  message: "Business Rules trống",
  remediation_step: "S-7.1",
  opened_at_version: 1,
  resolved_at: null,
  waived_by_user: false,
  waive_reason: null,
  waived_at_version: null,
});

const renderPanel = (over: Partial<Parameters<typeof Mode1PlanPanel>[0]> = {}) => {
  const props = {
    projectId: P,
    plan: PLAN,
    steps: STEPS,
    flags: [redFlag("FL01")],
    signedOff: false,
    busyStep: null,
    onToggleStep: vi.fn(),
    onSelectStep: vi.fn(),
    getBaseVersion: () => 7,
    onSignedOff: vi.fn(),
    ...over,
  };
  render(<Mode1PlanPanel {...props} />);
  return props;
};

describe("Mode1PlanPanel — kế hoạch step theo template (FLF-185)", () => {
  it("đầu mục FPT thiếu mà step chưa chốt ⇒ nhãn Thiếu + mở step; step đã chốt không còn trong danh sách", () => {
    const props = renderPanel();
    const missing = screen.getByRole("region", { name: "Đầu mục FPT còn thiếu" });
    expect(within(missing).getAllByText("Thiếu")).toHaveLength(1);
    expect(within(missing).getByText(/S-7\.1/)).toBeInTheDocument();
    expect(within(missing).queryByText(/S-4\.2/)).not.toBeInTheDocument();
    fireEvent.click(within(missing).getByRole("button", { name: "Mở step" }));
    expect(props.onSelectStep).toHaveBeenCalledWith("S-7.1");
  });

  it("step ẩn ⇒ Bật; step đã bật thêm ⇒ Tắt; sau v1 không bật/tắt được", () => {
    const props = renderPanel();
    const hidden = screen.getByRole("region", { name: "Step ẩn" });
    const rowOf = (id: string) => within(hidden).getByText(new RegExp(`^${id.replace(".", "\\.")} `)).closest("li") as HTMLElement;
    fireEvent.click(within(rowOf("B-0.1")).getByRole("button", { name: "Bật" }));
    expect(props.onToggleStep).toHaveBeenCalledWith("B-0.1", true);
    fireEvent.click(within(rowOf("S-1.1")).getByRole("button", { name: "Tắt" }));
    expect(props.onToggleStep).toHaveBeenCalledWith("S-1.1", false);
  });

  it("còn cờ đỏ ⇒ nút ký v1 khoá kèm lý do (đếm cả đầu mục FPT thiếu); đã ký ⇒ khoá, báo sửa qua CR", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Ký baseline v1" })).toBeDisabled();
    expect(screen.getByText(/Còn 1 cờ đỏ, trong đó 1 đầu mục FPT thiếu/)).toBeInTheDocument();
  });

  it("liệt kê từng cờ đỏ đang chặn kèm nút chạy step (trước đây chỉ nói số, không xem được là cờ nào)", () => {
    const props = renderPanel({ flags: [redFlag("FL01"), redFlag("FL02", "render_error")] });
    const panel = screen.getByRole("region", { name: "Cờ đỏ đang chặn" });
    expect(within(panel).getByRole("heading", { name: "Cờ đỏ đang chặn ký v1 (2)" })).toBeInTheDocument();
    expect(within(panel).getAllByText("Business Rules trống")).toHaveLength(2);
    // `render_error` xuất hiện cả ở dòng cờ lẫn câu chú thích "phải sửa thật" ⇒ lấy dòng cờ
    expect(within(panel).getAllByText("render_error")[0]).toBeInTheDocument();
    expect(within(panel).getByText(/Cờ vàng không chặn ký/)).toBeInTheDocument();

    fireEvent.click(within(panel).getAllByRole("button", { name: "Chạy S-7.1" })[0]);
    expect(props.onSelectStep).toHaveBeenCalledWith("S-7.1");
  });

  it("hết cờ đỏ ⇒ bảng cờ nói rõ không còn gì chặn", () => {
    renderPanel({ flags: [] });
    expect(within(screen.getByRole("region", { name: "Cờ đỏ đang chặn" })).getByText("Không còn cờ đỏ nào.")).toBeInTheDocument();
  });

  it("đã ký v1 ⇒ khoá ký lại và khoá bật/tắt step", () => {
    renderPanel({ signedOff: true, flags: [] });
    expect(screen.getByRole("button", { name: "Ký baseline v1" })).toBeDisabled();
    expect(screen.getByText(/Đã ký baseline v1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bật" })).toBeDisabled();
  });

  it("hết cờ đỏ ⇒ ký gửi base_version; thành công ⇒ onSignedOff", async () => {
    const bodies: unknown[] = [];
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/baseline`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { id: "BL002", version: "v1.0", type: "generated" }, error: null });
      })
    );
    const props = renderPanel({ flags: [] });
    fireEvent.click(screen.getByRole("button", { name: "Ký baseline v1" }));
    await waitFor(() => expect(props.onSignedOff).toHaveBeenCalled());
    expect(bodies).toEqual([{ base_version: 7 }]);
  });

  it("BE chặn (BASELINE_BLOCKED) ⇒ báo lỗi kèm danh sách cờ", async () => {
    mockServer.use(
      http.post(`${API_BASE_URL}/projects/:projectId/baseline`, () =>
        HttpResponse.json(
          { data: null, meta: { flags: [redFlag("FL09")] }, error: { code: "BASELINE_BLOCKED", message: "Còn cờ đỏ" } },
          { status: 422 }
        )
      )
    );
    const props = renderPanel({ flags: [] });
    fireEvent.click(screen.getByRole("button", { name: "Ký baseline v1" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("chưa ký baseline v1 được");
    expect(alert).toHaveTextContent("Business Rules trống");
    expect(props.onSignedOff).not.toHaveBeenCalled();
  });

  it("lỗi tải kế hoạch ⇒ báo lỗi; đang tải ⇒ câu chờ", () => {
    const { unmount } = render(
      <Mode1PlanPanel {...renderPanelProps()} plan={null} planError="Không tải được kế hoạch step" />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được kế hoạch step");
    unmount();
    render(<Mode1PlanPanel {...renderPanelProps()} plan={null} />);
    expect(screen.getByText("Đang tải kế hoạch step…")).toBeInTheDocument();
  });
});

function renderPanelProps() {
  return {
    projectId: P,
    steps: STEPS,
    flags: [],
    signedOff: false,
    busyStep: null,
    onToggleStep: vi.fn(),
    onSelectStep: vi.fn(),
    getBaseVersion: () => 7,
    onSignedOff: vi.fn(),
  };
}
