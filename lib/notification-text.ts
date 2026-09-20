import { useFormatter, useTranslations } from "next-intl";
import type { AppNotification } from "@/lib/api/notifications";

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
  const format = useFormatter();

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
        const phase = str(meta.phase);
        if (!phase) return stored;
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
      default:
        return stored;
    }
  };
};
