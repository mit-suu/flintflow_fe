"use client";

import { useFormatter, useTranslations } from "next-intl";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import PasswordInput from "../../../components/PasswordInput";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { checkPassword, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { USER_AVATAR } from "@/components/layout/AppSidebar";
import { ApiClientError } from "../../../lib/api/client";
import { changeMyPassword, fetchMe, updateMyName } from "../../../lib/api/users";
import type { User } from "../../../types/user";

const cardClass = "bg-white border border-[#ECEAE5] rounded-[16px] p-5 sm:p-6 flex flex-col gap-4";
const inputClass =
  "w-full px-3.5 py-2.5 rounded-[8px] border-[1.5px] border-[#E4E1DC] focus:border-[#6A62C4] focus:ring-1 focus:ring-[#6A62C4] outline-none transition-all text-[#191817] bg-[#FAF9F7] text-[13.5px]";
const primaryButtonClass =
  "px-4 py-2.5 rounded-[10px] btn-gradient-primary text-white text-[13px] font-bold flex justify-center items-center gap-2 cursor-pointer disabled:opacity-60";

const displayNameOf = (user: User) => user.name || user.email.split("@")[0];

function Spinner() {
  return <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white ff-spinner shrink-0" />;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-t border-[#F0EEEA] first:border-t-0">
      <div className="sm:w-[160px] shrink-0 text-[12px] font-bold text-[#8A867E]">{label}</div>
      <div className="min-w-0 flex-1 text-[13.5px] text-[#191817]">{children}</div>
    </div>
  );
}

