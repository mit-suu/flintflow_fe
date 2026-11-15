import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { AppNotification } from "@/lib/api/notifications";
import { isLocale, tPhase } from "@/lib/i18n";

export interface NotificationText {
  title: string;
  body: string;
}

const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const str = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);

/**
 * Tiêu đề + nội dung thông báo theo ngôn ngữ đang dùng (T25). BE ghi `title`/`body` tiếng Việt và kèm `type` +
 * tham số trong `meta`; FE dựng lại câu từ `app.notificationTypes` nên đổi ngôn ngữ thì cả thông báo cũ cũng đổi.
 *
 * Thiếu tham số cần thiết (thông báo tạo trước khi BE ghi đủ `meta`) hoặc `type` lạ (vd `admin_new_user` — admin chỉ
 * tiếng Việt) ⇒ hiện nguyên `title`/`body` đã lưu.
 */
export const useNotificationText = () => {
  const t = useTranslations("app.notificationTypes");
  const tRoles = useTranslations("app.org.roles");
  const format = useFormatter();
  const rawLocale = useLocale();
  const locale = isLocale(rawLocale) ? rawLocale : "vi";

  return (notification: Pick<AppNotification, "type" | "title" | "body" | "meta">): NotificationText => {
    const meta = notification.meta ?? {};
    const stored = { title: notification.title, body: notification.body };

    switch (notification.type) {
      case "welcome": {
        const credits = num(meta.credits);
        if (credits === undefined) return stored;
        return { title: t("welcome.title"), body: t("welcome.body", { credits: format.number(credits) }) };
      }
      case "payment_success": {
        const credits = num(meta.credits);
        if (credits === undefined) return stored;
        return { title: t("payment_success.title"), body: t("payment_success.body", { credits: format.number(credits) }) };
      }
      case "payment_failed":
        return { title: t("payment_failed.title"), body: t("payment_failed.body") };
      // FLF-332 (BR-08): Analyst báo Lead nạp / Lead đã nạp
      case "credit_topup_requested": {
        const available = num(meta.available);
        if (available === undefined) return stored;
        const needed = num(meta.needed);
        return {
          title: t("credit_topup_requested.title"),
          body: needed === undefined ? t("credit_topup_requested.body", { available: format.number(available) }) : t("credit_topup_requested.bodyNeeded", { available: format.number(available), needed: format.number(needed) }),
        };
      }
      case "credit_topped_up": {
        const credits = num(meta.credits);
        const available = num(meta.available);
        if (credits === undefined || available === undefined) return stored;
        return { title: t("credit_topped_up.title", { credits: format.number(credits) }), body: t("credit_topped_up.body", { available: format.number(available) }) };
      }
      // FLF-303: Analyst gửi yêu cầu mời ⇒ Lead; Lead duyệt / từ chối ⇒ người yêu cầu
      case "org_invitation_requested": {
        const name = str(meta.requesterName);
        const email = str(meta.email);
        const org = str(meta.organizationName);
        const role = str(meta.role);
        if (!name || !email || !org || (role !== "analyst" && role !== "viewer")) return stored;
        return {
          title: t("org_invitation_requested.title"),
          body: t("org_invitation_requested.body", { name, email, org, role: tRoles(role) }),
        };
      }
      case "org_invitation_approved":
      case "org_invitation_rejected": {
        const email = str(meta.email);
        const org = str(meta.organizationName);
        if (!email || !org) return stored;
        return notification.type === "org_invitation_approved"
          ? { title: t("org_invitation_approved.title"), body: t("org_invitation_approved.body", { email, org }) }
          : { title: t("org_invitation_rejected.title"), body: t("org_invitation_rejected.body", { email, org }) };
      }
      case "low_credit": {
        const balance = num(meta.balance);
        if (balance === undefined) return stored;
        return { title: t("low_credit.title"), body: t("low_credit.body", { balance: format.number(balance) }) };
      }
      case "plan_changed": {
        const plan = str(meta.label);
        if (!plan) return stored;
        const periodEnd = str(meta.periodEnd);
        const date = periodEnd ? new Date(periodEnd) : null;
        return {
          title: t("plan_changed.title", { plan }),
          body:
            date && !Number.isNaN(date.getTime())
              ? t("plan_changed.bodyUntil", {
                  plan,
                  date: format.dateTime(date, { day: "numeric", month: "numeric", year: "numeric" }),
                })
              : t("plan_changed.bodyActive", { plan }),
        };
      }
      case "phase_accepted": {
        const code = str(meta.phase);
        if (!code) return stored;
        // Tên giai đoạn, không phải mã `S-3` (FLF-247)
        const phase = tPhase(code, locale);
        return { title: t("phase_accepted.title", { phase }), body: t("phase_accepted.body", { phase }) };
      }
      case "baseline_created": {
        const version = str(meta.version);
        if (!version) return stored;
        const count = num(meta.waived_count) ?? 0;
        return {
          title: t("baseline_created.title", { version }),
          body: count > 0 ? t("baseline_created.bodyWaived", { version, count }) : t("baseline_created.bodyClean", { version }),
        };
      }
      // Mẫu org ra bản mới mà còn dự án theo bản cũ ⇒ Lead + Analyst; bấm mở dự án (1 dự án) hoặc trang chủ
      case "template_version_published": {
        const version = num(meta.version);
        if (version === undefined || !Array.isArray(meta.project_ids)) return stored;
        const count = meta.project_ids.length;
        if (count === 0) return stored;
        return { title: t("template_version_published.title", { version }), body: t("template_version_published.body", { count }) };
      }
      // Mục BA tự đặt của mẫu khung tự lưu chờ duyệt
      case "skeleton_headings_pending": {
        const pending = num(meta.pending);
        if (pending === undefined) return stored;
        return { title: t("skeleton_headings_pending.title", { count: pending }), body: t("skeleton_headings_pending.body") };
      }
      // Đổi mẫu kẹt sau nhiều lần phục hồi: người tạo mở dự án và bấm Khôi phục
      case "template_migration_failed":
        return { title: t("template_migration_failed.title"), body: t("template_migration_failed.body") };
      // FLF-427 (UC-71, BR-06): 17 loại thông báo song ngữ chuẩn hoá
      case "org_member_joined": {
        const name = str(meta.memberName) || notification.body.match(/^(.+?)\s+đã tham gia/i)?.[1] || (locale === "en" ? "A member" : "Một thành viên");
        const org = str(meta.organizationName) || notification.body.match(/đã tham gia\s+(.+?)\s+với vai trò/i)?.[1] || (locale === "en" ? "the organization" : "tổ chức");
        const roleRaw = str(meta.role) || notification.body.match(/với vai trò\s+(.+?)\.?$/i)?.[1] || "member";
        const roleKey = roleRaw.toLowerCase();
        const role = roleKey === "lead" || roleKey === "analyst" || roleKey === "viewer" ? tRoles(roleKey) : roleRaw;
        return {
          title: t("org_member_joined.title"),
          body: t("org_member_joined.body", { name, org, role }),
        };
      }
      case "org_role_changed": {
        const roleRaw = str(meta.role) || notification.body.match(/Bạn giờ là\s+(.+?)\s+trong/i)?.[1] || "member";
        const roleKey = roleRaw.toLowerCase();
        const role = roleKey === "lead" || roleKey === "analyst" || roleKey === "viewer" ? tRoles(roleKey) : roleRaw;
        const org = str(meta.organizationName);
        return {
          title: t("org_role_changed.title"),
          body: org ? t("org_role_changed.body", { role, org }) : t("org_role_changed.bodyGeneric", { role }),
        };
      }
      case "org_member_removed": {
        const org = str(meta.organizationName);
        return {
          title: t("org_member_removed.title"),
          body: org ? t("org_member_removed.body", { org }) : t("org_member_removed.bodyGeneric"),
        };
      }
      case "org_member_left": {
        const name = str(meta.memberName) || notification.body.match(/^(.+?)\s+đã rời/i)?.[1] || (locale === "en" ? "A member" : "Một thành viên");
        const org = str(meta.organizationName) || notification.body.match(/đã rời\s+(.+?)\.?$/i)?.[1] || (locale === "en" ? "the organization" : "tổ chức");
        return {
          title: t("org_member_left.title"),
          body: t("org_member_left.body", { name, org }),
        };
      }
      case "baseline_submitted": {
        const project = str(meta.projectName) || (locale === "en" ? "Project" : "Dự án");
        return {
          title: t("baseline_submitted.title", { project }),
          body: t("baseline_submitted.body"),
        };
      }
      case "baseline_rejected": {
        const project = str(meta.projectName);
        const reason = str(meta.reason) || notification.body || "";
        return {
          title: t("baseline_rejected.title", { project: project || (locale === "en" ? "Project" : "Dự án") }),
          body: project ? t("baseline_rejected.body", { project, reason }) : t("baseline_rejected.bodyGeneric", { reason }),
        };
      }
      case "baseline_approved": {
        const version = str(meta.version) || notification.title.match(/Baseline\s+(\S+)\s+đã được duyệt/i)?.[1] || "v1.0";
        return {
          title: t("baseline_approved.title", { version }),
          body: t("baseline_approved.body", { version }),
        };
      }
      case "project_converted": {
        const version = str(meta.version) || str(meta.doc_version) || notification.body.match(/phiên bản\s+(\S+?)\./i)?.[1] || "1.0";
        return {
          title: t("project_converted.title"),
          body: t("project_converted.body", { version }),
        };
      }
      case "change_request_written": {
        const cr = str(meta.cr_id) || notification.title.match(/^(\S+)\s+đã ghi vào bản nháp/i)?.[1] || "CR";
        const title = str(meta.cr_title);
        const version = str(meta.result_doc_version) || str(meta.version) || notification.body.match(/bản nháp chung \(bản\s+(\S+?)\)/i)?.[1] || "1.0";
        return {
          title: t("change_request_written.title", { cr }),
          body: title ? t("change_request_written.body", { cr, title, version }) : t("change_request_written.bodyShort", { cr, version }),
        };
      }
      case "change_request_decided": {
        const cr = str(meta.cr_id) || notification.title.match(/^([A-Za-z0-9_-]+)/i)?.[1] || "CR";
        const title = str(meta.cr_title) || cr;
        const version = str(meta.result_doc_version) || str(meta.version);
        const group = str(meta.group_title) || (locale === "en" ? "Change group" : "Nhóm thay đổi");
        const decision = str(meta.decision) || (notification.title.includes("được duyệt") ? "approved" : "rejected");
        const reason = str(meta.reason);

        if (version) {
          return {
            title: t("change_request_decided.titleWritten", { cr, title, version }),
            body: t("change_request_decided.bodyWritten", { cr, title, version }),
          };
        }
        if (decision === "approved") {
          return {
            title: t("change_request_decided.titleApproved", { cr, group, title }),
            body: t("change_request_decided.bodyApproved", { cr, group, title }),
          };
        }
        return {
          title: t("change_request_decided.titleRejected", { cr, group, title }),
          body: reason
            ? t("change_request_decided.bodyRejectedReason", { cr, group, title, reason })
            : t("change_request_decided.bodyRejected", { cr, group, title }),
        };
      }
      case "review_package_submitted": {
        const project = str(meta.projectName) || (locale === "en" ? "Project" : "Dự án");
        const crIds = Array.isArray(meta.cr_ids) ? meta.cr_ids : (meta.crs ? [String(meta.crs)] : []);
        const count = num(meta.count) ?? (crIds.length > 0 ? crIds.length : parseInt(notification.title.match(/:\s*(\d+)\s+thay đổi/i)?.[1] ?? "0", 10));
        const crs = str(meta.crs) || (crIds.length > 0 ? crIds.join(", ") : "") || notification.body.match(/Gói\s+(.+?)\s+đã qua kiểm tra/i)?.[1] || "";
        return {
          title: t("review_package_submitted.title", { project, count, crs }),
          body: t("review_package_submitted.body", { project, count, crs }),
        };
      }
      case "review_package_changes_requested": {
        const project = str(meta.projectName) || (locale === "en" ? "Project" : "Dự án");
        const reason = str(meta.reason) || notification.body || "";
        return {
          title: t("review_package_changes_requested.title", { project }),
          body: t("review_package_changes_requested.body", { reason }),
        };
      }
      case "review_package_released": {
        const project = str(meta.projectName) || (locale === "en" ? "Project" : "Dự án");
        const version = str(meta.version) || notification.title.match(/phát hành bản\s+(\S+)/i)?.[1] || "v1.0";
        const crIds = Array.isArray(meta.cr_ids) ? meta.cr_ids : (meta.crs ? [String(meta.crs)] : []);
        const crs = str(meta.crs) || (crIds.length > 0 ? crIds.join(", ") : "") || notification.body.match(/Gói\s+(.+?)\s+đã vào bản/i)?.[1] || "";
        return {
          title: t("review_package_released.title", { project, version }),
          body: t("review_package_released.body", { project, version, crs }),
        };
      }
      case "comment_posted": {
        const project = str(meta.projectName) || (locale === "en" ? "project" : "dự án");
        const comment = str(meta.comment_id) || notification.body.match(/^(\S+)\s+trên/i)?.[1] || "Comment";
        const anchor = str(meta.anchor_label);
        const version = str(meta.version_label);
        const preview = str(meta.preview);
        return {
          title: t("comment_posted.title", { project }),
          body: anchor && version && preview !== undefined
            ? t("comment_posted.body", { project, comment, anchor, version, preview })
            : t("comment_posted.bodyShort", { comment }),
        };
      }
      case "comment_replied": {
        const comment = str(meta.comment_id) || notification.title.match(/^Trả lời mới ở\s+(\S+)/i)?.[1] || "Comment";
        const project = str(meta.projectName);
        const anchor = str(meta.anchor_label);
        const preview = str(meta.preview);
        return {
          title: t("comment_replied.title", { comment }),
          body: anchor && project && preview !== undefined
            ? t("comment_replied.body", { comment, anchor, project, preview })
            : t("comment_replied.bodyShort", { comment }),
        };
      }
      case "comment_resolved": {
        const comment = str(meta.comment_id) || notification.title.match(/^Comment\s+(\S+)\s+đã được xử lý/i)?.[1] || "Comment";
        const project = str(meta.projectName);
        const anchor = str(meta.anchor_label);
        return {
          title: t("comment_resolved.title", { comment }),
          body: anchor && project
            ? t("comment_resolved.body", { comment, anchor, project })
            : t("comment_resolved.bodyShort", { comment }),
        };
      }
      case "comment_converted": {
        const comment = str(meta.comment_id) || notification.title.match(/^Comment\s+(\S+)\s+đã thành/i)?.[1] || "Comment";
        const cr = str(meta.cr_id) || notification.title.match(/đã thành\s+(\S+)/i)?.[1] || "CR";
        const anchor = str(meta.anchor_label);
        return {
          title: t("comment_converted.title", { comment, cr }),
          body: anchor
            ? t("comment_converted.body", { comment, cr, anchor })
            : t("comment_converted.bodyShort", { comment, cr }),
        };
      }
      default:
        return stored;
    }
  };
};
