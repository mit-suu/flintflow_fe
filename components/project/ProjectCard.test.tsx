import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectCard, { getStatusBadge, nextStepLabel } from "./ProjectCard";
import { tStep } from "@/lib/i18n";
import type { ProgressResponse } from "@/types/pipeline";
import type { Project } from "@/types/project";

const progress = (over: Partial<ProgressResponse["progress"]> = {}, readiness: Partial<ProgressResponse["readiness"]> = {}): ProgressResponse => ({
  readiness: { accepted_pct: 0, awaiting_reaccept: 0, red_open: 0, stale: 0, ...readiness },
  progress: { done: 0, total: 51, current_phase: null, current_step: null, show_percent: false, ...over },
  sections: [],
});

describe("nextStepLabel — việc tiếp theo lấy từ step registry", () => {
  it("đang tải ⇒ nói đang tải, không hiện nhãn sai", () => {
    expect(nextStepLabel(undefined)).toBe("Đang tải…");
  });

  it("project chưa có Spine ⇒ mời bắt đầu, không hiện mã step thô", () => {
    expect(nextStepLabel(null)).toContain("Chưa bắt đầu");
  });

  it("có Spine nhưng chưa chạy step nào ⇒ vẫn là chưa bắt đầu", () => {
    expect(nextStepLabel(progress())).toContain("Chưa bắt đầu");
  });

  it("đang ở một step ⇒ đúng nhãn của registry, không phải bảng cứng cũ", () => {
    expect(nextStepLabel(progress({ current_step: "S-3.1" }))).toBe(tStep("S-3.1", "vi"));
  });

  it("step vòng S-5 hiện kèm khoá màn", () => {
    expect(nextStepLabel(progress({ current_step: "S-5.4@S07" }))).toContain("S07");
  });

  it("đổi ngôn ngữ thì nhãn đổi theo", () => {
    const vi = nextStepLabel(progress({ current_step: "S-3.1" }), "vi");
    const en = nextStepLabel(progress({ current_step: "S-3.1" }), "en");
    expect(vi).not.toBe(en);
  });
});

describe("ProjectCard — màu và nhãn theo source mode", () => {
  const baseProject: Project = {
    _id: "p1",
    name: "Lumen",
    status: "active",
    mode: "fpt",
    import_state: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };
  const noop = () => {};

  it.each([
    ["import", "SRS có sẵn", /bg-(info|brand|success)-/],
    ["customer_template", "Template khách", /bg-(accent-gold|error)-/],
    ["fpt", "Mẫu FPT", /bg-(brand|primary)-/],
  ] as const)("%s ⇒ nhãn %s, bìa theo tone của mode", (mode, label, stripe) => {
    const { container } = render(
      <ProjectCard project={{ ...baseProject, mode }} progress={null} onRename={noop} onDelete={noop} onHardDelete={noop} />
    );
    expect(screen.getAllByText(label, { exact: false }).length).toBeGreaterThan(0);
    expect(container.querySelector("[data-cover-variant]")?.className).toMatch(stripe);
  });

  it("luôn link vào /projects/:id; badge trạng thái theo readiness (cờ đỏ thắng %)", () => {
    render(
      <ProjectCard
        project={baseProject}
        progress={progress({}, { red_open: 1, accepted_pct: 95 })}
        onRename={noop}
        onDelete={noop}
        onHardDelete={noop}
      />
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/p1");
    expect(screen.getByText("Cần làm rõ")).toBeInTheDocument();
  });

  it("menu ⋮: đủ 3 thao tác; dự án đã lưu trữ không có Lưu trữ", () => {
    const onDelete = vi.fn();
    const { rerender } = render(
      <ProjectCard project={baseProject} progress={null} onRename={noop} onDelete={onDelete} onHardDelete={noop} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Tuỳ chọn cho Lumen" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Đổi tên", "Lưu trữ", "Xoá vĩnh viễn"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Lưu trữ" }));
    expect(onDelete).toHaveBeenCalledWith(baseProject);

    rerender(
      <ProjectCard project={{ ...baseProject, status: "archived" }} progress={null} onRename={noop} onDelete={noop} onHardDelete={noop} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Tuỳ chọn cho Lumen" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Đổi tên", "Xoá vĩnh viễn"]);
  });
});

describe("getStatusBadge", () => {
  it.each([
    [undefined, "Bản nháp"],
    [null, "Bản nháp"],
    [progress({}, { accepted_pct: 50 }), "Đang phân tích"],
    [progress({}, { accepted_pct: 85 }), "Sẵn sàng"],
    [progress({}, { accepted_pct: 85, red_open: 2 }), "Cần làm rõ"],
  ])("%# ⇒ %s", (p, label) => {
    expect(getStatusBadge(p).label).toBe(label);
  });
});
