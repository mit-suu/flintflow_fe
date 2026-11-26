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

/**
 * Trợ lý Google Docs (chat sửa thẳng file Google Docs) mặc định tắt: chỗ sửa trên Google Docs không quay về FlintFlow
 * (business-flow §4), nên có hai ô chat sửa hai bản khác nhau. BE cũng chặn bằng `GOOGLE_DOCS_AGENT_ENABLED`; bật cả hai
 * phía mới dùng được. Nhập / xuất Google Docs không phụ thuộc cờ này.
 */
// Tạm ẩn hẳn (26/11): env FE bật mà BE tắt thì nút vẫn hiện rồi mở ra panel "chưa được bật" — chỉ giữ xuất Google Docs.
// Bật lại: bỏ `false` và mở dòng dưới.
// export const isDocsAssistantEnabled = isGoogleAuthEnabled && process.env.NEXT_PUBLIC_GOOGLE_DOCS_AGENT_ENABLED === "true";
export const isDocsAssistantEnabled = false;
