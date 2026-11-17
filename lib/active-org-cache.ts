import type { OrgRole } from "@/types/organization";
import { clearBrowserCookie, parseJsonCookie, readBrowserCookie, writeBrowserCookie } from "./browser-cookie";

export interface ActiveOrganization {
  id: string;
  name: string;
  /** Vai trò của chính người đang đăng nhập trong org này. */
  role: OrgRole;
}

/**
 * Bản nhớ của tổ chức đang mở (id, tên, vai trò) từ lần đọc gần nhất. Mỗi lần tải lại trang, token chỉ mang `orgId`
 * nên tên và vai trò phải đợi `GET /orgs/:id`; có bản nhớ thì thanh bên và trang theo vai trò vẽ đúng ngay, rồi
 * đọc lại ngầm để cập nhật. Chỉ là gợi ý hiển thị: quyền thật luôn do BE chặn.
 *
 * Nằm trong COOKIE (không phải localStorage) để server đọc được lúc dựng HTML: khung chờ xác thực của `/home/*` vẽ đúng
 * tên tổ chức và mục Credits ngay từ khung đầu tiên (`app/home/layout.tsx`), không chen vào sau khi hydrate.
 */
export const ACTIVE_ORG_COOKIE = "ff_active_org";
const ROLES: readonly OrgRole[] = ["lead", "analyst", "viewer"];

/** Đọc giá trị cookie (đã hoặc chưa `decodeURIComponent`) — dùng chung cho server và trình duyệt. */
export const parseActiveOrgCookie = (raw: string | null | undefined): ActiveOrganization | null => {
  const value = parseJsonCookie(raw) as Partial<ActiveOrganization> | null;
  if (!value || typeof value.id !== "string" || typeof value.name !== "string" || !ROLES.includes(value.role as OrgRole)) {
    return null;
  }
  return { id: value.id, name: value.name, role: value.role as OrgRole };
};

/** Giữ object cũ khi chuỗi lưu không đổi ⇒ component đọc nhiều lần vẫn nhận cùng một tham chiếu. */
let memo: { raw: string | null; value: ActiveOrganization | null } = { raw: null, value: null };

/**
 * Tổ chức đã nhớ (chỉ ở trình duyệt). Truyền `orgId` ⇒ chỉ trả khi khớp tổ chức trong token (đổi tổ chức thì bỏ bản
 * cũ). Không truyền ⇒ bản nhớ gần nhất bất kể tổ chức.
 */
export const readActiveOrgCache = (orgId?: string): ActiveOrganization | null => {
  if (typeof document === "undefined") return null;
  const raw = readBrowserCookie(ACTIVE_ORG_COOKIE);
  if (raw !== memo.raw) memo = { raw, value: parseActiveOrgCookie(raw) };
  return memo.value && (orgId === undefined || memo.value.id === orgId) ? memo.value : null;
};

export const writeActiveOrgCache = (org: ActiveOrganization) => writeBrowserCookie(ACTIVE_ORG_COOKIE, JSON.stringify(org));

/** Đăng xuất: người dùng sau trên cùng máy không được thấy tên tổ chức của người trước. */
export const clearActiveOrgCache = () => clearBrowserCookie(ACTIVE_ORG_COOKIE);
