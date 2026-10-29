"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import StatusScreen from "./StatusScreen";

export interface ErrorScreenProps {
  error: Error & { digest?: string };
  /** Next: dựng lại phần bị lỗi mà không tải lại dữ liệu. */
  reset: () => void;
  /** Next 16: tải lại dữ liệu rồi dựng lại — có thì ưu tiên (lỗi tạm thời của server cũng hồi được). */
  unstable_retry?: () => void;
}

/**
 * Trang lỗi thương hiệu FlintFlow (5xx / lỗi khi render) theo ngôn ngữ giao diện — dùng chung cho `app/error.tsx` và
 * `app/global-error.tsx` (cái sau tự bọc `NextIntlClientProvider`). Không hiện `error.message`: ở production
 * Next đã che nó, còn ở dev nó là text kỹ thuật; chỉ hiện `digest` để đối chiếu log server.
 */
export default function ErrorScreen({ error, reset, unstable_retry }: ErrorScreenProps) {
  const t = useTranslations("errors.page");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      icon="error-circle"
      eyebrow={t("eyebrow")}
      title={t("title")}
      body={t("body")}
      homeLabel={t("home")}
      action={
        <Button icon="refresh" onClick={() => (unstable_retry ?? reset)()}>
          {t("retry")}
        </Button>
      }
      footnote={error.digest ? t("digest", { digest: error.digest }) : undefined}
    />
  );
}
