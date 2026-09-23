import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { GOOGLE_CLIENT_ID, isGoogleAuthEnabled } from "@/lib/google-auth";
import "./globals.css";

// Font tự host qua next/font: file nằm cùng domain và được preload ngay trong HTML đầu tiên ⇒ reload
// không phải chờ round-trip sang fonts.googleapis.com rồi đổi font giữa chừng (nhảy chữ). `display: swap`
// + `adjustFontFallback` (mặc định) giữ fallback có cùng metric nên khung chữ gần như không xê dịch.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
  const app = <NextIntlClientProvider>{children}</NextIntlClientProvider>;

  return (
    <html lang={locale} className={`${jakarta.variable} ${jetbrainsMono.variable} light`}>
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
