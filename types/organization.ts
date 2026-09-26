/** Tổ chức (BE `modules/organization`, task-26). Vai trò tính theo từng org. */

export type OrgRole = "lead" | "analyst" | "viewer";

/** Vai trò gắn được vào mã mời — lên Lead phải qua đổi vai trò (UC-73). */
export type InvitableRole = Exclude<OrgRole, "lead">;

export interface Organization {
  id: string;
  name: string;
  /** Vai trò của chính người đang đăng nhập trong org này. */
  role: OrgRole;
  joinedAt: string;
}

export interface OrganizationDetail extends Organization {
  memberCount: number;
}

export interface OrgMember {
  userId: string;
  email: string;
  name?: string;
  role: OrgRole;
  joinedAt: string;
}

export type InvitationState = "pending" | "accepted" | "revoked" | "expired";

export interface Invitation {
  id: string;
  email: string | null;
  role: InvitableRole;
  state: InvitationState;
  expiresAt: string;
  createdAt: string;
}

/** Mã thô chỉ có ở đúng lượt tạo — BE chỉ lưu hash. */
export interface CreatedInvitation extends Invitation {
  code: string;
}

export interface InvitationPreview {
  organizationName: string;
  role: InvitableRole;
  roleLabel: string;
  expiresAt: string;
}

/** Đổi org hoặc nhận mã mời đều trả token mới mang `orgId` của org vừa vào. */
export interface SwitchOrgResult {
  accessToken: string;
  organization: Organization;
}

export interface AcceptInvitationResult {
  accessToken: string;
  organization: { id: string; name: string; role: InvitableRole };
}
