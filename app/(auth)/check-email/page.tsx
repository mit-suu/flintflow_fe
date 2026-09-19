import { redirect } from "next/navigation";

// Luồng link xác thực cũ đã thay bằng OTP; giữ route để link/bookmark cũ vẫn tới đúng trang nhập mã.
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  redirect(email ? `/verify-email?email=${encodeURIComponent(email)}` : "/verify-email");
}
