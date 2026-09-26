/**
 * `/orgs` và `/invitations` (BE `modules/organization`, task-26).
 *
 * Token mang `orgId` quyết định org đang mở, nên mọi lượt đổi org đều phải lưu lại access token mới —
 * xem `switchOrganization` / `acceptInvitation`.
 */
import { apiCall } from "./client";
import { saveAuthToken } from "./token-store";
import type {
  AcceptInvitationResult,
  CreatedInvitation,
  Invitation,
  InvitationPreview,
  InvitableRole,
  OrgMember,
  OrgRole,
  Organization,
  OrganizationDetail,
  SwitchOrgResult,
} from "@/types/organization";

const unwrap = <T,>(res: { data: T | null }): T => res.data as T;

/** Org của tôi kèm vai trò từng nơi (UC-10). Rỗng ⇒ tài khoản chưa onboarding. */
export const fetchMyOrganizations = async (): Promise<Organization[]> =>
  unwrap(await apiCall<Organization[]>("/orgs"));

/** UC-07 — tạo org ở gói free, người tạo thành Lead và org có sẵn ví credit miễn phí. */
export const createOrganization = async (name: string): Promise<Organization> =>
  unwrap(await apiCall<Organization>("/orgs", { method: "POST", body: JSON.stringify({ name }) }));

export const fetchOrganization = async (orgId: string): Promise<OrganizationDetail> =>
  unwrap(await apiCall<OrganizationDetail>(`/orgs/${orgId}`));

export const renameOrganization = async (orgId: string, name: string): Promise<Organization> =>
  unwrap(await apiCall<Organization>(`/orgs/${orgId}`, { method: "PATCH", body: JSON.stringify({ name }) }));

/**
 * Xoá tổ chức — chỉ khi Lead là thành viên duy nhất. Xoá cả dự án, thư mục, ví và gói; không khôi phục được.
 * `confirmName` phải trùng tên org. Lỗi: `ORG_NAME_MISMATCH`, `ORG_HAS_OTHER_MEMBERS`, `ORG_BUSY`,
 * `ORG_PAYMENT_PENDING`.
 */
export const deleteOrganization = async (
  orgId: string,
  confirmName: string
): Promise<{ deleted: true; projectsDeleted: number }> =>
  unwrap(
    await apiCall<{ deleted: true; projectsDeleted: number }>(`/orgs/${orgId}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmName }),
    })
  );

/**
 * UC-10 — chọn org để làm việc. BE trả access token mới mang `orgId`; **phải lưu ngay**, nếu không
 * request kế tiếp vẫn đi với org cũ.
 */
export const switchOrganization = async (orgId: string): Promise<SwitchOrgResult> => {
  const result = unwrap(await apiCall<SwitchOrgResult>(`/orgs/${orgId}/switch`, { method: "POST" }));
  saveAuthToken(result.accessToken);
  return result;
};

// ─── Thành viên ────────────────────────────────────────────────────

export const fetchMembers = async (orgId: string): Promise<OrgMember[]> =>
  unwrap(await apiCall<OrgMember[]>(`/orgs/${orgId}/members`));

/** UC-73. Hạ Lead cuối cùng ⇒ `ApiClientError` code `LAST_LEAD` (409). */
export const changeMemberRole = async (orgId: string, userId: string, role: OrgRole): Promise<OrgMember> =>
  unwrap(
    await apiCall<OrgMember>(`/orgs/${orgId}/members/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    })
  );

/** UC-74. Xoá Lead cuối cùng ⇒ `LAST_LEAD`. */
export const removeMember = async (orgId: string, userId: string): Promise<void> => {
  await apiCall(`/orgs/${orgId}/members/${userId}`, { method: "DELETE" });
};

/** UC-72 — tự rời org. Lead duy nhất không rời được ⇒ `LAST_LEAD`. */
export const leaveOrganization = async (orgId: string): Promise<void> => {
  await apiCall(`/orgs/${orgId}/members/me`, { method: "DELETE" });
};

// ─── Mã mời ────────────────────────────────────────────────────────

export const fetchInvitations = async (orgId: string): Promise<Invitation[]> =>
  unwrap(await apiCall<Invitation[]>(`/orgs/${orgId}/invitations`));

/** UC-08 — chỉ Lead. `code` trong kết quả là lần duy nhất thấy mã thô. */
export const createInvitation = async (
  orgId: string,
  role: InvitableRole,
  email?: string
): Promise<CreatedInvitation> =>
  unwrap(
    await apiCall<CreatedInvitation>(`/orgs/${orgId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ role, ...(email ? { email } : {}) }),
    })
  );

export const revokeInvitation = async (orgId: string, invitationId: string): Promise<Invitation> =>
  unwrap(await apiCall<Invitation>(`/orgs/${orgId}/invitations/${invitationId}`, { method: "DELETE" }));

/** Xem trước trước khi tham gia. Mã hỏng/hết hạn/đã dùng ⇒ `INVITE_INVALID` (410). */
export const previewInvitation = async (code: string): Promise<InvitationPreview> =>
  unwrap(await apiCall<InvitationPreview>(`/invitations/${encodeURIComponent(code)}`));

/** UC-09 — nhận mã mời. Cũng trả token mới mang `orgId`, lưu ngay như `switchOrganization`. */
export const acceptInvitation = async (code: string): Promise<AcceptInvitationResult> => {
  const result = unwrap(
    await apiCall<AcceptInvitationResult>(`/invitations/${encodeURIComponent(code)}/accept`, { method: "POST" })
  );
  saveAuthToken(result.accessToken);
  return result;
};
