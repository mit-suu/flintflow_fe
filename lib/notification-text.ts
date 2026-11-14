import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { AppNotification } from "@/lib/api/notifications";
import { isLocale, tPhase } from "@/lib/i18n";

export interface NotificationText {
  title: string;
  body: string;
}

const num = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const str = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

const planLabelOf = (planId?: string, explicitLabel?: string): string | undefined =>
  explicitLabel ?? (planId ? PLAN_LABELS[planId] : undefined);

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
  const formatDate = (value: string | undefined): string | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : format.dateTime(date, { day: "numeric", month: "numeric", year: "numeric" });
  };

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
        const plan = planLabelOf(str(meta.plan), str(meta.label));
        if (!plan) return stored;
        const date = formatDate(str(meta.periodEnd));
        return {
          title: t("plan_changed.title", { plan }),
          body: date ? t("plan_changed.bodyUntil", { plan, date }) : t("plan_changed.bodyActive", { plan }),
        };
      }
      case "plan_expired": {
        const plan = planLabelOf(str(meta.plan));
        const previousPlan = planLabelOf(str(meta.previousPlan));
        if (!plan || !previousPlan) return stored;
        const credits = num(meta.credits);
        const date = formatDate(str(meta.periodEnd));
        let body: string;
        if (credits !== undefined && credits > 0) {
          const formattedCredits = format.number(credits);
          body = date
            ? t("plan_expired.bodyGranted", { plan, previousPlan, credits: formattedCredits, date })
            : t("plan_expired.bodyGrantedNoDate", { plan, previousPlan, credits: formattedCredits });
        } else {
          body = t("plan_expired.body", { plan, previousPlan });
        }
        return { title: t("plan_expired.title", { previousPlan }), body };
      }
      case "credits_renewed": {
        const credits = num(meta.credits);
        if (credits === undefined) return stored;
        const date = formatDate(str(meta.periodEnd));
        const formattedCredits = format.number(credits);
        return {
          title: t("credits_renewed.title"),
          body: date ? t("credits_renewed.body", { credits: formattedCredits, date }) : t("credits_renewed.bodyNoDate", { credits: formattedCredits }),
        };
      }
      case "credit_topup_needed": {
        const project = str(meta.project_name) ?? /^Dự án "([^"]+)"/.exec(notification.body)?.[1] ?? str(meta.project_id);
        if (!project) return stored;
        const stepId = str(meta.step_id) ?? "";
        const colonIdx = stepId.indexOf(":");
        const code = colonIdx === -1 ? stepId : stepId.slice(0, colonIdx);
        const key = colonIdx === -1 ? "" : stepId.slice(colonIdx + 1);
        let step: string;
        if (code === "I-4") {
          const sectionHeading =
            str(meta.section_heading) ??
            /^Dự án "[^"]+" dừng ở bước trích dữ liệu mục "([^"]+)"/.exec(notification.body)?.[1];
          const fixedSection = key.startsWith("fixed:") ? key.slice("fixed:".length) : "";
          if (sectionHeading) step = t("credit_topup_needed.stepExtractHeading", { heading: sectionHeading });
          else if (fixedSection) step = t("credit_topup_needed.stepExtractSection", { section: fixedSection });
          else step = t("credit_topup_needed.stepExtractGeneric");
        } else if (code === "I-1.11") {
          step = t("credit_topup_needed.stepSemanticCheck");
        } else if (code === "C-2" && key) {
          step = t("credit_topup_needed.stepCrClarify", { cr: key });
        } else if (code === "C-4" && key) {
          step = t("credit_topup_needed.stepCrPropose", { cr: key });
        } else if (code === "C-5" && key) {
          step = t("credit_topup_needed.stepCrVerify", { cr: key });
        } else {
          step = t("credit_topup_needed.stepGeneric");
        }
        return {
          title: t("credit_topup_needed.title"),
          body: t("credit_topup_needed.body", { project, step }),
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
      default:
        return stored;
    }
  };
};
