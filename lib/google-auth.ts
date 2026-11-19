/**
 * Đăng nhập Google là **tuỳ chọn** (T24).
 *
 * Trước T24, `app/layout.tsx` luôn bọc cả app trong `GoogleOAuthProvider` với
 * `clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""`. Thiếu biến đó — đúng cảnh image production
 * build ra mà quên truyền `--build-arg` — script `gsi/client` của Google khởi tạo với client id rỗng và
 * ném lỗi, React bắt được và cả trang thành "This page couldn't load". Nghĩa là **quên một biến môi
 * trường không bắt buộc làm trắng toàn bộ ứng dụng**, kể cả trang đăng nhập bằng mật khẩu.
 *
 * Giờ không có client id thì đơn giản là không có nút Google; mọi thứ còn lại chạy bình thường.
 *
 * `NEXT_PUBLIC_*` được Next thay bằng hằng số lúc build, nên giá trị này cố định theo image.
 */
export const GOOGLE_CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();

export const isGoogleAuthEnabled = GOOGLE_CLIENT_ID.length > 0;
