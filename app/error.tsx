"use client";

import ErrorScreen, { type ErrorScreenProps } from "@/components/ErrorScreen";

/** Lỗi khi render một trang dưới root layout — root layout vẫn còn nên dùng luôn `NextIntlClientProvider` của nó. */
export default function ErrorPage(props: ErrorScreenProps) {
  return <ErrorScreen {...props} />;
}
