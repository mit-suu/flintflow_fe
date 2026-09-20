import { fireEvent, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import ProjectCard, { getStatusBadge, nextStepLabel, phasePosition } from "./ProjectCard";
import { tStep, type Locale } from "@/lib/i18n";
import { getSourceModeOption } from "@/lib/project-source-mode";
import { MESSAGES, renderWithIntl } from "@/test/intl";

/** Hàm dịch của `app.projectCard.next` — helper thuần nhận nó thay vì tự gọi hook. */
const tNext = (locale: Locale = "vi") =>
  createTranslator({ locale, messages: MESSAGES[locale], namespace: "app.projectCard.next" });
const tMode = (locale: Locale = "vi") => createTranslator({ locale, messages: MESSAGES[locale], namespace: "app.sourceMode" });
import type { ProgressResponse } from "@/types/pipeline";
import type { Project } from "@/types/project";

const progress = (over: Partial<ProgressResponse["progress"]> = {}, readiness: Partial<ProgressResponse["readiness"]> = {}): ProgressResponse => ({
  readiness: { accepted_pct: 0, awaiting_reaccept: 0, red_open: 0, stale: 0, ...readiness },
  progress: { done: 0, total: 51, current_phase: null, current_step: null, show_percent: false, ...over },
  sections: [],
});

describe("nextStepLabel — việc tiếp theo lấy từ step registry", () => {
  it("đang tải ⇒ nói đang tải, không hiện nhãn sai", () => {
    expect(nextStepLabel(undefined, tNext())).toBe("Đang tải…");
  });

  it("project chưa có Spine ⇒ mời bắt đầu, không hiện mã step thô", () => {
    expect(nextStepLabel(null, tNext())).toContain("Chưa bắt đầu");
  });

  it("có Spine nhưng chưa chạy step nào ⇒ vẫn là chưa bắt đầu", () => {
    expect(nextStepLabel(progress(), tNext())).toContain("Chưa bắt đầu");
  });

  it("không có step đang chạy nhưng đã làm dở ⇒ không nói là chưa bắt đầu", () => {
    expect(nextStepLabel(progress({ done: 66, total: 81 }), tNext())).toBe("Mở để tiếp tục");
    expect(nextStepLabel(progress({ done: 81, total: 81 }), tNext())).toBe("Đã hoàn tất");
  });

  it("đang ở một step ⇒ đúng nhãn của registry, không phải bảng cứng cũ", () => {
    expect(nextStepLabel(progress({ current_step: "S-3.1" }), tNext())).toBe(tStep("S-3.1", "vi"));
  });

  it("step vòng S-5 hiện kèm khoá màn", () => {
    expect(nextStepLabel(progress({ current_step: "S-5.4@S07" }), tNext())).toContain("S07");
  });

  it("đổi ngôn ngữ thì nhãn đổi theo", () => {
    const vi = nextStepLabel(progress({ current_step: "S-3.1" }), tNext("vi"), "vi");
    const en = nextStepLabel(progress({ current_step: "S-3.1" }), tNext("en"), "en");
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
    ["import", "SRS có sẵn"],
    ["customer_template", "Template khách"],
  ] as const)("%s ⇒ ghi tên nguồn %s ở dòng meta; card nền tím nhạt", (mode, label) => {
    const { container } = renderWithIntl(
      <ProjectCard project={{ ...baseProject, mode }} progress={null} onRename={noop} onDelete={noop} onHardDelete={noop} />
    );
    expect(screen.getByTitle(tMode()(`${getSourceModeOption(mode).key}.label`))).toHaveTextContent(label);
    expect(container.querySelector("article")?.className.split(/\s+/)).toContain("bg-surface-card");
  });

  it("nguồn mặc định (Template FlintFlow) không ghi nhãn — gần như mọi dự án đều là nó", () => {
    renderWithIntl(<ProjectCard project={baseProject} progress={null} onRename={noop} onDelete={noop} onHardDelete={noop} />);
    expect(screen.queryByText("Template FlintFlow")).toBeNull();
  });

  it("dự án BE trả thiếu mode ⇒ coi là mặc định, không ghi nhãn", () => {
    const missing = { ...baseProject, mode: undefined } as unknown as Project;
    renderWithIntl(<ProjectCard project={missing} progress={null} onRename={noop} onDelete={noop} onHardDelete={noop} />);
    expect(screen.queryByText("Template FlintFlow")).toBeNull();
  });

  it("thanh 12 giai đoạn: phase đã qua tô đậm, phase đang làm tô nhạt, kèm số bước từ BE", () => {
    renderWithIntl(
      <ProjectCard
        project={baseProject}
        progress={progress({ done: 12, total: 51, current_phase: "S-2", current_step: "S-2.1" })}
        onRename={noop}
        onDelete={noop}
        onHardDelete={noop}
      />
    );
    const bar = screen.getByRole("progressbar", { name: "Tiến độ theo giai đoạn" });
    expect(bar).toHaveAttribute("aria-valuenow", "4");
    expect(bar).toHaveAttribute("aria-valuetext", expect.stringMatching(/Giai đoạn 5\/12/));
    // 4/12 giai đoạn đã qua tô đậm, giai đoạn thứ 5 nối tiếp tô nhạt
    expect((bar.querySelector("[data-part='done']") as HTMLElement).style.width).toMatch(/^33\.33/);
    expect((bar.querySelector("[data-part='current']") as HTMLElement).style.width).toMatch(/^41\.66/);
    expect(screen.getByText("12/51")).toBeInTheDocument();
  });

  it("luôn link vào /projects/:id; badge trạng thái theo readiness (cờ đỏ thắng %)", () => {
    renderWithIntl(
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
    const { rerender } = renderWithIntl(
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

describe("phasePosition — đếm theo phase để thanh không thụt lùi khi tổng bước được chốt", () => {
  it.each([
    [undefined, { done: 0, current: -1 }],
    [null, { done: 0, current: -1 }],
    [progress(), { done: 0, current: -1 }],
    [progress({ current_phase: "B-0" }), { done: 0, current: 0 }],
    [progress({ current_phase: "S-5", done: 30, total: 66 }), { done: 7, current: 7 }],
    [progress({ done: 66, total: 66 }), { done: 12, current: -1 }],
  ])("%# ⇒ %o", (p, expected) => {
    expect(phasePosition(p)).toEqual(expected);
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
    expect(MESSAGES.vi.app.projectCard.status[getStatusBadge(p).key]).toBe(label);
  });

  it("cờ đỏ là việc cần làm, không phải lỗi ⇒ tone warning", () => {
    expect(getStatusBadge(progress({}, { red_open: 1 })).tone).toBe("warning");
  });
});
