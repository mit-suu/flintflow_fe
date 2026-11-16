import { describe, expect, it } from "vitest";
import { renderHookWithIntl } from "@/test/intl";
import { useNotificationText } from "./notification-text";

const note = (type: string, meta: Record<string, unknown> | null, title = "Tiêu đề đã lưu", body = "Nội dung đã lưu") => ({
  type,
  meta,
  title,
  body,
});

const textIn = (locale: "vi" | "en") => renderHookWithIntl(() => useNotificationText(), locale).result.current;

describe("useNotificationText (T25)", () => {
  it("vi: dựng lại đúng câu BE đang ghi", () => {
    const text = textIn("vi");
    expect(text(note("payment_success", { credits: 1000, amount: 99000 }))).toEqual({
      title: "Thanh toán thành công",
      body: "Đã cộng 1.000 credit vào tài khoản của bạn.",
    });
    expect(text(note("plan_changed", { plan: "pro", label: "Pro", periodEnd: "2026-10-01T00:00:00.000Z" })).body).toBe(
      "Gói Pro có hiệu lực đến 1/10/2026."
    );
  });

  it("en: mọi loại thông báo người dùng đều dịch được", () => {
    const text = textIn("en");
    expect(text(note("welcome", { credits: 100 }))).toEqual({
      title: "Welcome to FlintFlow",
      body: "Your account is ready with 100 free credits.",
    });
    expect(text(note("payment_failed", { amount: 99000 })).title).toBe("Payment failed");
    expect(text(note("low_credit", { balance: 8, threshold: 10 })).body).toBe(
      "Your balance is down to 8 credits. Top up to keep using AI."
    );
    expect(text(note("plan_changed", { plan: "free", label: "Free", periodEnd: null })).body).toBe("The Free plan has been activated.");
    // Tên giai đoạn, không hiện mã `S-3` (FLF-247)
    expect(text(note("phase_accepted", { phase: "S-3" })).title).toBe("Stage User Requirements completed");
    expect(text(note("baseline_created", { version: "v1.0", waived_count: 1 })).body).toBe(
      "The document was signed off at v1.0 with 1 flag waived with a reason."
    );
    expect(text(note("baseline_created", { version: "v1.0", waived_count: 0 })).body).toBe(
      "The document was signed off at v1.0 with no red flags left."
    );
  });

  it("mẫu có bản mới và mục khung chờ duyệt dịch theo ngôn ngữ người xem; thiếu meta giữ câu đã lưu", () => {
    const published = note("template_version_published", { template_id: "t1", version: 2, project_ids: ["p1", "p2"] });
    expect(textIn("vi")(published)).toEqual({
      title: "Mẫu của tổ chức có bản 2",
      body: "2 dự án đang theo bản cũ. Mở dự án để cập nhật sang mẫu mới hoặc để sau.",
    });
    expect(textIn("en")(published).title).toBe("The organization template has version 2");
    expect(textIn("en")(note("skeleton_headings_pending", { pending: 3 })).title).toBe("3 sections awaiting review for the skeleton template");
    expect(textIn("vi")(note("template_version_published", null))).toEqual({ title: "Tiêu đề đã lưu", body: "Nội dung đã lưu" });
  });

  it("FLF-303: yêu cầu mời / duyệt / từ chối dịch theo ngôn ngữ người xem", () => {
    const meta = { requesterName: "Bình", email: "moi@flintflow.test", organizationName: "Nhóm A", role: "viewer" };
    expect(textIn("en")(note("org_invitation_requested", meta)).body).toBe(
      "Bình wants to invite moi@flintflow.test to Nhóm A as Viewer."
    );
    expect(textIn("vi")(note("org_invitation_approved", meta)).title).toBe("Yêu cầu mời thành viên đã được duyệt");
    expect(textIn("en")(note("org_invitation_rejected", meta)).body).toBe(
      "A Lead rejected the invitation for moi@flintflow.test to Nhóm A."
    );
    expect(textIn("en")(note("org_invitation_requested", { email: "x@y.z" })).title).toBe("Tiêu đề đã lưu");
  });

  it("thiếu tham số (thông báo cũ) ⇒ hiện nguyên câu đã lưu", () => {
    const text = textIn("en");
    expect(text(note("welcome", null))).toEqual({ title: "Tiêu đề đã lưu", body: "Nội dung đã lưu" });
    expect(text(note("plan_changed", { plan: "pro" }))).toEqual({ title: "Tiêu đề đã lưu", body: "Nội dung đã lưu" });
  });

  it("type lạ / thông báo admin ⇒ hiện nguyên câu đã lưu", () => {
    const text = textIn("en");
    expect(text(note("admin_new_user", { userId: "u1" })).title).toBe("Tiêu đề đã lưu");
    expect(text(note("something_new", {})).body).toBe("Nội dung đã lưu");
  });

  it("template_migration_failed: dựng câu theo ngôn ngữ", () => {
    expect(textIn("vi")(note("template_migration_failed", { migration_id: "m1" })).title).toBe("Đổi mẫu bị kẹt");
    expect(textIn("en")(note("template_migration_failed", { migration_id: "m1" })).title).toBe("Template change got stuck");
  });
});
