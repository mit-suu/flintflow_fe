import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/intl";
import type { Spine } from "@/types/spine";
import type { PendingItem, PendingQueue } from "@/types/pending-queue";
import ProjectRecordPanel from "../ProjectRecordPanel";

// Bản đồ truy vết tự gọi API — chỉ cần biết tab mở đúng component
vi.mock("../TraceabilityMap", () => ({ default: () => <div data-testid="trace-map" /> }));

const spine = {
  spine_version: 3,
  progress: { current_phase: "B-2" },
  project: { system_name: "Clinic Hub", form_factor: ["web_app"], stakes: "regulated", vision: "Book visits", goals: [] },
  addendum: [{ id: "AD01", topic: "scale", content: "Khoảng 200 bệnh nhân mỗi ngày", content_en: "About 200 patients a day", target_section: "fixed:5.4", captured_at: "2026-11-18T00:00:00.000Z" }],
  assumptions: [
    { id: "AS01", path: "nfrs[id=N01]", statement: "Clinic opens 8am", statement_vi: "Phòng khám mở cửa 8 giờ", rationale: "", origin_step_id: "B-1.2", status: "unconfirmed", confirmed_at: null },
  ],
  other_requirements: [],
  decisions: [{ id: "DC01", topic_key: "uptime", question: "Uptime?", answer: "99%", step_id: "S-1.4", at: "2026-09-22T10:00:00.000Z", superseded_by: null }],
  actors: [],
  entities: [],
  screens: [],
  glossary: [],
} as unknown as Spine;

const item = (kind: PendingItem["kind"], id: string, refs: PendingItem["refs"]): PendingItem => ({
  key: `${kind}:${id}`,
  kind,
  blocking: kind !== "flag_yellow_group",
  owner_step: "B-1.2",
  section_id: null,
  entity_path: null,
  dependents: 0,
  refs,
});

const queue: PendingQueue = {
  total: 3,
  items: [
    item("assumption", "AS01", { assumption_id: "AS01" }),
    item("brief_note", "AD01", { addendum_id: "AD01" }),
    // Cờ không nằm ở tab Chờ quyết (xem ở Kiểm & chốt)
    item("flag_red", "FL01", { flag_ids: ["FL01"] }),
  ],
};

const source = { para_id: "D1-P02", document_id: "doc1", document_name: "bien-ban.docx", quote: "Mỗi ngày khoảng 200 lượt khám." };

const renderPanel = (over: Partial<Parameters<typeof ProjectRecordPanel>[0]> = {}) =>
  renderWithIntl(
    <ProjectRecordPanel
      projectId="p1"
      spine={spine}
      onSubmitOps={vi.fn()}
      onMarkPlaceholder={vi.fn()}
      inBriefPhase
      history={[]}
      historyLoading={false}
      onLoadHistory={vi.fn()}
      {...over}
    />
  );

describe("ProjectRecordPanel - tab Chờ quyết chỉ xem theo hàng đợi", () => {
  it("liệt kê việc không phải cờ, số đếm theo hàng, không còn nút ghi; Quyết trong chat mở đúng việc", () => {
    const onDecideInChat = vi.fn();
    renderPanel({ queue, onDecideInChat });

    const tab = screen.getByRole("tab", { name: /Chờ bạn quyết/ });
    expect(tab).toHaveTextContent("2");
    expect(screen.getByText("Phòng khám mở cửa 8 giờ")).toBeInTheDocument();
    expect(screen.getByText("Khoảng 200 bệnh nhân mỗi ngày")).toBeInTheDocument();
    // Nút ghi cũ (Đúng / Giữ / Bỏ) không còn trong tab
    expect(screen.queryByRole("button", { name: "Đúng" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Bỏ/ })).toBeNull();

    const buttons = screen.getAllByRole("button", { name: /Quyết trong chat/ });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onDecideInChat).toHaveBeenCalledWith("brief_note:AD01");
  });

  it("hàng đợi lỗi ⇒ hiện lại các panel ghi cũ, ẩn số đếm", () => {
    renderPanel({ queue: null, queueError: "@pendingQueueLoadFailed" });
    fireEvent.click(screen.getByRole("tab", { name: /Chờ bạn quyết/ }));
    expect(screen.getByText(/Chưa tải được danh sách việc chờ quyết/)).toBeInTheDocument();
    expect(screen.getByText(t => t.includes("Những điều tôi đang hiểu"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quyết trong chat/ })).toBeNull();
    expect(screen.getByRole("tab", { name: /Chờ bạn quyết/ })).not.toHaveTextContent(/\d/);
  });

  it("chip Nguồn ở ghi chú Brief và quyết định đã chốt (không render ra tài liệu)", () => {
    const sources = new Map([
      ["addendum[id=AD01]", [source]],
      ["decisions[id=DC01]", [source]],
    ]);
    renderPanel({ queue, sources });
    expect(screen.getAllByRole("button", { name: /Nguồn tài liệu của mục này/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Đã thống nhất" }));
    expect(screen.getAllByRole("button", { name: /Nguồn tài liệu của mục này/ })).toHaveLength(1);
  });

  it("Tóm tắt Brief: tầm nhìn có nguồn thì có chip (không in ra tài liệu nên hiện ở Hồ sơ)", () => {
    renderPanel({ queue, sources: new Map([["project.vision", [source]]]) });
    fireEvent.click(screen.getByRole("tab", { name: "Đã thống nhất" }));
    expect(screen.getByText("Book visits").closest("p")?.querySelector("[data-source-chip]")).not.toBeNull();
  });

  it("không còn tab Nguồn; tab Truy vết mở bản đồ truy vết", () => {
    renderPanel({ queue });
    const tabs = screen.getByRole("tablist");
    expect(within(tabs).queryByRole("tab", { name: "Nguồn" })).toBeNull();
    fireEvent.click(within(tabs).getByRole("tab", { name: "Truy vết" }));
    expect(screen.getByTestId("trace-map")).toBeInTheDocument();
  });
});
