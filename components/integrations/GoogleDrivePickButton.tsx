"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { GOOGLE_G_LOGO } from "@/components/GoogleButton";
import { ApiClientError } from "@/lib/api/client";
import { getGoogleAccessToken } from "@/lib/api/google";
import { userErrorMessage } from "@/lib/api/error-messages";
import { isGoogleAuthEnabled } from "@/lib/google-auth";
import { isGooglePickerConfigured, pickGoogleFile, type PickedGoogleFile } from "@/lib/google-picker";
import { GoogleConsentCancelledError, useGoogleConnect } from "@/lib/hooks/use-google-connect";

interface GoogleDrivePickButtonProps {
  onPicked: (file: PickedGoogleFile) => void;
  disabled?: boolean;
}

/**
 * "Chọn từ Google Drive": nối Google nếu chưa (popup mở ngay trong cú click), lấy access token ngắn hạn rồi mở Google Picker.
 * Ẩn khi thiếu client id / API key / App ID ở FE, hoặc BE chưa bật tích hợp. Kèm dòng phân cách "hoặc" phía trên.
 */
export default function GoogleDrivePickButton(props: GoogleDrivePickButtonProps) {
  if (!isGoogleAuthEnabled || !isGooglePickerConfigured) return null;
  return <GoogleDrivePickButtonInner {...props} />;
}

function GoogleDrivePickButtonInner({ onPicked, disabled = false }: GoogleDrivePickButtonProps) {
  const t = useTranslations("app.integrations");
  const locale = useLocale();
  const { load, ensureConnected, markReconnectRequired } = useGoogleConnect();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (load.kind === "unavailable") return null;

  const handlePick = async () => {
    setBusy(true);
    setError(null);
    try {
      await ensureConnected();
      const { accessToken } = await getGoogleAccessToken();
      const file = await pickGoogleFile({ accessToken, locale });
      if (file) onPicked(file);
    } catch (err) {
      if (err instanceof GoogleConsentCancelledError) {
        setError(t("cancelled"));
        return;
      }
      if (err instanceof ApiClientError && err.code === "GOOGLE_RECONNECT_REQUIRED") markReconnectRequired();
      // Lỗi nạp Picker (script bị chặn, API key sai referrer) không phải lỗi API ⇒ câu hướng dẫn riêng
      setError(err instanceof ApiClientError ? userErrorMessage(err, t("pickerFailed")) : t("pickerFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-caption text-[#8A867E]">
        <span className="h-px flex-1 bg-[#E4E1DB]" />
        {t("or")}
        <span className="h-px flex-1 bg-[#E4E1DB]" />
      </div>
      <Button
        variant="secondary"
        className="self-center"
        loading={busy}
        disabled={disabled || busy || load.kind === "loading"}
        onClick={() => void handlePick()}
      >
        <span className="mr-2 inline-flex">{GOOGLE_G_LOGO}</span>
        {busy ? t("pickerOpening") : t("pickFromDrive")}
      </Button>
      {error && <p className="text-body text-[#B03030] text-center">{error}</p>}
    </div>
  );
}
