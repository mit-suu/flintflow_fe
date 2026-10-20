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
import TopBar from "@/components/layout/TopBar";
import { BackLink, Button, Tabs } from "@/components/ui";
import { getActiveOrgId } from "@/lib/api/token-store";
import PendingInvitations from "@/components/org/PendingInvitations";
import type { InvitationPreview } from "@/types/organization";
import { userErrorMessage } from "@/lib/api/error-messages";

type Tab = "create" | "join";

const CONTENT_WIDTH = "w-full max-w-[560px] mx-auto flex flex-col gap-6";

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
  const tSwitcher = useTranslations("app.org.switcher");
  const tRoles = useTranslations("app.org.roles");
  const tc = useTranslations("app.common");

  const [tab, setTab] = useState<Tab>("create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);

  // Hai lối vào trang này khác hẳn nhau nên khung cũng khác (xem chỗ render ở cuối). Chỉ đọc lúc mount: đổi tổ
  // chức luôn kết thúc bằng tải lại trang, nên giá trị không đổi giữa chừng.
  const [hasOrg] = useState(() => Boolean(getActiveOrgId()));

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
      setError(userErrorMessage(err));
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

  const content = (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-title sm:text-metric font-bold text-on-surface tracking-tight">{t("title")}</h1>
        <p className="text-body text-on-surface-muted leading-[1.6]">{t("subtitle")}</p>
      </div>

      {/* Lời mời gửi tới tài khoản này: bấm nhận luôn, khỏi gõ mã từ email */}
      <PendingInvitations />

      {/* Tab dạng segmented dùng chung (components/ui/Tabs). Trước đây tab đang chọn tô tím đặc, trùng chữ và trùng
          màu với nút "Tạo tổ chức" bên dưới ⇒ trông như hai nút giống hệt nhau. */}
      <Tabs
        label={t("title")}
        idBase="org-onboarding"
        value={tab}
        className="self-start"
        options={[
          { value: "create", label: t("createTab") },
          { value: "join", label: t("joinTab") },
        ]}
        onChange={(next) => {
          setTab(next);
          setError(null);
        }}
      />

      {error ? (
        <p role="alert" className="rounded-control bg-error-container px-3 py-2 text-body text-on-error-container">
          {error}
        </p>
      ) : null}

      {tab === "create" ? (
        <form onSubmit={handleCreate} role="tabpanel" id="org-onboarding-panel" aria-labelledby={"org-onboarding-tab-" + tab} className="flex flex-col gap-3">
          <label htmlFor="org-name" className="text-body font-semibold text-on-surface">
            {t("nameLabel")}
          </label>
          <input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={80}
            className="rounded-control bg-surface-container px-3 py-2.5 text-heading text-on-surface outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-body text-on-surface-muted leading-[1.6]">{t("nameHint")}</p>
          <Button type="submit" loading={busy} fullWidth>
            {busy ? t("creating") : t("createCta")}
          </Button>
        </form>
      ) : (
        <div role="tabpanel" id="org-onboarding-panel" aria-labelledby={"org-onboarding-tab-" + tab} className="flex flex-col gap-3">
          <form onSubmit={handleCheckCode} className="flex flex-col gap-3">
            <label htmlFor="invite-code" className="text-body font-semibold text-on-surface">
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
              className="rounded-control bg-surface-container px-3 py-2.5 text-heading text-on-surface outline-none focus:ring-2 focus:ring-primary tracking-[0.2em] uppercase"
            />
            <p className="text-body text-on-surface-muted leading-[1.6]">{t("codeHint")}</p>
            {preview ? null : (
              <Button type="submit" loading={busy} fullWidth>
                {busy ? t("checking") : t("checkCode")}
              </Button>
            )}
          </form>

          {preview ? (
            <div className="flex flex-col gap-3 rounded-card bg-surface-container p-4">
              <p className="text-body font-semibold text-on-surface">{t("previewTitle")}</p>
              <p className="text-body text-on-surface-muted">
                {t("previewBody", {
                  org: preview.organizationName,
                  role: tRoles(preview.role),
                })}
              </p>
              <Button loading={busy} fullWidth onClick={handleJoin}>
                {busy ? t("joining") : t("joinCta")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );

  // Chưa thuộc tổ chức nào (`OrgGuard` đẩy tới): `HomeFrame` dựng khung tối giản, KHÔNG có `AppShell`. `TopBar` gọi
  // `useAppShell()` nên đặt ở đây sẽ ném lỗi — và cũng chẳng có trang nào để quay lại.
  if (!hasOrg) {
    return <section className={`${CONTENT_WIDTH} pt-10 pb-12`}>{content}</section>;
  }

  // Đã có tổ chức, vào đây từ "Tạo hoặc tham gia" ở trang Đổi tổ chức ⇒ nằm trong `AppShell`: giữ nguyên thanh trên
  // như mọi trang `/home/*`, và có lối quay lại thay vì buộc dùng nút back của trình duyệt.
  return (
    <>
      <TopBar trail={[tc("account"), tSwitcher("title"), t("title")]} />

      <div className="flex-1 overflow-y-auto flex flex-col gap-6 px-6 pt-6 sm:px-8 sm:pt-8 pb-scroll-end bg-surface-container-lowest">
        <div className={CONTENT_WIDTH}>
          <BackLink href="/home/organizations">{tSwitcher("title")}</BackLink>
          {content}
        </div>
      </div>
    </>
  );
}
