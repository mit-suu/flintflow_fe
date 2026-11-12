import type { Metadata } from "next";
import localFont from "next/font/local";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { GOOGLE_CLIENT_ID, isGoogleAuthEnabled } from "@/lib/google-auth";
import UploadLeaveGuard from "@/components/layout/UploadLeaveGuard";
import "./globals.css";

// Chữ thường dùng font hệ thống (`--font-sans` ở globals.css) nên không tải webfont nào. Chỉ mono tự
// host qua next/font: nó dùng cho số phiên bản, path Spine, khối mã — những chỗ cần bề rộng ký tự đều
// nhau mà font hệ thống không đảm bảo giống nhau giữa các máy.
// File woff2 nằm sẵn trong repo (`app/fonts/`, JetBrains Mono latin 400/500 từ @fontsource, OFL-1.1) thay vì
// `next/font/google`: bản Google tải font lúc `next build`, mạng tới Google chập chờn là build Docker trên CI đỏ.
const jetbrainsMono = localFont({
  variable: "--font-jetbrains-mono",
  src: [
    { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("title"), description: t("description") };
}

// Không có client id ⇒ KHÔNG bọc provider. Xem `lib/google-auth.ts` (T24): bọc với client id rỗng
// làm script gsi của Google ném lỗi và cả app thành trang trắng.

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Locale do `i18n/request.ts` chọn (cookie → Accept-Language → vi). Provider v4 tự nhận messages từ server.
  const locale = await getLocale();
  const app = (
    <NextIntlClientProvider>
      {children}
      <UploadLeaveGuard />
    </NextIntlClientProvider>
  );

  return (
    <html lang={locale} className={`${jetbrainsMono.variable} light`}>
      <body className="min-h-screen flex flex-col">
        {isGoogleAuthEnabled ? (
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{app}</GoogleOAuthProvider>
        ) : (
          app
        )}
      </body>
    </html>
  );
}
