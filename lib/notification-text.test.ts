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

  describe("FLF-427: 17 loại thông báo chuẩn hoá (UC-71, BR-06)", () => {
    const VIETNAMESE_LETTER = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

    const sampleMeta = {
      org_member_joined: { organizationName: "Acme Corp", memberName: "Alice", role: "analyst" },
      org_role_changed: { organizationName: "Acme Corp", role: "lead" },
      org_member_removed: { organizationName: "Acme Corp" },
      org_member_left: { organizationName: "Acme Corp", memberName: "Bob" },
      baseline_submitted: { projectName: "Project Alpha", spine_version: 3 },
      baseline_rejected: { projectName: "Project Alpha", reason: "Need revision in chapter 2" },
      baseline_approved: { version: "v1.0" },
      project_converted: { doc_version: "1.0" },
      change_request_written: { cr_id: "CR-01", cr_title: "Add export feature", result_doc_version: "v1.1" },
      change_request_decided_written: { cr_id: "CR-01", cr_title: "Add export feature", result_doc_version: "v1.1" },
      change_request_decided_approved: { cr_id: "CR-01", cr_title: "Add export feature", group_title: "Exports", decision: "approved" },
      change_request_decided_rejected: { cr_id: "CR-01", cr_title: "Add export feature", group_title: "Exports", decision: "rejected" },
      change_request_decided_rejected_reason: { cr_id: "CR-01", cr_title: "Add export feature", group_title: "Exports", decision: "rejected", reason: "Scope too broad" },
      review_package_submitted: { projectName: "Project Alpha", count: 2, cr_ids: ["CR-01", "CR-02"] },
      review_package_changes_requested: { projectName: "Project Alpha", reason: "Clarify test cases" },
      review_package_released: { projectName: "Project Alpha", version: "v1.2", cr_ids: ["CR-01", "CR-02"] },
      comment_posted: { projectName: "Project Alpha", comment_id: "CM-01", anchor_label: "Section 1", version_label: "v1.0", preview: "Please double check" },
      comment_replied: { projectName: "Project Alpha", comment_id: "CM-01", anchor_label: "Section 1", preview: "Fixed in next commit" },
      comment_resolved: { projectName: "Project Alpha", comment_id: "CM-01", anchor_label: "Section 1" },
      comment_converted: { comment_id: "CM-01", cr_id: "CR-05", anchor_label: "Section 1" },
    };

    it("vi: dựng câu chính xác cho cả 17 loại thông báo", () => {
      const text = textIn("vi");

      expect(text(note("org_member_joined", sampleMeta.org_member_joined))).toEqual({
        title: "Thành viên mới tham gia tổ chức",
        body: "Alice đã tham gia Acme Corp với vai trò Analyst.",
      });

      expect(text(note("org_role_changed", sampleMeta.org_role_changed))).toEqual({
        title: "Vai trò của bạn đã thay đổi",
        body: "Bạn giờ là Lead trong Acme Corp.",
      });

      expect(text(note("org_member_removed", sampleMeta.org_member_removed))).toEqual({
        title: "Bạn đã bị xoá khỏi tổ chức",
        body: "Bạn không còn là thành viên của Acme Corp.",
      });

      expect(text(note("org_member_left", sampleMeta.org_member_left))).toEqual({
        title: "Một thành viên đã rời tổ chức",
        body: "Bob đã rời Acme Corp.",
      });

      expect(text(note("baseline_submitted", sampleMeta.baseline_submitted))).toEqual({
        title: "Project Alpha chờ bạn duyệt baseline",
        body: "Tài liệu đã qua kiểm tra, không còn cờ đỏ. Xem và duyệt để khoá baseline.",
      });

      expect(text(note("baseline_rejected", sampleMeta.baseline_rejected))).toEqual({
        title: "Project Alpha: Lead chưa duyệt baseline",
        body: "Project Alpha: Need revision in chapter 2",
      });

      expect(text(note("baseline_approved", sampleMeta.baseline_approved))).toEqual({
        title: "Baseline v1.0 đã được duyệt",
        body: "Bản bạn gửi duyệt đã được Lead chấp nhận và khoá ở mức v1.0.",
      });

      expect(text(note("project_converted", sampleMeta.project_converted))).toEqual({
        title: "Baseline đã chốt - dự án chuyển sang chế độ quản lý thay đổi",
        body: "Tài liệu được khoá ở phiên bản 1.0. Từ giờ mọi chỉnh sửa đi qua Change Request; cờ không còn bỏ qua (waive) được.",
      });

      expect(text(note("change_request_written", sampleMeta.change_request_written))).toEqual({
        title: "CR-01 đã ghi vào bản nháp",
        body: 'Thay đổi "Add export feature" đã ghi vào bản nháp chung (bản v1.1). Gửi Lead duyệt cả gói khi muốn phát hành.',
      });

      expect(text(note("change_request_decided", sampleMeta.change_request_decided_written))).toEqual({
        title: "CR-01 đã được ghi vào bản v1.1",
        body: 'Thay đổi "Add export feature" đã ghi vào tài liệu, bản v1.1.',
      });

      expect(text(note("change_request_decided", sampleMeta.change_request_decided_approved))).toEqual({
        title: "CR-01: nhóm thay đổi “Exports” được duyệt",
        body: 'Nhóm thay đổi “Exports” của "Add export feature" được duyệt.',
      });

      expect(text(note("change_request_decided", sampleMeta.change_request_decided_rejected))).toEqual({
        title: "CR-01: nhóm thay đổi “Exports” bị từ chối",
        body: 'Nhóm thay đổi “Exports” của "Add export feature" bị từ chối.',
      });

      expect(text(note("change_request_decided", sampleMeta.change_request_decided_rejected_reason))).toEqual({
        title: "CR-01: nhóm thay đổi “Exports” bị từ chối",
        body: 'Nhóm thay đổi “Exports” của "Add export feature" bị từ chối: Scope too broad.',
      });

      expect(text(note("review_package_submitted", sampleMeta.review_package_submitted))).toEqual({
        title: "Project Alpha: 2 thay đổi chờ bạn duyệt",
        body: "Gói CR-01, CR-02 đã qua kiểm tra, không còn cờ đỏ. Duyệt cả gói để phát hành bản mới, hoặc yêu cầu sửa.",
      });

      expect(text(note("review_package_changes_requested", sampleMeta.review_package_changes_requested))).toEqual({
        title: "Project Alpha: Lead yêu cầu sửa gói thay đổi",
        body: "Clarify test cases",
      });

      expect(text(note("review_package_released", sampleMeta.review_package_released))).toEqual({
        title: "Project Alpha: Lead đã duyệt gói, phát hành bản v1.2",
        body: "Gói CR-01, CR-02 đã vào bản v1.2. Tải bản sạch và bản có đánh dấu ở mục Version.",
      });

      expect(text(note("comment_posted", sampleMeta.comment_posted))).toEqual({
        title: "Comment mới ở Project Alpha",
        body: 'CM-01 trên "Section 1" (v1.0): Please double check',
      });

      expect(text(note("comment_replied", sampleMeta.comment_replied))).toEqual({
        title: "Trả lời mới ở CM-01",
        body: 'Trên "Section 1" (Project Alpha): Fixed in next commit',
      });

      expect(text(note("comment_resolved", sampleMeta.comment_resolved))).toEqual({
        title: "Comment CM-01 đã được xử lý",
        body: 'Góp ý của bạn trên "Section 1" (Project Alpha) đã được đánh dấu đã xử lý.',
      });

      expect(text(note("comment_converted", sampleMeta.comment_converted))).toEqual({
        title: "Comment CM-01 đã thành CR-05",
        body: 'Góp ý của bạn trên "Section 1" đã được ghi nhận thành change request CR-05.',
      });
    });

    it("en: dựng câu tiếng Anh cho cả 17 loại thông báo và không chứa ký tự tiếng Việt", () => {
      const text = textIn("en");

      const notifications = [
        note("org_member_joined", sampleMeta.org_member_joined),
        note("org_role_changed", sampleMeta.org_role_changed),
        note("org_member_removed", sampleMeta.org_member_removed),
        note("org_member_left", sampleMeta.org_member_left),
        note("baseline_submitted", sampleMeta.baseline_submitted),
        note("baseline_rejected", sampleMeta.baseline_rejected),
        note("baseline_approved", sampleMeta.baseline_approved),
        note("project_converted", sampleMeta.project_converted),
        note("change_request_written", sampleMeta.change_request_written),
        note("change_request_decided", sampleMeta.change_request_decided_written),
        note("change_request_decided", sampleMeta.change_request_decided_approved),
        note("change_request_decided", sampleMeta.change_request_decided_rejected),
        note("change_request_decided", sampleMeta.change_request_decided_rejected_reason),
        note("review_package_submitted", sampleMeta.review_package_submitted),
        note("review_package_changes_requested", sampleMeta.review_package_changes_requested),
        note("review_package_released", sampleMeta.review_package_released),
        note("comment_posted", sampleMeta.comment_posted),
        note("comment_replied", sampleMeta.comment_replied),
        note("comment_resolved", sampleMeta.comment_resolved),
        note("comment_converted", sampleMeta.comment_converted),
      ];

      for (const n of notifications) {
        const res = text(n);
        expect(res.title).toBeTruthy();
        expect(res.body).toBeTruthy();
        expect(VIETNAMESE_LETTER.test(res.title), `Title contains Vietnamese letters: ${res.title}`).toBe(false);
        expect(VIETNAMESE_LETTER.test(res.body), `Body contains Vietnamese letters: ${res.body}`).toBe(false);
      }

      expect(text(note("org_member_joined", sampleMeta.org_member_joined))).toEqual({
        title: "New member joined the organization",
        body: "Alice joined Acme Corp as Analyst.",
      });

      expect(text(note("baseline_approved", sampleMeta.baseline_approved))).toEqual({
        title: "Baseline v1.0 has been approved",
        body: "The baseline submission has been approved by the Lead and locked at v1.0.",
      });

      expect(text(note("change_request_decided", sampleMeta.change_request_decided_approved))).toEqual({
        title: 'CR-01: change group "Exports" approved',
        body: 'Change group "Exports" of "Add export feature" was approved.',
      });
    });

    it("bản ghi cũ thiếu meta (partial-meta): rơi về bodyGeneric/bodyShort, không rò tiếng Việt trên en", () => {
      const textEn = textIn("en");
      const textVi = textIn("vi");

      // 1. org_role_changed thiếu organizationName
      const roleChanged = note("org_role_changed", { role: "analyst" }, "Vai trò thay đổi", "Bạn giờ là Analyst trong Cty X.");
      expect(textVi(roleChanged)).toEqual({
        title: "Vai trò của bạn đã thay đổi",
        body: "Bạn giờ là Analyst.",
      });
      expect(textEn(roleChanged)).toEqual({
        title: "Your role has changed",
        body: "You are now Analyst.",
      });
      expect(VIETNAMESE_LETTER.test(textEn(roleChanged).title)).toBe(false);
      expect(VIETNAMESE_LETTER.test(textEn(roleChanged).body)).toBe(false);

      // 2. org_member_removed thiếu organizationName
      const memberRemoved = note("org_member_removed", {}, "Bạn bị xoá", "Bạn không còn là thành viên của Cty X.");
      expect(textVi(memberRemoved)).toEqual({
        title: "Bạn đã bị xoá khỏi tổ chức",
        body: "Bạn không còn là thành viên của tổ chức.",
      });
      expect(textEn(memberRemoved)).toEqual({
        title: "You have been removed from the organization",
        body: "You are no longer a member of the organization.",
      });
      expect(VIETNAMESE_LETTER.test(textEn(memberRemoved).title)).toBe(false);
      expect(VIETNAMESE_LETTER.test(textEn(memberRemoved).body)).toBe(false);

      // 3. baseline_rejected thiếu projectName
      const blRejected = note("baseline_rejected", { reason: "Need revision" }, "Dự án X: Lead chưa duyệt baseline", "Need revision");
      expect(textVi(blRejected)).toEqual({
        title: "Dự án: Lead chưa duyệt baseline",
        body: "Need revision",
      });
      expect(textEn(blRejected)).toEqual({
        title: "Project: Lead requested revisions on baseline",
        body: "Need revision",
      });
      expect(VIETNAMESE_LETTER.test(textEn(blRejected).title)).toBe(false);
      expect(VIETNAMESE_LETTER.test(textEn(blRejected).body)).toBe(false);

      // 4. change_request_written thiếu cr_title
      const crWritten = note("change_request_written", { cr_id: "CR-01", result_doc_version: "v1.1" }, "CR-01 ghi bản nháp", "CR-01 đã ghi...");
      expect(textVi(crWritten).body).toBe("CR-01 đã ghi vào bản nháp chung (bản v1.1). Gửi Lead duyệt cả gói khi muốn phát hành.");
      expect(textEn(crWritten).body).toBe("CR-01 has been written to the shared draft (version v1.1). Submit the package to the Lead when ready to release.");
      expect(VIETNAMESE_LETTER.test(textEn(crWritten).body)).toBe(false);

      // 5. comment_posted thiếu anchor_label / preview
      const cmPosted = note("comment_posted", { comment_id: "CM-01" }, "Comment mới ở Dự án X", "CM-01 trên...");
      expect(textVi(cmPosted)).toEqual({
        title: "Comment mới ở dự án",
        body: "Có bình luận mới (CM-01).",
      });
      expect(textEn(cmPosted)).toEqual({
        title: "New comment in project",
        body: "New comment posted (CM-01).",
      });
      expect(VIETNAMESE_LETTER.test(textEn(cmPosted).title)).toBe(false);
      expect(VIETNAMESE_LETTER.test(textEn(cmPosted).body)).toBe(false);

      // 6. comment_replied thiếu anchor_label / preview
      const cmReplied = note("comment_replied", { comment_id: "CM-01" }, "Trả lời mới ở CM-01", "Trên...");
      expect(textVi(cmReplied).body).toBe("Có câu trả lời mới cho CM-01.");
      expect(textEn(cmReplied).body).toBe("New reply on comment (CM-01).");
      expect(VIETNAMESE_LETTER.test(textEn(cmReplied).body)).toBe(false);

      // 7. comment_resolved thiếu anchor_label
      const cmResolved = note("comment_resolved", { comment_id: "CM-01" }, "Comment CM-01 đã được xử lý", "Góp ý...");
      expect(textVi(cmResolved).body).toBe("Góp ý CM-01 của bạn đã được đánh dấu đã xử lý.");
      expect(textEn(cmResolved).body).toBe("Your feedback CM-01 has been marked as resolved.");
      expect(VIETNAMESE_LETTER.test(textEn(cmResolved).body)).toBe(false);

      // 8. comment_converted thiếu anchor_label
      const cmConverted = note("comment_converted", { comment_id: "CM-01", cr_id: "CR-99" }, "Comment CM-01 thành CR-99", "Góp ý...");
      expect(textVi(cmConverted).body).toBe("Góp ý CM-01 đã được ghi nhận thành CR-99.");
      expect(textEn(cmConverted).body).toBe("Feedback CM-01 has been recorded as CR-99.");
      expect(VIETNAMESE_LETTER.test(textEn(cmConverted).body)).toBe(false);
    });
  });
});
