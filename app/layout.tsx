import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { GOOGLE_CLIENT_ID, isGoogleAuthEnabled } from "@/lib/google-auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
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
  const app = <NextIntlClientProvider>{children}</NextIntlClientProvider>;

  return (
    <html lang={locale} className={`${inter.variable} light`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
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
