import { describe, expect, it } from "vitest";
import { renderHookWithIntl, vietnameseLeftovers } from "@/test/intl";
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
    expect(text(note("plan_changed", null))).toEqual({ title: "Tiêu đề đã lưu", body: "Nội dung đã lưu" });
    expect(text(note("plan_changed", { plan: "unknown" }))).toEqual({ title: "Tiêu đề đã lưu", body: "Nội dung đã lưu" });
    expect(text(note("plan_expired", { plan: "free" }))).toEqual({ title: "Tiêu đề đã lưu", body: "Nội dung đã lưu" });
    expect(text(note("credits_renewed", {}))).toEqual({ title: "Tiêu đề đã lưu", body: "Nội dung đã lưu" });
    expect(text(note("credit_topup_needed", { step_id: "I-1.11" }, "T", "Body without project"))).toEqual({
      title: "T",
      body: "Body without project",
    });
  });

  it("plan_changed: hỗ trợ cả meta.label và fallback meta.plan (vi & en)", () => {
    expect(textIn("vi")(note("plan_changed", { plan: "pro", label: "Pro", periodEnd: null }))).toEqual({
      title: "Đã chuyển sang gói Pro",
      body: "Gói Pro đã được kích hoạt.",
    });
    expect(textIn("vi")(note("plan_changed", { plan: "team", periodEnd: "2026-12-01T00:00:00.000Z" }))).toEqual({
      title: "Đã chuyển sang gói Team",
      body: "Gói Team có hiệu lực đến 1/12/2026.",
    });
    expect(textIn("en")(note("plan_changed", { plan: "pro" }))).toEqual({
      title: "Switched to the Pro plan",
      body: "The Pro plan has been activated.",
    });
  });

  it("plan_expired, credits_renewed, credit_topup_needed: dựng đúng câu VI & EN và EN không còn chữ tiếng Việt", () => {
    const cases = [
      note("plan_expired", { plan: "free", previousPlan: "pro", credits: 300, periodEnd: "2026-12-15T00:00:00.000Z" }),
      note("plan_expired", { plan: "free", previousPlan: "pro", credits: 300 }),
      note("plan_expired", { plan: "free", previousPlan: "team", credits: 0 }),
      note("plan_expired", { plan: "free", previousPlan: "team" }),
      note("credits_renewed", { credits: 1000, periodEnd: "2026-12-15T00:00:00.000Z" }),
      note("credits_renewed", { credits: 1000 }),
      note("credit_topup_needed", { project_name: "Shop Online", step_id: "I-4:custom:1", section_heading: "1.2 Scope" }),
      note("credit_topup_needed", { project_name: "Shop Online", step_id: "I-4:fixed:1" }),
      note("credit_topup_needed", { project_name: "Shop Online", step_id: "I-4" }),
      note("credit_topup_needed", { project_name: "Shop Online", step_id: "I-1.11" }),
      note("credit_topup_needed", { project_name: "Shop Online", step_id: "C-2:CR-02" }),
      note("credit_topup_needed", { project_name: "Shop Online", step_id: "C-4:CR-01" }),
      note("credit_topup_needed", { project_name: "Shop Online", step_id: "C-5:CR-03" }),
      note("credit_topup_needed", { project_name: "Shop Online", step_id: "X-99" }),
      note(
        "credit_topup_needed",
        { step_id: "I-4:custom:2" },
        "Hết credit",
        'Dự án "Legacy App" dừng ở bước trích dữ liệu mục "2.1 Overview" vì không đủ credit.'
      ),
    ];

    const viText = textIn("vi");
    const viOut = cases.map((c) => viText(c));
    expect(viOut[0]).toEqual({
      title: "Gói Pro đã hết hạn",
      body: "Tổ chức đã chuyển về gói Free và được cộng +300 credit cho kỳ mới đến 15/12/2026. Mua lại gói Pro để tiếp tục dùng giới hạn cao hơn.",
    });
    expect(viOut[1].body).toBe(
      "Tổ chức đã chuyển về gói Free và được cộng +300 credit cho kỳ mới. Mua lại gói Pro để tiếp tục dùng giới hạn cao hơn."
    );
    expect(viOut[2]).toEqual({
      title: "Gói Team đã hết hạn",
      body: "Tổ chức đã chuyển về gói Free. Mua lại gói Team để tiếp tục dùng giới hạn cao hơn.",
    });
    expect(viOut[3]).toEqual({
      title: "Gói Team đã hết hạn",
      body: "Tổ chức đã chuyển về gói Free. Mua lại gói Team để tiếp tục dùng giới hạn cao hơn.",
    });
    expect(viOut[4]).toEqual({
      title: "Đã cấp credit kỳ mới",
      body: "Ví tổ chức đã được cộng +1.000 credit cho kỳ mới đến 15/12/2026.",
    });
    expect(viOut[5].body).toBe("Ví tổ chức đã được cộng +1.000 credit cho kỳ mới.");
    expect(viOut[6]).toEqual({
      title: "Hết credit - bước AI đang dừng",
      body: 'Dự án "Shop Online" dừng ở bước trích dữ liệu mục "1.2 Scope" vì không đủ credit. Nạp thêm để chạy tiếp - sau khi nạp thêm credit, thành viên thực hiện mở lại dự án và bấm tiếp tục.',
    });
    expect(viOut[7].body).toContain("bước trích dữ liệu mục 1");
    expect(viOut[8].body).toContain("bước trích dữ liệu tài liệu");
    expect(viOut[9].body).toContain("bước AI kiểm tra nội dung tài liệu vừa nhập");
    expect(viOut[10].body).toContain("bước AI làm rõ yêu cầu của CR-02");
    expect(viOut[11].body).toContain("bước AI đề xuất sửa của CR-01");
    expect(viOut[12].body).toContain("bước AI kiểm tra đề xuất của CR-03");
    expect(viOut[13].body).toContain("một bước AI");
    expect(viOut[14].body).toContain('Dự án "Legacy App" dừng ở bước trích dữ liệu mục "2.1 Overview"');

    const enText = textIn("en");
    const enOut = cases.map((c) => enText(c));
    expect(enOut[0]).toEqual({
      title: "Your Pro plan has expired",
      body: "Your organization moved to the Free plan and received +300 credits for the new cycle until 12/15/2026. Repurchase Pro to keep higher limits.",
    });
    expect(enOut[1].body).toBe(
      "Your organization moved to the Free plan and received +300 credits for the new cycle. Repurchase Pro to keep higher limits."
    );
    expect(enOut[2]).toEqual({
      title: "Your Team plan has expired",
      body: "Your organization moved to the Free plan. Repurchase Team to keep higher limits.",
    });
    expect(enOut[3]).toEqual({
      title: "Your Team plan has expired",
      body: "Your organization moved to the Free plan. Repurchase Team to keep higher limits.",
    });
    expect(enOut[4]).toEqual({
      title: "New cycle credits granted",
      body: "Your organization wallet received +1,000 credits for the new cycle until 12/15/2026.",
    });
    expect(enOut[5].body).toBe("Your organization wallet received +1,000 credits for the new cycle.");
    expect(enOut[6]).toEqual({
      title: "Out of credits - AI step paused",
      body: 'Project "Shop Online" paused at extracting section "1.2 Scope" due to insufficient credits. Top up to continue - after credits are added, the member running the step should reopen the project and press Continue.',
    });
    expect(enOut[7].body).toContain("extracting section 1");
    expect(enOut[8].body).toContain("document data extraction");
    expect(enOut[9].body).toContain("the AI content check for the imported document");
    expect(enOut[10].body).toContain("AI requirement clarification for CR-02");
    expect(enOut[11].body).toContain("AI change proposal for CR-01");
    expect(enOut[12].body).toContain("AI proposal verification for CR-03");
    expect(enOut[13].body).toContain("an AI step");
    expect(enOut[14].body).toContain('Project "Legacy App" paused at extracting section "2.1 Overview"');

    // Kiểm tra bản EN không sót bất kỳ chữ tiếng Việt nào
    const container = document.createElement("div");
    container.textContent = enOut.map((item) => `${item.title}\n${item.body}`).join("\n");
    expect(vietnameseLeftovers(container)).toEqual([]);
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

  it("credits_adjusted: dựng câu cộng/trừ credit theo VI/EN kể cả dòng cũ thiếu organizationName", () => {
    const plusMeta = { organizationId: "o1", organizationName: "Org A", amount: 50, reason: "Support bonus" };
    const minusMeta = { organizationId: "o1", organizationName: "Org A", amount: -20, reason: "Chargeback" };
    const legacyPlus = note(
      "credits_adjusted",
      { organizationId: "o1", amount: 50, reason: "Compensation" },
      "Tổ chức được cộng credit",
      "+50 credit cho Org Legacy. Lý do: Compensation"
    );
    const genericPlus = note(
      "credits_adjusted",
      { organizationId: "o1", amount: 1, reason: "Compensation" },
      "Tổ chức được cộng credit",
      "legacy text"
    );

    const viText = textIn("vi");
    expect(viText(note("credits_adjusted", plusMeta))).toEqual({
      title: "Tổ chức được cộng credit",
      body: "+50 credit cho Org A. Lý do: Support bonus",
    });
    expect(viText(note("credits_adjusted", minusMeta))).toEqual({
      title: "Tổ chức bị trừ credit",
      body: "-20 credit cho Org A. Lý do: Chargeback",
    });

    const enText = textIn("en");
    const enOutputs = [
      enText(note("credits_adjusted", plusMeta)),
      enText(note("credits_adjusted", minusMeta)),
      enText(legacyPlus),
      enText(genericPlus),
    ];
    expect(enOutputs[0]).toEqual({
      title: "Organization credits added",
      body: "+50 credits for Org A. Reason: Support bonus",
    });
    expect(enOutputs[1]).toEqual({
      title: "Organization credits deducted",
      body: "-20 credits for Org A. Reason: Chargeback",
    });
    expect(enOutputs[2]).toEqual({
      title: "Organization credits added",
      body: "+50 credits for Org Legacy. Reason: Compensation",
    });
    expect(enOutputs[3]).toEqual({
      title: "Organization credits added",
      body: "+1 credit. Reason: Compensation",
    });

    const container = document.createElement("div");
    container.textContent = enOutputs.map((item) => `${item.title}\n${item.body}`).join("\n");
    expect(vietnameseLeftovers(container)).toEqual([]);
  });
});
