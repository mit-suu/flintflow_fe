import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/test/intl";
import type { ReviewPackage } from "@/types/doc-version";
import { packageStatusView } from "./review-package-status";

const t = createTranslator({ locale: "vi", messages: MESSAGES.vi, namespace: "mode1.reviewPackage" });
const pkg = (status: ReviewPackage["status"], crs: number): ReviewPackage =>
  ({ status, change_requests: Array.from({ length: crs }, (_, i) => ({ cr_id: `CR-00${i + 1}` })) }) as unknown as ReviewPackage;

describe("packageStatusView - pill gói thay đổi ở thanh đầu tài liệu", () => {
  it("đang soạn: có CR ⇒ số CR chưa gửi; chưa có CR ⇒ không có pill", () => {
    expect(packageStatusView(pkg("drafting", 1), t)).toEqual({ label: "1 CR chưa gửi Lead", tone: "primary" });
    expect(packageStatusView(pkg("drafting", 3), t)?.label).toBe("3 CR chưa gửi Lead");
    expect(packageStatusView(pkg("drafting", 0), t)).toBeNull();
  });

  it("chờ Lead duyệt / Lead yêu cầu sửa đọc thẳng status BE", () => {
    expect(packageStatusView(pkg("pending", 2), t)).toEqual({ label: "Chờ Lead duyệt", tone: "primary" });
    expect(packageStatusView(pkg("changes_requested", 2), t)).toEqual({ label: "Lead yêu cầu sửa", tone: "danger" });
  });

  it("chưa tải được gói ⇒ không có pill", () => {
    expect(packageStatusView(null, t)).toBeNull();
  });
});
