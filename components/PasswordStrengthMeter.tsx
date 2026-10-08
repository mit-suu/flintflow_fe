"use client";

import { useTranslations } from "next-intl";
import {
  checkPassword,
  passwordLevel,
  PASSWORD_ISSUE_VALUES,
  PASSWORD_LEVEL_KEYS,
  PASSWORD_MIN_LEVEL,
} from "@/lib/password-policy";

interface PasswordStrengthMeterProps {
  password: string;
}

/** Chưa đủ dùng = đỏ/vàng; từ ngưỡng `PASSWORD_MIN_LEVEL` trở lên = xanh. */
const LEVEL_STYLE = [
  { bar: "bg-error", text: "text-error" }, // 0 — yếu
  { bar: "bg-accent-gold", text: "text-accent-gold-text" }, // 1 — trung bình
  { bar: "bg-success-dark", text: "text-success" }, // 2 — khá
  { bar: "bg-success", text: "text-success" }, // 3 — mạnh
] as const;

/**
 * Thanh đo độ mạnh mật khẩu, đặt dưới ô nhập (slot `children` của `PasswordInput` / `PasswordField`).
 *
 * Quy tắc nằm ở `lib/password-policy.ts` và BE kiểm lại y hệt. Component này chỉ hiển thị, nhưng khi
 * mật khẩu chưa đạt thì **nói thẳng thiếu cái gì** thay vì tô một vạch đỏ rồi để người ta tự đoán —
 * đó là khác biệt giữa "hỏng rồi" và "còn thiếu chừng này nữa".
 *
 * Chữ lấy từ namespace `password` của `messages` (mức + lý do), ngưỡng trong câu do
 * `PASSWORD_ISSUE_VALUES` truyền vào nên bản dịch không phải chép lại con số.
 */
export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const t = useTranslations("password");
  if (!password) return null;

  const level = passwordLevel(password);
  const issue = checkPassword(password);
  const style = LEVEL_STYLE[level];
  const levelLabel = t(`level.${PASSWORD_LEVEL_KEYS[level]}`);

  return (
    <div className="flex flex-col gap-1 pt-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1" aria-hidden>
          {[1, 2, 3].map((slot) => (
            <div
              key={slot}
              className={`h-1 flex-1 rounded-full transition-colors ${
                // Mức 0 vẫn tô một nấc để thấy thang đo bắt đầu từ đâu.
                slot <= Math.max(level, 1) ? style.bar : "bg-surface-container-highest"
              }`}
            />
          ))}
        </div>
        <span className={`text-[11px] font-bold shrink-0 ${style.text}`} role="status">
          {level >= PASSWORD_MIN_LEVEL ? levelLabel : t("notUsable", { level: levelLabel })}
        </span>
      </div>
      {issue && (
        <p className="text-[11px] text-on-surface-variant leading-snug">{t(`issue.${issue}`, PASSWORD_ISSUE_VALUES)}</p>
      )}
    </div>
  );
}
