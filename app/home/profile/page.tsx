"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Avatar, Button, LINK_PRIMARY, PageSkeleton } from "@/components/ui";
import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import PasswordInput from "../../../components/PasswordInput";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { checkPassword, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";
import { ApiClientError } from "../../../lib/api/client";
import { changeMyPassword, fetchMe, logoutAllDevices, updateMyName } from "../../../lib/api/users";
import { logoutAndRedirect } from "../../../lib/auth";
import type { User } from "../../../types/user";
import { userErrorMessage } from "@/lib/api/error-messages";

// Mỗi khối là một mảng nền mờ, không viền — cùng ngôn ngữ với danh sách ở trang Thành viên.
const cardClass = "bg-surface-container-low rounded-card p-5 sm:p-6 flex flex-col gap-4";
// Ô nhập cũng phẳng: nền đặc hơn nền khối một nấc để thấy ranh giới, viền thay bằng vòng focus.
const inputClass =
  "w-full px-3.5 py-2.5 rounded-control bg-surface-container-lowest outline-none transition-all focus:ring-2 focus:ring-primary text-on-surface text-body";

const displayNameOf = (user: User) => user.name || user.email.split("@")[0];

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // Tách dòng bằng nền của chính nó, không bằng kẻ ngang: nền trắng nổi trên nền mờ của khối.
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 rounded-control bg-surface-container-lowest px-3.5 py-2.5">
      <div className="sm:w-[160px] shrink-0 text-body font-bold text-on-surface-muted">{label}</div>
      <div className="min-w-0 flex-1 text-body text-on-surface">{children}</div>
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
      setError(userErrorMessage(err, t("nameFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cardClass}>
      <div className="flex items-center gap-4">
        <Avatar name={displayName} email={user.email} size="lg" />
        <div className="min-w-0">
          <div className="text-subtitle font-bold leading-tight tracking-tight text-on-surface truncate">{displayName}</div>
          <div className="text-body text-on-surface-muted truncate">{user.email}</div>
        </div>
      </div>

      <h2 className="text-heading font-bold text-on-surface pt-1">{t("info")}</h2>

      {saved && !editing && (
        <div className="p-3 rounded-control bg-success-soft text-success text-body font-semibold">
          {t("nameSaved")}
        </div>
      )}

      <div className="flex flex-col gap-1">
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
                <Button type="submit" loading={saving}>
                  {tc("save")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setName(user.name ?? "");
                    setError(null);
                  }}
                >
                  {tc("cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <span className="truncate">{user.name || <span className="text-on-surface-subtle italic">{t("nameUnset")}</span>}</span>
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setSaved(false);
                }}
                className="ml-auto text-body font-bold text-primary hover:underline shrink-0"
              >
                {t("edit")}
              </button>
            </div>
          )}
          {error && <p className="text-body font-semibold text-error pt-1">{error}</p>}
        </InfoRow>

        <InfoRow label={t("email")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-all">{user.email}</span>
            {user.emailVerified ? (
              <span className="px-2 py-0.5 rounded-full bg-success-soft text-success text-caption font-bold">
                {t("emailVerified")}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-accent-gold-soft text-accent-gold-text text-caption font-bold">
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
            <Link href="/home/billing" className="ml-auto text-body font-bold text-primary hover:underline shrink-0">
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
        <h2 className="text-heading font-bold text-on-surface">{t("createPasswordTitle")}</h2>
        <p className="text-body text-on-surface-variant leading-[1.6]">
          {t.rich("createPasswordBody", {
            email: user.email,
            b: (chunks) => <strong className="text-on-surface">{chunks}</strong>,
          })}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            href={`/forgot-password?email=${encodeURIComponent(user.email)}&mode=create`}
            className={`${LINK_PRIMARY} self-start`}
          >
            {t("createPasswordCta")}
          </Link>
          <span className="text-caption text-on-surface-subtle">
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
        setError(userErrorMessage(err, t("changePasswordFailed")));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={cardClass}>
      <div>
        <h2 className="text-heading font-bold text-on-surface">{t("changePasswordTitle")}</h2>
        <p className="text-body text-on-surface-muted mt-1 leading-[1.6]">
          {t("changePasswordBody")}
        </p>
      </div>

      {success && (
        <div className="p-3 rounded-control bg-success-soft text-success text-body font-semibold">
          {t("changePasswordSuccess")}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-control bg-error-container text-body text-on-error-container">{error}</div>
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
          <Button type="submit" loading={saving} disabled={!canSubmit}>
            {saving ? t("saving") : t("submit")}
          </Button>
          <div className="flex flex-col">
            <Link
              href={`/forgot-password?email=${encodeURIComponent(user.email)}`}
              className="text-body font-semibold text-primary hover:underline"
            >
              {t("forgotCurrent")}
            </Link>
            <span className="text-caption text-on-surface-subtle">{t("forgotNote")}</span>
          </div>
        </div>
      </form>
    </section>
  );
}

function LogoutAllCard() {
  const t = useTranslations("app.profile");
  const tc = useTranslations("app.common");
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogoutAll = async () => {
    setWorking(true);
    setError(null);
    try {
      await logoutAllDevices();
    } catch (err) {
      // BE chưa thu hồi được ⇒ vẫn còn đăng nhập, không được chuyển về /login như thể đã xong
      setError(userErrorMessage(err, t("logoutAllFailed")));
      setWorking(false);
      return;
    }
    await logoutAndRedirect("/login");
  };

  return (
    <section className={cardClass}>
      <div>
        <h2 className="text-heading font-bold text-on-surface">{t("logoutAllTitle")}</h2>
        <p className="text-body text-on-surface-muted mt-1 leading-[1.6]">{t("logoutAllBody")}</p>
      </div>

      {error && (
        <div className="p-3 rounded-control bg-error-container text-body text-on-error-container">{error}</div>
      )}

      {confirming ? (
        <div className="flex flex-col gap-3 p-3.5 rounded-control bg-error-container">
          <p className="text-body font-semibold text-on-error-container">{t("logoutAllConfirm")}</p>
          <div className="flex gap-2">
            <Button variant="danger" loading={working} onClick={() => void handleLogoutAll()}>
              {t("logoutAllConfirmCta")}
            </Button>
            <Button variant="secondary" disabled={working} onClick={() => setConfirming(false)}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="self-start text-error"
          onClick={() => {
            setConfirming(true);
            setError(null);
          }}
        >
          {t("logoutAllCta")}
        </Button>
      )}
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
        if (!cancelled) setError(userErrorMessage(err));
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

      <div className="flex-1 overflow-y-auto flex flex-col gap-6 px-6 pt-6 sm:px-8 sm:pt-8 pb-scroll-end bg-surface-container-lowest">
        <h1 className="text-title font-bold text-on-surface tracking-tight">{t("title")}</h1>

        {loading ? (
          <PageSkeleton variant="form" label={t("loading")} />
        ) : error || !user ? (
          <div className="bg-error-container text-on-error-container px-4 py-3 rounded-control text-body font-medium">
            {error || t("loadFailed")}
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-[760px]">
            <ProfileInfoCard user={user} onUpdated={setUser} />
            <ChangePasswordCard user={user} />
            <LogoutAllCard />
          </div>
        )}
      </div>
    </>
  );
}