function ProfileInfoCard({ user, onUpdated }: { user: User; onUpdated: (user: User) => void }) {
  const t = useTranslations("app.profile");
  const tc = useTranslations("app.common");
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const displayName = displayNameOf(user);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("nameEmpty"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onUpdated(await updateMyName(trimmed));
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("nameFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cardClass}>
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-[26px] font-extrabold ${USER_AVATAR}`}
          aria-hidden
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-[18px] font-extrabold text-[#191817] truncate">{displayName}</div>
          <div className="text-[12.5px] text-[#8A867E] truncate">{user.email}</div>
        </div>
      </div>

      <h2 className="text-[15px] font-extrabold text-[#191817] pt-1">{t("info")}</h2>

      {saved && !editing && (
        <div className="p-3 rounded-[10px] bg-[#EAF6EE] text-[#1F7A45] text-[12px] font-semibold border border-[#C2E5CF]">
          {t("nameSaved")}
        </div>
      )}

      <div className="flex flex-col">
        <InfoRow label={t("nameLabel")}>
          {editing ? (
            <form className="flex flex-col sm:flex-row gap-2" onSubmit={handleSave}>
              <input
                aria-label={t("nameLabel")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoFocus
                className={inputClass}
              />
              <div className="flex gap-2 shrink-0">
                <button type="submit" disabled={saving} className={primaryButtonClass}>
                  {saving ? <Spinner /> : null}
                  {tc("save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setName(user.name ?? "");
                    setError(null);
                  }}
                  className="px-4 py-2.5 rounded-[10px] border-[1.5px] border-[#E4E1DC] text-[13px] font-bold text-[#6B6862] bg-[#FAF9F7] hover:bg-[#F0EEEA] transition-colors"
                >
                  {tc("cancel")}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <span className="truncate">{user.name || <span className="text-[#A8A49C] italic">{t("nameUnset")}</span>}</span>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setSaved(false);
                }}
                className="ml-auto text-[12px] font-bold text-[#6A62C4] hover:underline shrink-0"
              >
                {t("edit")}
              </button>
            </div>
          )}
          {error && <p className="text-[11.5px] font-semibold text-[#B03030] pt-1">{error}</p>}
        </InfoRow>

        <InfoRow label={t("email")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all">{user.email}</span>
            {user.emailVerified ? (
              <span className="px-2 py-0.5 rounded-full bg-[#EAF6EE] text-[#1F7A45] text-[10.5px] font-bold">
                {t("emailVerified")}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-[#FBF4E4] text-[#8A6D1F] text-[10.5px] font-bold">
                {t("emailUnverified")}
              </span>
            )}
          </div>
        </InfoRow>

        <InfoRow label={t("provider")}>
          {user.authProvider === "google"
            ? user.hasPassword
              ? t("providerGoogleBoth")
              : t("providerGoogle")
            : t("providerLocal")}
        </InfoRow>

        <InfoRow label={t("joined")}>
          {user.createdAt
            ? format.dateTime(new Date(user.createdAt), { day: "numeric", month: "numeric", year: "numeric" })
            : "—"}
        </InfoRow>

        <InfoRow label={t("credits")}>
          <div className="flex items-center gap-3">
            <span className="font-bold">{t("creditAmount", { credits: format.number(user.balance ?? 0) })}</span>
            <Link href="/home/billing" className="ml-auto text-[12px] font-bold text-[#6A62C4] hover:underline shrink-0">
              {t("toBilling")}
            </Link>
          </div>
        </InfoRow>
      </div>
    </section>
  );
}

function ChangePasswordCard({ user }: { user: User }) {
  const t = useTranslations("app.profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Chỉ báo khi user đã gõ vào ô xác nhận
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const sameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;
  const passwordIssue = newPassword.length > 0 ? checkPassword(newPassword) : null;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    !passwordIssue &&
    !passwordMismatch &&
    !sameAsCurrent &&
    confirmPassword.length > 0;

  if (!user.hasPassword) {
    // Tài khoản Google chưa có mật khẩu ⇒ tạo qua OTP gửi email (dùng lại luồng quên mật khẩu)
    return (
      <section className={cardClass}>
        <h2 className="text-[15px] font-extrabold text-[#191817]">{t("createPasswordTitle")}</h2>
        <p className="text-[13px] text-[#6B6862] leading-[1.6]">
          {t.rich("createPasswordBody", {
            email: user.email,
            b: (chunks) => <strong className="text-[#191817]">{chunks}</strong>,
          })}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            href={`/forgot-password?email=${encodeURIComponent(user.email)}&mode=create`}
            className={`${primaryButtonClass} self-start`}
          >
            {t("createPasswordCta")}
          </Link>
          <span className="text-[11px] text-[#A8A49C]">
            {t("createPasswordNote")}
          </span>
        </div>
      </section>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setCurrentPasswordError(null);
    setSuccess(false);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "INVALID_CURRENT_PASSWORD") {
        setCurrentPasswordError(err.message);
      } else {
        setError(err instanceof Error ? err.message : t("changePasswordFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cardClass}>
      <div>
        <h2 className="text-[15px] font-extrabold text-[#191817]">{t("changePasswordTitle")}</h2>
        <p className="text-[12.5px] text-[#8A867E] mt-1 leading-[1.6]">
          {t("changePasswordBody")}
        </p>
      </div>

      {success && (
        <div className="p-3 rounded-[10px] bg-[#EAF6EE] text-[#1F7A45] text-[12px] font-semibold border border-[#C2E5CF]">
          {t("changePasswordSuccess")}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-[10px] bg-[#FDEDED] border border-[#F2CACA] text-[12px] text-[#8A4141]">{error}</div>
      )}

      <form className="flex flex-col gap-3.5 max-w-[420px]" onSubmit={handleSubmit}>
        <PasswordInput
          id="currentPassword"
          label={t("currentPassword")}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(v) => {
            setCurrentPassword(v);
            setCurrentPasswordError(null);
          }}
          error={currentPasswordError}
        />

        <PasswordInput
          id="newPassword"
          label={t("newPassword")}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={newPassword}
          onChange={setNewPassword}
          error={sameAsCurrent ? t("sameAsCurrent") : null}
        >
          <PasswordStrengthMeter password={newPassword} />
        </PasswordInput>

        <PasswordInput
          id="confirmNewPassword"
          label={t("confirmNewPassword")}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={passwordMismatch ? t("confirmMismatch") : null}
        />

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
          <button type="submit" disabled={saving || !canSubmit} className={primaryButtonClass}>
            {saving ? (
              <>
                <Spinner />
                {t("saving")}
              </>
            ) : (
              t("submit")
            )}
          </button>
          <div className="flex flex-col">
            <Link
              href={`/forgot-password?email=${encodeURIComponent(user.email)}`}
              className="text-[12.5px] font-semibold text-[#6A62C4] hover:underline"
            >
              {t("forgotCurrent")}
            </Link>
            <span className="text-[11px] text-[#A8A49C]">{t("forgotNote")}</span>
          </div>
        </div>
      </form>
    </section>
  );
}

export default function ProfilePage() {
  const t = useTranslations("app.profile");
  const tc = useTranslations("app.common");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((err) => {
        // Chuỗi rỗng = lỗi tải, dịch lúc render ⇒ `t` không phải vào dependency của effect.
        if (!cancelled) setError(err instanceof Error ? err.message : "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TopBar trail={[tc("account"), t("breadcrumb")]} />

      <div className="flex-1 overflow-y-auto flex flex-col gap-6 p-6 sm:p-8 bg-surface-container-lowest">
        <h1 className="text-[24px] font-extrabold text-[#191817] tracking-tight">{t("title")}</h1>

        {loading ? (
          <PageSkeleton variant="form" label={t("loading")} />
        ) : error || !user ? (
          <div className="bg-[#FDEDED] border border-[#F2CACA] text-[#8A4141] px-4 py-3 rounded-[12px] text-xs font-medium">
            {error || t("loadFailed")}
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-[760px]">
            <ProfileInfoCard user={user} onUpdated={setUser} />
            <ChangePasswordCard user={user} />
          </div>
        )}
      </div>
    </>
  );
}
