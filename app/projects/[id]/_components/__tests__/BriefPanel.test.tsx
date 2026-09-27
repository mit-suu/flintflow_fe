import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import BriefPanel from "../BriefPanel";
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
  it("nói rõ đây là Brief, chưa phải SRS; field trống hiện dòng mờ", () => {
    render(<BriefPanel spine={{ project: project(), assumptions: [] }} />);
    expect(screen.getByRole("heading", { name: "Brief đang hình thành" })).toBeTruthy();
    expect(screen.getByText("Tóm tắt ý tưởng — chưa phải tài liệu SRS")).toBeTruthy();
    expect(screen.getAllByText("Chưa có — AI sẽ hỏi khi cần").length).toBeGreaterThanOrEqual(4);
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

  it("helper nhãn dùng chung", () => {
    expect(formFactorLabel("web_app")).toBe("Web");
    expect(formFactorLabel(null)).toBeNull();
    expect(stakesLabel("regulated")).toBe("Có quản lý ngành");
    expect(assumptionText({ statement: "EN", statement_vi: "  " })).toBe("EN");
  });
});
