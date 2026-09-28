import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import BriefPanel, { briefHasData } from "../BriefPanel";
import { assumptionText, formFactorLabel, stakesLabel } from "../brief-labels";
import type { Spine } from "@/types/spine";

const project = (patch: Partial<Spine["project"]> = {}): Spine["project"] => ({
  name: "Dự án mới",
  system_name: null,
  vision: null,
  goals: [],
  type: null,
  domain: null,
  complexity: null,
  form_factor: null,
  stakes: null,
  working_mode: null,
  review_mode: "balanced",
  release_scope: { in: [], out: [] },
  ...patch,
});

describe("BriefPanel (FLF-221)", () => {
  it("Brief chưa có gì ⇒ workspace ẩn khung (briefHasData false); có một mục bất kỳ ⇒ hiện", () => {
    expect(briefHasData({ project: project(), assumptions: [], addendum: [] })).toBe(false);
    expect(briefHasData({ project: project({ system_name: "  " }), assumptions: [], addendum: [] })).toBe(false);
    expect(briefHasData({ project: project({ form_factor: "web_app" }), assumptions: [], addendum: [] })).toBe(true);
  });

  it("nói rõ đây là Brief, chưa phải SRS; đang tải Spine thì là skeleton giữ chỗ", () => {
    render(<BriefPanel spine={null} />);
    expect(screen.getByRole("heading", { name: "Brief đang hình thành" })).toBeTruthy();
    expect(screen.getByText("Tóm tắt ý tưởng — chưa phải tài liệu SRS")).toBeTruthy();
    expect(screen.getByLabelText("Đang tải Brief").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("Tầm nhìn")).toBeNull();
    expect(screen.queryByText(/Giả định AI đang dùng/)).toBeNull();
  });

  it("ẩn ô chưa có dữ liệu, chỉ hiện ô đã có", () => {
    render(<BriefPanel spine={{ project: project({ system_name: "Internal Hub", form_factor: "web_app" }), assumptions: [], addendum: [] }} />);
    expect(screen.getByText("Internal Hub")).toBeTruthy();
    expect(screen.getByText("Web")).toBeTruthy();
    expect(screen.queryByText("Mức độ quan trọng")).toBeNull();
    expect(screen.queryByText("Tầm nhìn")).toBeNull();
    expect(screen.queryByText(/Mục tiêu/)).toBeNull();
    expect(screen.queryByLabelText("Đang tải Brief")).toBeNull();
  });

  it("hiện tên hệ thống, nền tảng, mức độ và giả định bằng ngôn ngữ user kèm trạng thái", () => {
    render(
      <BriefPanel
        spine={{
          project: project({ system_name: "Salon Slot", form_factor: "mobile_app", stakes: "production", goals: ["Giảm khách bỏ hẹn"] }),
          assumptions: [
            { id: "AS01", path: "project.form_factor", statement: "Mobile first.", statement_vi: "Ưu tiên điện thoại.", rationale: "", origin_step_id: "B-0.1", status: "unconfirmed", confirmed_at: null },
            { id: "AS02", path: "project.stakes", statement: "Real customers.", rationale: "", origin_step_id: "B-0.1", status: "confirmed", confirmed_at: "2026-09-28T00:00:00.000Z" },
          ],
          addendum: [],
        }}
        updating
      />
    );
    expect(screen.getByText("Salon Slot")).toBeTruthy();
    expect(screen.getByText("Mobile")).toBeTruthy();
    expect(screen.getByText("Chạy thật")).toBeTruthy();
    expect(screen.getByText("Ưu tiên điện thoại.")).toBeTruthy();
    expect(screen.getByText("Real customers.")).toBeTruthy();
    expect(screen.getByText("Chưa xác nhận")).toBeTruthy();
    expect(screen.getByText("Đã xác nhận")).toBeTruthy();
    expect(screen.getByText("AI đang cập nhật")).toBeTruthy();
  });

  it("hiện điều user đã kể (addendum) bằng lời của user", () => {
    render(
      <BriefPanel
        spine={{
          project: project({ system_name: "Internal Hub" }),
          assumptions: [],
          addendum: [
            { id: "AD1", topic: "purpose", content: "Công cụ quản lý dữ liệu nội bộ", content_en: "Internal data management tool", target_section: "fixed:1", captured_at: "2026-09-28T00:00:00.000Z" },
            { id: "AD2", topic: "scale", content: "Dưới 10 người dùng", content_en: "Fewer than 10 users", target_section: "fixed:4.2.3", captured_at: "2026-09-28T00:00:00.000Z" },
          ],
        }}
      />
    );
    expect(screen.getByText("Điều bạn đã kể (2)")).toBeTruthy();
    expect(screen.getByText("Công cụ quản lý dữ liệu nội bộ")).toBeTruthy();
    expect(screen.queryByText("Internal data management tool")).toBeNull();
  });

  it("helper nhãn dùng chung", () => {
    expect(formFactorLabel("web_app")).toBe("Web");
    expect(formFactorLabel(null)).toBeNull();
    expect(stakesLabel("regulated")).toBe("Có quản lý ngành");
    expect(assumptionText({ statement: "EN", statement_vi: "  " })).toBe("EN");
  });
});
