"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  acceptInvitation,
  createOrganization,
  previewInvitation,
  switchOrganization,
} from "@/lib/api/orgs";
import { fetchMe } from "@/lib/api/users";
import type { InvitationPreview } from "@/types/organization";

type Tab = "create" | "join";

/**
 * BPMN Flow 8 — tài khoản chưa thuộc org nào: tạo org (8.1–8.2) hoặc nhập mã mời (8.3–8.5).
 * `OrgGuard` đưa người dùng tới đây; trang này là chỗ duy nhất trong `/home` không đòi org.
 */
/**
 * Vào org xong phải TẢI LẠI HẲN trang chứ không `router.replace`: `ProjectsProvider` nằm ở layout `/home`, đã tải
 * dự án/thư mục bằng token chưa có org (⇒ 409) trước khi tới đây, và điều hướng phía client không dựng lại layout
 * ⇒ nó cứ giữ lỗi đó. Tải lại thì `/home` mở ra đúng màn "tạo dự án đầu tiên".
 */
const enterApp = () => window.location.assign("/home");

export default function OnboardingPage() {
  const t = useTranslations("app.org.onboarding");
  const tRoles = useTranslations("app.org.roles");

  const [tab, setTab] = useState<Tab>("create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);

  // Tên gợi ý "Tien's Organization" từ hồ sơ; người dùng sửa thoải mái. Chỉ điền khi ô còn trống — không
  // đè lên chữ người dùng đã kịp gõ trong lúc chờ /users/me.
  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then((me) => {
        const owner = me.name?.trim() || me.email.split("@")[0];
        if (mounted && owner) setName((current) => current || t("defaultName", { name: owner }));
      })
      .catch(() => undefined); // không có tên gợi ý thì người dùng tự đặt, không phải lỗi
    return () => {
      mounted = false;
    };
  }, [t]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    void run(async () => {
      const org = await createOrganization(name.trim());
      // Tạo xong chưa có `orgId` trong token — đổi sang org vừa tạo để vào làm việc ngay.
      await switchOrganization(org.id);
      enterApp();
    });
  };

  const handleCheckCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError(t("codeRequired"));
      return;
    }
    void run(async () => {
      setPreview(await previewInvitation(code.trim()));
    });
  };

  const handleJoin = () => {
    void run(async () => {
      await acceptInvitation(code.trim());
      enterApp();
    });
  };

  const tabClass = (value: Tab) =>
    `flex-1 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition ${
      tab === value
        ? "bg-primary text-white"
        : "bg-surface-container text-on-surface-muted hover:bg-surface-container-high"
    }`;

  return (
    <section className="w-full max-w-[560px] mx-auto flex flex-col gap-6 pt-10 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] sm:text-[26px] font-extrabold text-on-surface tracking-tight">{t("title")}</h1>
        <p className="text-[13.5px] text-on-surface-muted leading-[1.6]">{t("subtitle")}</p>
      </div>

      <div role="tablist" aria-label={t("title")} className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "create"}
          className={tabClass("create")}
          onClick={() => {
            setTab("create");
            setError(null);
          }}
        >
          {t("createTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "join"}
          className={tabClass("join")}
          onClick={() => {
            setTab("join");
            setError(null);
          }}
        >
          {t("joinTab")}
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-on-error-container">
          {error}
        </p>
      ) : null}

      {tab === "create" ? (
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label htmlFor="org-name" className="text-[13px] font-semibold text-on-surface">
            {t("nameLabel")}
          </label>
          <input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={80}
            className="rounded-lg border border-outline bg-surface px-3 py-2.5 text-[14px] text-on-surface"
          />
          <p className="text-[12.5px] text-on-surface-muted leading-[1.6]">{t("nameHint")}</p>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-60 px-4 py-2.5 text-[13.5px] font-semibold text-white"
          >
            {busy ? t("creating") : t("createCta")}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <form onSubmit={handleCheckCode} className="flex flex-col gap-3">
            <label htmlFor="invite-code" className="text-[13px] font-semibold text-on-surface">
              {t("codeLabel")}
            </label>
            <input
              id="invite-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPreview(null);
              }}
              placeholder={t("codePlaceholder")}
              className="rounded-lg border border-outline bg-surface px-3 py-2.5 text-[14px] text-on-surface tracking-[0.2em] uppercase"
            />
            <p className="text-[12.5px] text-on-surface-muted leading-[1.6]">{t("codeHint")}</p>
            {preview ? null : (
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-60 px-4 py-2.5 text-[13.5px] font-semibold text-white"
              >
                {busy ? t("checking") : t("checkCode")}
              </button>
            )}
          </form>

          {preview ? (
            <div className="flex flex-col gap-3 rounded-lg border border-outline bg-surface-container p-4">
              <p className="text-[13px] font-semibold text-on-surface">{t("previewTitle")}</p>
              <p className="text-[13px] text-on-surface-muted">
                {t("previewBody", {
                  org: preview.organizationName,
                  role: tRoles(preview.role),
                })}
              </p>
              <button
                type="button"
                onClick={handleJoin}
                disabled={busy}
                className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-60 px-4 py-2.5 text-[13.5px] font-semibold text-white"
              >
                {busy ? t("joining") : t("joinCta")}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
