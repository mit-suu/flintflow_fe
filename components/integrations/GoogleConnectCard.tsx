"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { GOOGLE_G_LOGO } from "@/components/GoogleButton";
import { userErrorMessage } from "@/lib/api/error-messages";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { GoogleConsentCancelledError, useGoogleConnect } from "@/lib/hooks/use-google-connect";

interface GoogleConnectCardProps {
  className?: string;
}

/**
 * Thẻ "MCP" ở trang hồ sơ: trạng thái kết nối Google Docs, nút Kết nối / Kết nối lại / Ngắt kết nối.
 *
 * Ẩn hẳn khi FE không có `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (không có `GoogleOAuthProvider` ⇒ không được gọi
 * `useGoogleLogin`) hoặc BE chưa bật tích hợp (`GOOGLE_INTEGRATION_DISABLED`).
 */
export default function GoogleConnectCard(props: GoogleConnectCardProps) {
  if (!isGoogleAuthEnabled) return null;
  return <GoogleConnectCardInner {...props} />;
}

function GoogleConnectCardInner({ className }: GoogleConnectCardProps) {
  const t = useTranslations("app.integrations");
  const { load, connect, disconnect } = useGoogleConnect();
  const [working, setWorking] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (load.kind === "unavailable") return null;

  const run = async (kind: "connect" | "disconnect") => {
    setWorking(kind);
    setError(null);
    try {
      if (kind === "connect") await connect();
      else await disconnect();
    } catch (err) {
      if (err instanceof GoogleConsentCancelledError) setError(t("cancelled"));
      else setError(userErrorMessage(err, t(kind === "connect" ? "connectFailed" : "disconnectFailed")));
    } finally {
      setWorking(null);
    }
  };

  const status = load.kind === "ready" ? load.status : null;

  return (
    <section className={className} aria-busy={load.kind === "loading"}>
      <h2 className="text-heading font-bold text-on-surface">{t("title")}</h2>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="mt-0.5">{GOOGLE_G_LOGO}</span>
          <div className="min-w-0">
            <div className="text-body font-bold text-on-surface">{t("googleDocs")}</div>
            <div className="text-body text-on-surface-muted">{t("googleDocsBody")}</div>
            <div className="text-body mt-1">
              {load.kind === "loading" && <span className="text-on-surface-muted">{t("loading")}</span>}
              {load.kind === "error" && <span className="text-error">{userErrorMessage(load.error, t("loadFailed"))}</span>}
              {status?.status === "connected" && (
                <span className="text-success font-semibold">
                  ● {t("connected")}
                  {status.email && <span className="text-on-surface-muted font-normal"> · {status.email}</span>}
                </span>
              )}
              {status?.status === "disconnected" && <span className="text-on-surface-muted">○ {t("disconnected")}</span>}
              {status?.status === "reconnect_required" && (
                <span className="text-error font-semibold">⚠ {t("reconnectRequired")}</span>
              )}
            </div>
          </div>
        </div>

        {status && (
          <div className="shrink-0">
            {status.status === "connected" ? (
              <Button
                variant="secondary"
                className="text-error"
                loading={working === "disconnect"}
                disabled={working !== null}
                onClick={() => void run("disconnect")}
              >
                {t("disconnect")}
              </Button>
            ) : (
              <Button loading={working === "connect"} disabled={working !== null} onClick={() => void run("connect")}>
                {t(status.status === "reconnect_required" ? "reconnect" : "connect")}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && <div className="p-3 rounded-control bg-error-container text-body text-on-error-container">{error}</div>}
    </section>
  );
}
